#!/usr/bin/env node
const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');
const os = require('os');
const { setTimeout: delay } = require('timers/promises');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const { request } = require('undici');
const cheerio = require('cheerio');
require('dotenv').config();

const config = loadConfig();

async function main() {
  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
  });

  await runBatch({ transporter });

  if (config.runOnce) {
    console.log('RUN_ONCE is true, exiting after single execution.');
    process.exit(0);
  }

  if (!config.schedulerEnabled) {
    console.log('Scheduler disabled; workflow is ready but inactive.');
    return;
  }

  cron.schedule(
    '0 7 * * 1-5',
    () => runBatch({ transporter }).catch(err => console.error('Scheduled run failed:', err)),
    { timezone: 'America/New_York' }
  );

  console.log('Scheduled execution every weekday at 7 AM Eastern.');
}

async function runBatch(deps) {
  console.log(`Starting outreach run at ${new Date().toISOString()}`);
  if (!config.sendingEnabled) {
    console.log('Sending disabled; workflow remains prepared for later activation.');
    return;
  }
  try {
    const leads = await findLeads(config);
    const sentSet = await readEmailSet(config.sentSheetId, config.sentSheetName);
    const blacklistSet = await readEmailSet(config.blacklistSheetId, config.blacklistSheetName);

    console.log(`[counts] after Brave Search: ${leads.length}`);
    console.log(`[counts] after lead parsing: ${leads.length}`);
    console.log(`[counts] after initial email extraction: ${leads.filter(l => Boolean((l.email || '').trim())).length}`);

    const checked = leads.map(lead => {
      const status = evaluateLeadStatus(lead.email, sentSet, blacklistSet);
      return { ...lead, ...status };
    });

    const afterDuplicateFiltering = checked.filter(l => !l.alreadySent).length;
    const afterBlacklistFiltering = checked.filter(l => !l.alreadySent && !l.isBlacklisted).length;
    console.log(`[counts] after duplicate filtering: ${afterDuplicateFiltering}`);
    console.log(`[counts] after blacklist filtering: ${afterBlacklistFiltering}`);

    let pipeline = checked.filter(l => !l.shouldSkip);

    if (!pipeline.length && config.testTargetEmail) {
      console.log('No eligible leads found; adding fallback placeholder lead for this test run.');
      pipeline = [createFallbackLead()];
    }

    if (!pipeline.length) {
      console.log('No eligible leads found after duplicate/blacklist gating.');
      return;
    }

    let sentCount = 0;

    for (const semanticLead of pipeline) {
      const enriched = await enrichWebsite(semanticLead);
      const refreshedStatus = evaluateLeadStatus(enriched.email, sentSet, blacklistSet);
      const leadIdentifier = `${enriched.businessName} <${enriched.email || 'no-email'}>`;
      const allowFallback = Boolean(config.testTargetEmail);

      if (!enriched.email && !allowFallback) {
        console.warn(`Skipping ${leadIdentifier} because no email was discovered after website extraction.`);
        continue;
      }

      if (refreshedStatus.shouldSkip && !allowFallback) {
        console.warn(`Skipping ${leadIdentifier} because duplicate/blacklist check failed after enrichment.`);
        continue;
      }

      let analysis = '';
      let analysisFailed = false;
      try {
        analysis = await analyzeBusiness(enriched);
      } catch (error) {
        console.error(`Model call failed (analysis) for ${leadIdentifier}: ${error.message}`);
        analysisFailed = true;
      }
      if (analysisFailed && !allowFallback) {
        console.warn(`Skipping ${leadIdentifier} because analysis failed.`);
        continue;
      }

      let emailPayload = '';
      let emailFailed = false;
      try {
        emailPayload = await generateEmail(enriched, analysis);
      } catch (error) {
        console.error(`Model call failed (email generation) for ${leadIdentifier}: ${error.message}`);
        emailFailed = true;
      }
      if (emailFailed && !allowFallback) {
        console.warn(`Skipping ${leadIdentifier} because email generation failed.`);
        continue;
      }

      let parsed;
      try {
        parsed = parseEmailContent(emailPayload, enriched, allowFallback);
      } catch (error) {
        console.error(`Email payload parsing failed for ${leadIdentifier}: ${error.message}`);
        if (!allowFallback) {
          console.warn(`Skipping ${leadIdentifier} because email parsing failed.`);
          continue;
        }
        parsed = getDefaultEmail(enriched);
      }

      const combined = { ...enriched, ...refreshedStatus, analysis, ...parsed };
      const sendTarget = config.testTargetEmail || combined.email;
      const sendPayload = { ...combined, sendTargetEmail: sendTarget };

      if (config.testTargetEmail) {
        console.log(`Test override active: redirecting outreach for ${combined.email} to ${sendTarget}`);
      }

      const delayMs = calculateRandomDelay();
      console.log(`Waiting ${Math.round(delayMs / 1000)}s before emailing ${sendTarget}`);
      await delay(delayMs);

      let info;
      try {
        info = await sendEmail(deps.transporter, sendPayload);
      } catch (error) {
        console.error('SMTP send error:', error.message);
        info = { accepted: [] };
      }

      const sent = Boolean(info && Array.isArray(info.accepted) && info.accepted.length > 0);
      if (sent) {
        await appendSentEmail(combined);
        sentSet.add((combined.email || '').toLowerCase());
        sentCount += 1;
        console.log(`Email accepted for ${combined.email}`);
      } else {
        await appendBlacklisted(combined);
        blacklistSet.add((combined.email || '').toLowerCase());
        console.log(`Email failed for ${combined.email}; logged to blacklist.`);
      }

      if (config.maxSends > 0 && sentCount >= config.maxSends) {
        console.log(`Reached max sends for this run (${config.maxSends}). Stopping.`);
        break;
      }
    }
  } catch (error) {
    console.error('Run failed:', error);
  } finally {
    console.log(`Outreach run completed at ${new Date().toISOString()}`);
  }
}

