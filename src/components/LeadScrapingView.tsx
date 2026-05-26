'use client';

import { useState } from 'react';

const COUNTIES: { name: string; area: string; priority: number }[] = [
  { name: 'Camden County NJ',      area: '856', priority: 1 },
  { name: 'Burlington County NJ',  area: '856', priority: 1 },
  { name: 'Gloucester County NJ',  area: '856', priority: 1 },
  { name: 'Salem County NJ',       area: '856', priority: 2 },
  { name: 'Cumberland County NJ',  area: '856', priority: 2 },
  { name: 'Atlantic County NJ',    area: '609', priority: 2 },
  { name: 'Cape May County NJ',    area: '609', priority: 3 },
  { name: 'Delaware County PA',    area: '610', priority: 2 },
  { name: 'Chester County PA',     area: '610', priority: 2 },
  { name: 'Philadelphia PA',       area: '215', priority: 3 },
  { name: 'Bucks County PA',       area: '215', priority: 3 },
  { name: 'Montgomery County PA',  area: '610', priority: 3 },
];

const SEARCH_TERMS = [
  'car detailing', 'auto detailing', 'mobile auto detailing',
  'auto appearance', 'ceramic coating', 'paint correction',
  'window tinting auto', 'paintless dent repair', 'auto spa', 'car wash detailing',
];

const CHAIN_BLACKLIST = [
  'walmart','autozone','advance auto','napa','midas','meineke',
  'caliber collision','mavis','pep boys','jiffy lube','firestone',
  'goodyear','carstar',"tommy's express",'tommy express','mister car wash',
  'express oil','take 5','valvoline','discount tire',"o'reilly",'oreilly',
  'dealership','honda','toyota','ford','chevy','bmw','mercedes','lexus',
  'nissan','hyundai','kia','volkswagen','subaru',
];

const TOLL_FREE = ['800','833','844','855','866','877','888'];
const VALID_AREAS = ['856','609','610','215','302','973','908','732','201','267','484','445'];

function cleanPhone(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let p = raw.toString().replace(/\D/g, '');
  if (p.startsWith('1') && p.length === 11) p = p.slice(1);
  if (p.length !== 10) return null;
  const area = p.slice(0, 3);
  if (TOLL_FREE.includes(area)) return null;
  if (!VALID_AREAS.includes(area)) return null;
  return p;
}

