import fs from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';

const SHEET_NAME = 'Sheet1';
const DASHBOARD_METADATA_HEADER = 'Dashboard Metadata';
const HANDLED_MARKER = 'handled_after_msg2';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function getEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function normalizePrivateKey(rawKey) {
  return rawKey.trim().replace(/\\n/g, '\n');
}

function extractMarker(notes, marker) {
  const regex = new RegExp(`\\[${marker}:\\s*([^\\]]+)\\]`, 'i');
  const match = notes.match(regex);
  return match?.[1]?.trim() ?? null;
}

function removeMarker(notes, marker) {
  return notes.replace(new RegExp(`\\s*\\[${marker}:\\s*[^\\]]+\\]`, 'gi'), '').trim();
}

function setMarker(notes, marker, value) {
  const cleaned = removeMarker(notes, marker);
  if (!value) return cleaned;
  return `${cleaned}${cleaned ? ' ' : ''}[${marker}: ${value}]`.trim();
}

function columnNumberToLetter(columnNumber) {
  let value = columnNumber;
  let column = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    value = Math.floor((value - 1) / 26);
  }
  return column;
}

function findColumnIndex(headers, name) {
  return headers.findIndex((h) => (h || '').trim().toLowerCase() === name.trim().toLowerCase());
}

async function main() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  loadEnvFile(envPath);

  const auth = new google.auth.JWT({
    email: getEnv('GOOGLE_CLIENT_EMAIL'),
    key: normalizePrivateKey(getEnv('GOOGLE_PRIVATE_KEY')),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = getEnv('GOOGLE_SHEET_ID');

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A:ZZ`,
  });

  const rows = res.data.values ?? [];
  const headers = rows[0] ?? [];
  const dataRows = rows.slice(1);

  const metadataIdx = (() => {
    const dashboardIdx = findColumnIndex(headers, DASHBOARD_METADATA_HEADER);
    if (dashboardIdx >= 0) return dashboardIdx;
    const notesIdx = findColumnIndex(headers, 'Notes');
    if (notesIdx >= 0) return notesIdx;
    throw new Error(`Could not find '${DASHBOARD_METADATA_HEADER}' or 'Notes' column`);
  })();

  const phoneIdx = findColumnIndex(headers, 'Phone');
  if (phoneIdx < 0) throw new Error('Could not find Phone column');

  const nowIso = new Date().toISOString();
  const metadataColLetter = columnNumberToLetter(metadataIdx + 1);

  const updates = [];
  let changed = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i] ?? [];
    const rowNumber = i + 2;
    const phone = (row[phoneIdx] || '').trim();
    if (!phone) continue;

    const currentMetadata = (row[metadataIdx] || '').trim();
    const updatedMetadata = setMarker(currentMetadata, HANDLED_MARKER, nowIso);

    if (updatedMetadata !== currentMetadata || !extractMarker(currentMetadata, HANDLED_MARKER)) {
      updates.push({
        range: `${SHEET_NAME}!${metadataColLetter}${rowNumber}`,
        values: [[updatedMetadata]],
      });
      changed += 1;
    }
  }

  const chunkSize = 400;
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: chunk,
      },
    });
  }

  console.log(`Stamped handled marker for ${changed} leads at ${nowIso}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