function loadConfig() {
  const env = process.env;
  return {
    braveToken: env.BRAVE_SEARCH_TOKEN,
    smtpHost: env.SMTP_HOST || 'mail.privateemail.com',
    smtpPort: Number(env.SMTP_PORT || 465),
    smtpUser: env.SMTP_USERNAME || 'ali@scaliagrowth.com',
    smtpPass: env.SMTP_PASSWORD || '',
    smtpFrom: env.SMTP_FROM || env.SMTP_USERNAME || 'ali@scaliagrowth.com',
    sentSheetId: env.SENT_SHEET_ID || '1s3gUHXoZcuIK52jpJNv-3oK0I32QvaEnUG0UgBzPpIc',
    sentSheetName: 'sent_emails',
    blacklistSheetId: env.BLACKLIST_SHEET_ID || '1kcl05lM0Z15BKhDTugkviexOrkWAWOJLYq7FyMgMhr8',
    blacklistSheetName: 'blacklist',
    niche: env.NICHE || 'car detailing',
    location: env.LOCATION || 'Philadelphia, PA',
    dailyLimit: Number(env.DAILY_LIMIT || 10),
    runOnce: env.RUN_ONCE === 'true',
    schedulerEnabled: env.SCHEDULER_ENABLED === 'true',
    sendingEnabled: env.SENDING_ENABLED === 'true',
    testTargetEmail: env.TEST_TARGET_EMAIL || '',
    maxSends: Number(env.MAX_SENDS || 1),
    gogKeyringPassword: env.GOG_KEYRING_PASSWORD || 'OpenClawPass',
    openclawAgentId: env.OPENCLAW_AGENT_ID || 'kernel',
    openclawAuthPath:
      env.OPENCLAW_AUTH_PROFILES_PATH ||
      path.join(os.homedir(), '.openclaw', 'agents', env.OPENCLAW_AGENT_ID || 'kernel', 'agent', 'auth-profiles.json'),
  };
}


async function callOpenClawAgent(prompt, stepLabel) {
  const args = [
    'agent',
    '--agent',
    config.openclawAgentId,
    '--local',
    '--message',
    prompt,
    '--json',
    '--thinking',
    'low',
  ];
  const env = { ...process.env };

  try {
    const { stdout } = await execFileAsync('openclaw', args, { env });
    const lines = stdout.split(/\r?\n/);
    const jsonIndex = lines.findIndex(line => line.trim().startsWith('{'));
    if (jsonIndex === -1) {
      throw new Error('OpenClaw agent output missing JSON');
    }
    const jsonPayload = lines.slice(jsonIndex).join('\n');
    const payload = JSON.parse(jsonPayload);
    const text = (payload.payloads || []).map(p => p.text).filter(Boolean).join('\n').trim();
    if (!text) {
      throw new Error('OpenClaw agent returned an empty response');
    }
    return text;
  } catch (error) {
    const message = error.message || 'Unknown OpenClaw agent error';
    const err = new Error(message);
    err.step = stepLabel;
    throw err;
  }
}