function cleanName(raw: string): string {
  return raw
    .replace(/\s*[-|]\s*.{3,60}$/, '')
    .replace(/\b(LLC|Inc\.?|Corp\.?|Co\.?|Ltd\.?)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isChain(name: string): boolean {
  const low = name.toLowerCase();
  return CHAIN_BLACKLIST.some(c => low.includes(c));
}

function assignNiche(name: string, cats: string): string {
  const all = (name + cats).toLowerCase();
  if (all.includes('detail') || all.includes('ceramic') || all.includes('paint correction') || all.includes('ppf') || all.includes('appearance')) return 'detailers';
  if (all.includes('car wash') || all.includes('auto wash')) return 'car wash';
  if (all.includes('body shop') || all.includes('collision') || all.includes('dent')) return 'auto body';
  if (all.includes('tint') || all.includes('window film')) return 'auto appearance';
  if (all.includes('repair') || all.includes('mechanic') || all.includes('oil change')) return 'auto repair';
  return 'detailers';
}

function priorityScore(phone: string): number {
  const area = phone.slice(0, 3);
  if (area === '856') return 0;
  if (['609', '610'].includes(area)) return 1;
  if (['215', '484', '445'].includes(area)) return 2;
  return 3;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

interface Lead { name: string; phone: string; niche: string; priority: number; }
interface LogLine { time: string; msg: string; type: 'info' | 'success' | 'warn' | 'error'; }

export function LeadScrapingView() {
  const [apiKey, setApiKey] = useState('ZDcxMzYyMjRkMDY5NDcwZGFjZGFjNzU3NzNkYjkxODh8MjExMmY0OGRlMQ');
  const [targetLeads, setTargetLeads] = useState(500);
  const [crmPhones, setCrmPhones] = useState('');
  const [selectedCounties, setSelectedCounties] = useState<Set<number>>(
    new Set(COUNTIES.map((c, i) => c.priority <= 2 ? i : -1).filter(i => i >= 0))
  );
  const [selectedTerms, setSelectedTerms] = useState<Set<number>>(new Set(SEARCH_TERMS.map((_, i) => i)));
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [stats, setStats] = useState({ scraped: 0, filtered: 0, dupes: 0, final: 0 });
  const [progress, setProgress] = useState(0);
  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);

  function addLog(msg: string, type: LogLine['type'] = 'info') {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs(prev => [...prev, { time, msg, type }]);
  }

  async function pollTask(taskId: string): Promise<Record<string, unknown>[]> {
    const start = Date.now();
    while (Date.now() - start < 120000) {
      await sleep(4000);
      const resp = await fetch(`https://api.app.outscraper.com/requests/${taskId}`, {
        headers: { 'X-API-KEY': apiKey },
      });
      if (!resp.ok) throw new Error('Poll failed');
      const data = await resp.json();
      if (data.status === 'Success') return (data.data || []).flat();
      if (data.status === 'ERROR') throw new Error('Task errored');
    }
    throw new Error('Task timed out');
  }

  async function runSearch(query: string, location: string): Promise<Record<string, unknown>[]> {
    const params = new URLSearchParams({
      query: `${query} in ${location}`,
      limit: '50',
      language: 'en',
      skip_closed: 'true',
      enrichment: 'false',
      fields: 'name,phone,category,full_address,state',
    });
    const resp = await fetch(`https://api.app.outscraper.com/maps/search-v3?${params}`, {
      headers: { 'X-API-KEY': apiKey },
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`API ${resp.status}: ${txt.slice(0, 100)}`);
    }
    const data = await resp.json();
    if (data.data) return (data.data as unknown[][]).flat() as Record<string, unknown>[];
    if (data.id) return await pollTask(data.id as string);
    return [];
  }

  async function startRun() {
    if (!apiKey.trim()) return;
    setRunning(true);
    setLogs([]);
    setOutput('');
    setProgress(0);
    setStats({ scraped: 0, filtered: 0, dupes: 0, final: 0 });

    const crmSet = new Set<string>(
      crmPhones.split('\n').map(l => cleanPhone(l.trim())).filter(Boolean) as string[]
    );
    const counties = COUNTIES.filter((_, i) => selectedCounties.has(i));
    const terms = SEARCH_TERMS.filter((_, i) => selectedTerms.has(i));
    const total = counties.length * terms.length;
    let done = 0;
    const leads: Lead[] = [];
    const seenPhones = new Set<string>([...crmSet]);
    let scraped = 0, filtered = 0, dupes = 0;

    addLog(`Starting: ${counties.length} counties × ${terms.length} terms`, 'info');
    addLog(`CRM dedup: ${crmSet.size} existing numbers`, 'info');

    for (const county of counties) {
      for (const term of terms) {
        if (leads.length >= targetLeads) {
          addLog(`Target of ${targetLeads} reached, stopping early`, 'success');
          break;
        }
        try {
          addLog(`Searching "${term}" in ${county.name}…`, 'info');
          const results = await runSearch(term, county.name);
          scraped += results.length;

          for (const r of results) {
            const phone = cleanPhone(r.phone as string);
            if (!phone) { filtered++; continue; }
            const name = cleanName((r.name as string) || '');
            if (!name || isChain(name)) { filtered++; continue; }
            if (seenPhones.has(phone)) { dupes++; continue; }
            seenPhones.add(phone);
            leads.push({ name, phone, niche: assignNiche(r.name as string, (r.category as string) || ''), priority: priorityScore(phone) });
          }

          done++;
          const pct = Math.round((done / total) * 100);
          setProgress(pct);
          setStats({ scraped, filtered, dupes, final: leads.length });
          addLog(`  → ${results.length} scraped · ${leads.length} clean total`, 'success');
        } catch (e) {
          addLog(`  ✗ ${county.name} / "${term}": ${(e as Error).message}`, 'error');
        }
        await sleep(400);
      }
      if (leads.length >= targetLeads) break;
    }

    leads.sort((a, b) => a.priority - b.priority);
    setOutput(leads.map(l => `${l.name}\t${l.phone}\t${l.niche}`).join('\n'));
    setProgress(100);
    setStats({ scraped, filtered, dupes, final: leads.length });
    addLog(`Done. ${leads.length} leads ready to paste into Google Sheets.`, 'success');
    setRunning(false);
  }

  function copyOutput() {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function toggleCounty(i: number) {
    setSelectedCounties(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  function toggleTerm(i: number) {
    setSelectedTerms(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  const logColors: Record<LogLine['type'], string> = {
    info: '#7a7a8a', success: '#86efac', warn: '#fcd34d', error: '#f87171',
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1100px' }}>
      <style>{css}</style>

      {/* Header */}
      <div className="ls-welcome">
        <div>
          <div className="ls-welcome-name">Lead Scraper</div>
          <div className="ls-welcome-sub">Outscraper → filtered → paste-ready CRM output</div>
        </div>
        <div className="ls-welcome-badge">Outscraper API</div>
      </div>

      <div className="ls-two-col">
        {/* LEFT — config */}
        <div className="ls-col">

          {/* API + target */}
          <div className="ls-panel">
            <div className="ls-panel-header"><span className="ls-panel-title">Configuration</span></div>
            <div className="ls-field-row">
              <div className="ls-field">
                <label className="ls-label">Outscraper API Key</label>
                <input
                  className="ls-input"
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="Paste your key…"
                />
              </div>
              <div className="ls-field ls-field-sm">
                <label className="ls-label">Target Leads</label>
                <input
                  className="ls-input"
                  type="number"
                  value={targetLeads}
                  onChange={e => setTargetLeads(Number(e.target.value))}
                  min={50} max={2000}
                />
              </div>
            </div>
            <div className="ls-field" style={{ marginTop: 12 }}>
              <label className="ls-label">CRM Phone Numbers (paste col C — for dedup)</label>
              <textarea
                className="ls-input ls-textarea"
                value={crmPhones}
                onChange={e => setCrmPhones(e.target.value)}
                placeholder={'2155551234\n8565559876\n…'}
              />
            </div>
          </div>

          {/* Counties */}
          <div className="ls-panel">
            <div className="ls-panel-header">
              <span className="ls-panel-title">Counties</span>
              <span className="ls-muted">{selectedCounties.size} selected</span>
            </div>
            <div className="ls-county-grid">
              {COUNTIES.map((c, i) => (
                <button
                  key={i}
                  className={`ls-chip${selectedCounties.has(i) ? ' ls-chip--active' : ''}`}
                  onClick={() => toggleCounty(i)}
                >
                  {c.name}
                  {c.area === '856' && <span className="ls-chip-badge">856</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Search terms */}
          <div className="ls-panel">
            <div className="ls-panel-header">
              <span className="ls-panel-title">Search Terms</span>
              <span className="ls-muted">{selectedTerms.size} selected</span>
            </div>
            <div className="ls-terms-grid">
              {SEARCH_TERMS.map((t, i) => (
                <button
                  key={i}
                  className={`ls-chip${selectedTerms.has(i) ? ' ls-chip--active' : ''}`}
                  onClick={() => toggleTerm(i)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <button
            className="ls-run-btn"
            onClick={startRun}
            disabled={running}
          >
            {running ? 'Running…' : 'Run Scraper'}
          </button>
        </div>

        {/* RIGHT — progress + output */}
        <div className="ls-col">

          {/* Stats */}
          <div className="ls-stat-grid">
            {[
              { label: 'Scraped', val: stats.scraped, color: '#8b5cf6' },
              { label: 'Filtered', val: stats.filtered, color: '#f59e0b' },
              { label: 'Dupes', val: stats.dupes, color: '#60a5fa' },
              { label: 'Final', val: stats.final, color: '#22c55e' },
            ].map(s => (
              <div key={s.label} className="ls-stat-card" style={{ '--bar': s.color } as React.CSSProperties}>
                <div className="ls-stat-bar" />
                <div className="ls-stat-val">{s.val}</div>
                <div className="ls-stat-lbl">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="ls-panel" style={{ padding: '14px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span className="ls-panel-title">Progress</span>
              <span className="ls-muted">{progress}%</span>
            </div>
            <div className="ls-progress-wrap">
              <div className="ls-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {/* Log */}
          <div className="ls-panel" style={{ flex: 1 }}>
            <div className="ls-panel-header"><span className="ls-panel-title">Log</span></div>
            <div className="ls-log">
              {logs.length === 0 && <span style={{ color: '#4b5563', fontSize: 12 }}>Waiting to run…</span>}
              {logs.map((l, i) => (
                <div key={i} className="ls-log-line">
                  <span className="ls-log-time">{l.time}</span>
                  <span style={{ color: logColors[l.type] }}>{l.msg}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Output */}
          {output && (
            <div className="ls-panel">
              <div className="ls-panel-header">
                <span className="ls-panel-title">Output</span>
                <span className="ls-badge-green">{stats.final} leads</span>
              </div>
              <div className="ls-output-hint">Click inside → Ctrl+A → Ctrl+C → paste into col B of your sheet</div>
              <textarea
                className="ls-input ls-output"
                value={output}
                readOnly
                onClick={e => (e.target as HTMLTextAreaElement).select()}
              />
              <button className="ls-copy-btn" onClick={copyOutput}>
                {copied ? 'Copied!' : 'Copy All to Clipboard'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const css = `
.ls-welcome {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  background: linear-gradient(135deg, rgba(139,92,246,0.12), rgba(96,165,250,0.08));
  border: 1px solid rgba(139,92,246,0.2); border-radius: 16px;
  padding: 20px 24px; margin-bottom: 22px;
}
.ls-welcome-name { font-size: 18px; font-weight: 800; color: #e8e8e7; }
.ls-welcome-sub { font-size: 12px; color: #7a7a8a; margin-top: 3px; }
.ls-welcome-badge {
  background: linear-gradient(90deg, #8b5cf6, #60a5fa);
  border-radius: 10px; padding: 7px 16px;
  font-size: 12px; font-weight: 700; color: #fff; white-space: nowrap; flex-shrink: 0;
}

.ls-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-items: start; }
@media (max-width: 900px) { .ls-two-col { grid-template-columns: 1fr; } }
.ls-col { display: flex; flex-direction: column; gap: 14px; }

.ls-panel {
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
  border-radius: 16px; padding: 18px;
}
.ls-panel-header {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;
}
.ls-panel-title { font-size: 13px; font-weight: 700; color: #d4d4d3; }
.ls-muted { font-size: 12px; color: #7a7a8a; }

.ls-field-row { display: grid; grid-template-columns: 1fr 120px; gap: 10px; }
.ls-field { display: flex; flex-direction: column; gap: 6px; }
.ls-label { font-size: 11px; font-weight: 600; color: #7a7a8a; text-transform: uppercase; letter-spacing: 0.06em; }
.ls-input {
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);
  border-radius: 10px; color: #d4d4d3; font-size: 12px; font-family: inherit;
  padding: 9px 12px; box-sizing: border-box; width: 100%;
}
.ls-input:focus { outline: none; border-color: rgba(139,92,246,0.45); }
.ls-input::placeholder { color: #4b5563; }
.ls-textarea { min-height: 80px; resize: vertical; font-size: 11px; }
.ls-output { min-height: 160px; resize: vertical; font-size: 11px; font-family: 'SF Mono', 'Fira Code', monospace; }

.ls-county-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
.ls-terms-grid { display: flex; flex-wrap: wrap; gap: 6px; }

.ls-chip {
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
  border-radius: 999px; color: #7a7a8a; font-size: 11px; font-family: inherit;
  padding: 5px 11px; cursor: pointer; transition: all 0.15s; text-align: left;
  display: flex; align-items: center; gap: 6px;
}
.ls-chip:hover { border-color: rgba(139,92,246,0.3); color: #d4d4d3; }
.ls-chip--active {
  background: rgba(124,106,247,0.15); border-color: rgba(139,92,246,0.35); color: #c4b5fd;
}
.ls-chip-badge {
  background: rgba(139,92,246,0.25); border-radius: 4px;
  padding: 1px 5px; font-size: 9px; font-weight: 700; color: #a78bfa;
}

.ls-run-btn {
  background: linear-gradient(90deg, #8b5cf6, #60a5fa);
  border: none; border-radius: 14px; color: #fff;
  font-size: 14px; font-weight: 700; font-family: inherit;
  padding: 14px; cursor: pointer; width: 100%;
  box-shadow: 0 10px 24px rgba(139,92,246,0.22); transition: opacity 0.15s;
}
.ls-run-btn:hover { opacity: 0.9; }
.ls-run-btn:disabled { opacity: 0.45; cursor: not-allowed; }

.ls-stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.ls-stat-card {
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
  border-radius: 12px; padding: 14px 10px 10px; position: relative; overflow: hidden; text-align: center;
}
.ls-stat-bar {
  position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: var(--bar); border-radius: 12px 12px 0 0; opacity: 0.85;
}
.ls-stat-val { font-size: 24px; font-weight: 800; color: #e8e8e7; line-height: 1; margin-bottom: 4px; }
.ls-stat-lbl { font-size: 11px; font-weight: 600; color: #7a7a8a; }

.ls-progress-wrap {
  height: 8px; background: rgba(255,255,255,0.06); border-radius: 999px; overflow: hidden;
}
.ls-progress-fill {
  height: 100%; border-radius: 999px;
  background: linear-gradient(90deg, #8b5cf6, #60a5fa); transition: width 0.3s ease;
}

.ls-log {
  background: rgba(0,0,0,0.25); border-radius: 10px; padding: 12px;
  max-height: 240px; overflow-y: auto; display: flex; flex-direction: column; gap: 3px;
  border: 1px solid rgba(255,255,255,0.05);
}
.ls-log-line { display: flex; gap: 8px; font-size: 11px; font-family: 'SF Mono','Fira Code',monospace; line-height: 1.6; }
.ls-log-time { color: #4b5563; flex-shrink: 0; }

.ls-output-hint { font-size: 11px; color: #7a7a8a; margin-bottom: 8px; }
.ls-badge-green {
  background: rgba(52,211,153,0.14); border: 1px solid rgba(52,211,153,0.3);
  color: #86efac; border-radius: 999px; padding: 3px 10px; font-size: 11px; font-weight: 700;
}
.ls-copy-btn {
  margin-top: 10px; background: rgba(124,106,247,0.12);
  border: 1px solid rgba(139,92,246,0.3); border-radius: 8px;
  color: #c4b5fd; font-size: 12px; font-family: inherit;
  padding: 8px 16px; cursor: pointer; transition: background 0.15s;
}
.ls-copy-btn:hover { background: rgba(124,106,247,0.22); }
`;