async function findLeads(cfg) {
  if (!cfg.braveToken) {
    throw new Error('Brave Search token is required');
  }

  const query = `Find ${cfg.niche} businesses in ${cfg.location} with contact details and websites.`;
  const count = Math.max(cfg.dailyLimit || 10, 10);
  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(count));
  url.searchParams.set('country', 'us');
  url.searchParams.set('search_lang', 'en');

  const response = await request(url.toString(), {
    headers: {
      'X-Subscription-Token': cfg.braveToken,
      Accept: 'application/json',
    },
    method: 'GET',
  });

  const payload = await response.body.text().then(text => {
    try {
      return JSON.parse(text);
    } catch (error) {
      console.warn('Unable to parse Brave Search JSON response');
      return {};
    }
  });

  const leads = extractLeadsFromPayload(payload, cfg);
  if (!leads.length) {
    console.warn('Brave Search did not return any web or location leads');
  }

  return leads.slice(0, cfg.dailyLimit);
}


function extractLeadsFromPayload(payload, cfg) {
  const seen = new Set();
  const normalized = [];

  const collect = entry => {
    const url = entry.url || entry.link || entry.meta_url?.url;
    const key = `${entry.title || ''}-${url || ''}`;
    if (!url || seen.has(key)) {
      return;
    }
    seen.add(key);

    const notes = [entry.description, entry.extra_snippets?.join(' '), entry.postal_address?.displayAddress]
      .filter(Boolean)
      .join(' • ')
      .trim();

    normalized.push({
      businessName: entry.title || entry.name || '',
      email: '',
      website: url,
      phone: entry.contact?.telephone || '',
      location: cfg.location,
      notes: notes || '',
    });
  };

  (payload.web?.results || []).forEach(collect);
  (payload.locations?.results || []).forEach(collect);

  return normalized;
}

function createFallbackLead() {
  return {
    businessName: 'Scalia Growth Demo Lead',
    email: 'test-lead@scaliagrowth.com',
    website: 'https://scaliagrowth.com',
    phone: '',
    location: config.location,
    notes: 'Fallback lead generated because no leads surfaced with usable contact info.',
  };
}

function evaluateLeadStatus(email, sentSet, blacklistSet) {
  const normalizedEmail = (email || '').toLowerCase().trim();
  if (!normalizedEmail) {
    return { alreadySent: false, isBlacklisted: false, shouldSkip: false };
  }
  const alreadySent = sentSet.has(normalizedEmail);
  const isBlacklisted = blacklistSet.has(normalizedEmail);
  return { alreadySent, isBlacklisted, shouldSkip: alreadySent || isBlacklisted };
}

async function readEmailSet(spreadsheetId, sheetName) {
  const emails = await readEmailsFromSheet(spreadsheetId, sheetName);
  return new Set(emails.map(email => email.toLowerCase()).filter(Boolean));
}

async function runGog(args) {
  const env = {
    ...process.env,
    GOG_KEYRING_PASSWORD: config.gogKeyringPassword,
  };

  try {
    const { stdout } = await execFileAsync('gog', args, { env });
    return stdout.trim();
  } catch (error) {
    const details = error.stderr || error.message;
    throw new Error(`gog ${args.join(' ')} failed: ${details}`);
  }
}

async function readEmailsFromSheet(spreadsheetId, sheetName) {
  try {
    const stdout = await runGog(['sheets', 'get', spreadsheetId, `${sheetName}!A1:Z`, '--json']);
    const data = JSON.parse(stdout);
    const rows = data.values || [];
    if (!rows.length) {
      return [];
    }

    const header = rows[0].map(cell => cell.toString().toLowerCase());
    const emailIdx = header.findIndex(name => name === 'email');
    if (emailIdx === -1) {
      return [];
    }

    return rows.slice(1).map(row => row[emailIdx] || '').filter(Boolean);
  } catch (error) {
    console.warn(`Unable to read ${sheetName}:`, error.message);
    return [];
  }
}


async function enrichWebsite(lead) {
  const websiteContent = await fetchWebsiteContent(lead.website);
  const { email, phone } = extractContactDetails(websiteContent);

  return {
    ...lead,
    websiteContent,
    email: lead.email || email || '',
    phone: lead.phone || phone || '',
  };
}

async function fetchWebsiteContent(url) {
  if (!url) {
    return '';
  }

  try {
    const response = await request(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Scalia-Outreach-Bot/1.0',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      throwOnError: false,
      maxRedirections: 5,
    });

    const text = await response.body.text();
    return text;
  } catch (error) {
    console.warn(`Unable to fetch ${url}:`, error.message);
    return '';
  }
}

function extractContactDetails(text) {
  if (!text) {
    return { email: '', phone: '' };
  }

  const $ = cheerio.load(text || '');
  const bodyText = $('body').text();
  const normalized = `${text}\n${bodyText}`;
  const emailMatch = normalized.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  const phoneMatch = normalized.match(/\+?\d[\d\s\-\.\(\)]{6,}\d/g);

  return {
    email: (emailMatch && emailMatch.length ? emailMatch[0] : '') || '',
    phone: (phoneMatch && phoneMatch.length ? phoneMatch[0] : '') || '',
  };
}

async function analyzeBusiness(lead) {
  const prompt = `Analyze this business website content and extract:
1. Main services offered
2. Service area/coverage
3. Unique selling angle or specialty
4. Any notable details for personalization

Business: ${lead.businessName}
Website: ${lead.website}
Initial notes: ${lead.notes}

Website content:
${truncateText(lead.websiteContent, 13000)}

Return a brief summary (2-3 sentences) focusing on what makes them unique and what would be relevant for a personalized cold email.`;

  return await callOpenClawAgent(prompt, 'analysis');
}

async function generateEmail(lead, analysis) {
  const emailPrompt = `Generate a personalized cold email for this business.

Business: ${lead.businessName}
Research: ${analysis}

Write the email in this exact style:

Hi there,

I came across ClearCoat Mobile Detailing and liked the clear mobile-first service message for Delaware County.

Are you currently using Facebook or Instagram ads to generate new jobs, or mostly word of mouth?

I run Scalia and help local service businesses get steady paid-ad leads. No pressure, just curious how you are handling growth right now.

Ali
Scalia Growth
https://scaliagrowth.com

Rules:
- Keep it short
- Plain text only
- No HTML
- No images
- Never use em dashes
- No exclamation marks
- Natural and casual
- No salesy buzzwords
- Mention only 1 or 2 specific details in the opener, not a long list
- Do not overload the first paragraph
- The opener must feel like a quick personal observation
- The question should ask whether they use Facebook or Instagram ads or mostly word of mouth
- Keep the body concise and easy to skim
- The final signoff must always be exactly:

Talk soon,
Ali
Scalia Growth
https://scaliagrowth.com
- The body must end with that exact signoff and no variation

Subject line rules:
- Personalized
- Normal sounding
- No em dashes
- No exclamation marks
- No spammy words
- Keep it simple

Return ONLY valid JSON.
Do not include markdown.
Do not include code fences.
Do not include any text before or after the JSON.
The output must be exactly in this format:

{
 "subject": "your subject here",
 "body": "your body here"
}`;

  return await callOpenClawAgent(emailPrompt, 'email generation');
}
function getDefaultEmail(lead) {
  return {
    subject: `Quick question about ${lead.businessName}`,
    body: `Hi there,\n\nI came across your business and wanted to reach out.\n\nTalk soon,\nAli\nScalia Growth\nhttps://scaliagrowth.com`,
  };
}

function parseEmailContent(raw, lead, allowFallback = false) {
  const defaultEmail = getDefaultEmail(lead);
  const trimmed = typeof raw === 'string' ? raw.trim() : '';

  if (!trimmed) {
    if (allowFallback) {
      return defaultEmail;
    }
    throw new Error('Email payload is empty');
  }

  let parsed = {};
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    if (allowFallback) {
      return defaultEmail;
    }
    throw new Error('Email payload is not valid JSON');
  }

  const subject = parsed.subject || '';
  const body = parsed.body || '';
  if (!subject || !body) {
    if (allowFallback) {
      return defaultEmail;
    }
    throw new Error('Email payload missing subject or body');
  }

  return {
    subject,
    body,
  };
}

function calculateRandomDelay() {
  const minDelay = 180000;
  const maxDelay = 420000;
  return Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
}

async function sendEmail(transporter, lead) {
  const recipient = lead.sendTargetEmail || lead.email;
  const message = {
    from: config.smtpFrom,
    to: recipient,
    subject: lead.subject,
    text: lead.body,
  };

  return transporter.sendMail(message);
}

async function appendSentEmail(lead) {
  try {
    const values = JSON.stringify([[
      lead.email || '',
      lead.businessName || '',
      lead.subject || '',
      lead.body || '',
      new Date().toISOString(),
      'sent',
      lead.website || '',
      lead.location || '',
    ]]);
    await runGog([
      'sheets',
      'append',
      config.sentSheetId,
      `${config.sentSheetName}!A:H`,
      '--values-json',
      values,
      '--insert',
      'INSERT_ROWS',
    ]);
  } catch (error) {
    console.warn('Failed to record sent email:', error.message);
  }
}

async function appendBlacklisted(lead) {
  try {
    const values = JSON.stringify([[lead.email, 'Send failed', new Date().toISOString()]]);
    await runGog(['sheets', 'append', config.blacklistSheetId, `${config.blacklistSheetName}!A:C`, '--values-json', values, '--insert', 'INSERT_ROWS']);
  } catch (error) {
    console.warn('Failed to record bounced email:', error.message);
  }
}

function truncateText(text = '', max = 12000) {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 3)}...`;
}

main().catch(error => {
  console.error('Automation crashed:', error);
  process.exit(1);
});
it(1);
});
tomation crashed:', error);
  process.exit(1);
});
it(1);
});
