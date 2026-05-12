'use client';

import { useEffect, useState, useRef } from 'react';
import type { ConversationSummary } from '@/lib/types';

type Stage = 'needs-call' | 'meeting-booked' | 'closed-dead';
interface PipelineLead { id: string; stage: Stage; }

interface ProfitEntry {
  id: string;
  label: string;
  amount: number;
  date: string; // ISO date string YYYY-MM-DD
}

interface Task {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
}

interface GoalData {
  monthKey: string; // "2026-05"
  goal: number;
}

const PL_KEY = 'scalia_profit_v1';
const TASK_KEY = 'scalia_tasks_v1';
const GOAL_KEY = 'scalia_goal_v1';
const PIPELINE_KEY = 'pipeline_leads_v1';

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function today() { return new Date().toISOString().slice(0, 10); }
function monthKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
function weekStart(d: Date) {
  const copy = new Date(d);
  copy.setDate(d.getDate() - d.getDay());
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function load<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
  catch { return fallback; }
}
function save(key: string, val: unknown) { localStorage.setItem(key, JSON.stringify(val)); }

function fmt$(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ── Mini bar chart (8 weeks) ── */
function WeeklyBarChart({ entries }: { entries: ProfitEntry[] }) {
  const weeks: { label: string; total: number }[] = [];
  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i * 7);
    const ws = weekStart(d);
    const we = new Date(ws);
    we.setDate(ws.getDate() + 6);
    const total = entries
      .filter(e => {
        const ed = new Date(e.date + 'T12:00:00');
        return ed >= ws && ed <= we;
      })
      .reduce((s, e) => s + e.amount, 0);
    const label = ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    weeks.push({ label, total });
  }
  const max = Math.max(...weeks.map(w => w.total), 1);

  return (
    <div className="dv-chart-wrap">
      <div className="dv-bars">
        {weeks.map((w, i) => (
          <div key={i} className="dv-bar-col">
            <div className="dv-bar-tooltip">{fmt$(w.total)}</div>
            <div
              className="dv-bar"
              style={{ height: `${Math.max((w.total / max) * 100, w.total > 0 ? 4 : 0)}%` }}
            />
            <div className="dv-bar-label">{w.label.split(' ')[0]}<br />{w.label.split(' ')[1]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Ring chart for conversion ── */
function RingChart({ pct }: { pct: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
      <circle cx="36" cy="36" r={r} fill="none"
        stroke="url(#ringGrad)" strokeWidth="8"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#60a5fa" />
        </linearGradient>
      </defs>
      <text x="36" y="40" textAnchor="middle" fill="#e8e8e7" fontSize="13" fontWeight="700" fontFamily="Inter,Arial,sans-serif">
        {pct}%
      </text>
    </svg>
  );
}

export function DashboardView({ conversations, onNavigate }: {
  conversations: ConversationSummary[];
  onNavigate?: (tab: string) => void;
}) {
  const [entries, setEntries] = useState<ProfitEntry[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goal, setGoal] = useState<GoalData>({ monthKey: monthKey(new Date()), goal: 5000 });
  const [pipelineLeads, setPipelineLeads] = useState<PipelineLead[]>([]);

  const [newLabel, setNewLabel] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newDate, setNewDate] = useState(today());
  const [newTask, setNewTask] = useState('');
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');

  useEffect(() => {
    setEntries(load<ProfitEntry[]>(PL_KEY, []));
    setTasks(load<Task[]>(TASK_KEY, []));
    setPipelineLeads(load<PipelineLead[]>(PIPELINE_KEY, []));
    const savedGoal = load<GoalData>(GOAL_KEY, { monthKey: monthKey(new Date()), goal: 5000 });
    const curMonth = monthKey(new Date());
    if (savedGoal.monthKey !== curMonth) {
      const reset = { monthKey: curMonth, goal: savedGoal.goal };
      setGoal(reset);
      save(GOAL_KEY, reset);
    } else {
      setGoal(savedGoal);
    }
  }, []);

  function addEntry() {
    const amt = parseFloat(newAmount.replace(/[^0-9.]/g, ''));
    if (!newLabel.trim() || isNaN(amt) || amt <= 0) return;
    const e: ProfitEntry = { id: uid(), label: newLabel.trim(), amount: amt, date: newDate };
    const next = [e, ...entries];
    setEntries(next); save(PL_KEY, next);
    setNewLabel(''); setNewAmount('');
  }

  function deleteEntry(id: string) {
    const next = entries.filter(e => e.id !== id);
    setEntries(next); save(PL_KEY, next);
  }

  function addTask() {
    if (!newTask.trim()) return;
    const t: Task = { id: uid(), text: newTask.trim(), done: false, createdAt: Date.now() };
    const next = [t, ...tasks];
    setTasks(next); save(TASK_KEY, next);
    setNewTask('');
  }

  function toggleTask(id: string) {
    const next = tasks.map(t => t.id === id ? { ...t, done: !t.done } : t);
    setTasks(next); save(TASK_KEY, next);
  }

  function deleteTask(id: string) {
    const next = tasks.filter(t => t.id !== id);
    setTasks(next); save(TASK_KEY, next);
  }

  function saveGoal() {
    const g = parseFloat(goalInput.replace(/[^0-9.]/g, ''));
    if (isNaN(g) || g <= 0) return;
    const next = { monthKey: monthKey(new Date()), goal: g };
    setGoal(next); save(GOAL_KEY, next);
    setEditingGoal(false);
  }

  // Stats
  const totalLeads = conversations.length;
  const hotLeads = conversations.filter(c => (c.responseType || '').trim().toLowerCase() === 'highly interested').length;
  const needsResponse = conversations.filter(c => c.needsResponse).length;
  const activeLeads = conversations.filter(c => c.workflowStatus === 'active').length;
  const dncLeads = conversations.filter(c => c.workflowStatus === 'dnc').length;
  const convPct = totalLeads > 0 ? Math.round((hotLeads / totalLeads) * 100) : 0;

  const pipelineNeedsCall = pipelineLeads.filter(l => l.stage === 'needs-call').length;
  const pipelineBooked = pipelineLeads.filter(l => l.stage === 'meeting-booked').length;
  const pipelineClosed = pipelineLeads.filter(l => l.stage === 'closed-dead').length;
  const pipelineTotal = pipelineLeads.length || 1;

  // Profit
  const now = new Date();
  const ws = weekStart(now);
  const curMonth = monthKey(now);
  const weekTotal = entries.filter(e => new Date(e.date + 'T12:00:00') >= ws).reduce((s, e) => s + e.amount, 0);
  const monthTotal = entries.filter(e => e.date.startsWith(curMonth)).reduce((s, e) => s + e.amount, 0);
  const goalPct = Math.min(Math.round((monthTotal / goal.goal) * 100), 100);

  const sortedTasks = [...tasks].sort((a, b) => Number(a.done) - Number(b.done) || b.createdAt - a.createdAt);

  return (
    <div className="dv-root">
      <style>{dvCss}</style>

      {/* Welcome */}
      <div className="dv-welcome">
        <div>
          <div className="dv-welcome-name">Welcome back, Ali 👋</div>
          <div className="dv-welcome-date">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
        </div>
        <div className="dv-welcome-badge">Scalia CRM</div>
      </div>

      {/* Top stat cards */}
      <div className="dv-section-label">Inbox Overview</div>
      <div className="dv-stat-grid">
        <div className="dv-stat-card" style={{ '--bar': '#8b5cf6' } as React.CSSProperties}>
          <div className="dv-stat-bar" />
          <div className="dv-stat-val">{totalLeads}</div>
          <div className="dv-stat-lbl">Total leads</div>
        </div>
        <div className="dv-stat-card" style={{ '--bar': '#22c55e' } as React.CSSProperties}>
          <div className="dv-stat-bar" />
          <div className="dv-stat-val">{hotLeads}</div>
          <div className="dv-stat-lbl">Hot leads</div>
        </div>
        <div className="dv-stat-card" style={{ '--bar': '#f59e0b' } as React.CSSProperties}>
          <div className="dv-stat-bar" />
          <div className="dv-stat-val">{needsResponse}</div>
          <div className="dv-stat-lbl">Needs response</div>
        </div>
        <div className="dv-stat-card" style={{ '--bar': '#60a5fa' } as React.CSSProperties}>
          <div className="dv-stat-bar" />
          <div className="dv-stat-val">{activeLeads}</div>
          <div className="dv-stat-lbl">Active</div>
        </div>
        <div className="dv-stat-card" style={{ '--bar': '#ef4444' } as React.CSSProperties}>
          <div className="dv-stat-bar" />
          <div className="dv-stat-val">{dncLeads}</div>
          <div className="dv-stat-lbl">DNC</div>
        </div>
      </div>

      <div className="dv-two-col">
        {/* Left column */}
        <div className="dv-col">

          {/* Profit tracker */}
          <div className="dv-panel">
            <div className="dv-panel-header">
              <span className="dv-panel-title">Profit Tracker</span>
            </div>
            <div className="dv-profit-totals">
              <div className="dv-profit-total">
                <div className="dv-profit-total-val">{fmt$(weekTotal)}</div>
                <div className="dv-profit-total-lbl">This week</div>
              </div>
              <div className="dv-profit-divider" />
              <div className="dv-profit-total">
                <div className="dv-profit-total-val">{fmt$(monthTotal)}</div>
                <div className="dv-profit-total-lbl">This month</div>
              </div>
            </div>

            <WeeklyBarChart entries={entries} />

            <div className="dv-add-row">
              <input
                className="dv-input dv-input-flex"
                placeholder="Label (e.g. Classic 57)"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addEntry()}
              />
              <input
                className="dv-input dv-input-amt"
                placeholder="$0"
                value={newAmount}
                onChange={e => setNewAmount(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addEntry()}
              />
              <input
                className="dv-input dv-input-date"
                type="date"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
              />
              <button className="dv-btn-add" onClick={addEntry}>+</button>
            </div>

            <div className="dv-entry-list">
              {entries.length === 0 && (
                <div className="dv-empty">No earnings logged yet.</div>
              )}
              {entries.map(e => (
                <div key={e.id} className="dv-entry">
                  <div className="dv-entry-left">
                    <div className="dv-entry-label">{e.label}</div>
                    <div className="dv-entry-date">{fmtDate(e.date)}</div>
                  </div>
                  <div className="dv-entry-right">
                    <div className="dv-entry-amt">{fmt$(e.amount)}</div>
                    <button className="dv-entry-del" onClick={() => deleteEntry(e.id)}>×</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pipeline funnel */}
          <div className="dv-panel">
            <div className="dv-panel-header">
              <span className="dv-panel-title">Pipeline</span>
              <button className="dv-link" onClick={() => onNavigate?.('pipeline')}>View →</button>
            </div>
            <div className="dv-funnel">
              {[
                { label: 'Needs a Call', count: pipelineNeedsCall, color: '#a78bfa' },
                { label: 'Meeting Booked', count: pipelineBooked, color: '#60a5fa' },
                { label: 'Closed / Dead', count: pipelineClosed, color: '#4b5563' },
              ].map(s => (
                <div key={s.label} className="dv-funnel-row">
                  <div className="dv-funnel-label">{s.label}</div>
                  <div className="dv-funnel-bar-wrap">
                    <div
                      className="dv-funnel-bar"
                      style={{
                        width: `${Math.max((s.count / pipelineTotal) * 100, s.count > 0 ? 6 : 0)}%`,
                        background: s.color,
                      }}
                    />
                  </div>
                  <div className="dv-funnel-count" style={{ color: s.color }}>{s.count}</div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right column */}
        <div className="dv-col">

          {/* Goal tracker */}
          <div className="dv-panel">
            <div className="dv-panel-header">
              <span className="dv-panel-title">Monthly Goal</span>
              {!editingGoal ? (
                <button className="dv-link" onClick={() => { setGoalInput(String(goal.goal)); setEditingGoal(true); }}>Edit</button>
              ) : (
                <div className="dv-goal-edit">
                  <input
                    className="dv-input dv-input-goal"
                    placeholder="5000"
                    value={goalInput}
                    onChange={e => setGoalInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveGoal()}
                    autoFocus
                  />
                  <button className="dv-btn-save-goal" onClick={saveGoal}>Save</button>
                </div>
              )}
            </div>
            <div className="dv-goal-amounts">
              <span className="dv-goal-earned">{fmt$(monthTotal)}</span>
              <span className="dv-goal-sep"> / </span>
              <span className="dv-goal-target">{fmt$(goal.goal)}</span>
            </div>
            <div className="dv-progress-wrap">
              <div className="dv-progress-bar" style={{ width: `${goalPct}%` }} />
            </div>
            <div className="dv-goal-pct">{goalPct}% of goal reached</div>
          </div>

          {/* Conversion rate */}
          <div className="dv-panel">
            <div className="dv-panel-header">
              <span className="dv-panel-title">Conversion Rate</span>
            </div>
            <div className="dv-conv-row">
              <RingChart pct={convPct} />
              <div className="dv-conv-stats">
                <div className="dv-conv-stat">
                  <span className="dv-conv-val" style={{ color: '#a78bfa' }}>{hotLeads}</span>
                  <span className="dv-conv-lbl">hot leads</span>
                </div>
                <div className="dv-conv-stat">
                  <span className="dv-conv-val">{totalLeads}</span>
                  <span className="dv-conv-lbl">total leads</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick tasks */}
          <div className="dv-panel">
            <div className="dv-panel-header">
              <span className="dv-panel-title">Today's Tasks</span>
              <span className="dv-tasks-count">{tasks.filter(t => !t.done).length} left</span>
            </div>
            <div className="dv-task-input-row">
              <input
                className="dv-input dv-input-flex"
                placeholder="Add a task…"
                value={newTask}
                onChange={e => setNewTask(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTask()}
              />
              <button className="dv-btn-add" onClick={addTask}>+</button>
            </div>
            <div className="dv-task-list">
              {sortedTasks.length === 0 && <div className="dv-empty">No tasks. You're all caught up.</div>}
              {sortedTasks.map(t => (
                <div key={t.id} className={`dv-task${t.done ? ' dv-task--done' : ''}`}>
                  <button className="dv-task-check" onClick={() => toggleTask(t.id)}>
                    {t.done ? '✓' : ''}
                  </button>
                  <span className="dv-task-text">{t.text}</span>
                  <button className="dv-task-del" onClick={() => deleteTask(t.id)}>×</button>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

const dvCss = `
.dv-root { padding: 20px; max-width: 1200px; }

.dv-welcome {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  background: linear-gradient(135deg, rgba(139,92,246,0.12), rgba(96,165,250,0.08));
  border: 1px solid rgba(139,92,246,0.2); border-radius: 16px;
  padding: 20px 24px; margin-bottom: 22px;
}
.dv-welcome-name { font-size: 18px; font-weight: 800; color: #e8e8e7; }
.dv-welcome-date { font-size: 12px; color: #7a7a8a; margin-top: 3px; }
.dv-welcome-badge {
  background: linear-gradient(90deg, #8b5cf6, #60a5fa);
  border-radius: 10px; padding: 7px 16px;
  font-size: 12px; font-weight: 700; color: #fff; white-space: nowrap; flex-shrink: 0;
}

.dv-section-label {
  font-size: 11px; font-weight: 700; color: #7a7a8a;
  text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 10px;
}

.dv-stat-grid {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 22px;
}
@media (max-width: 900px) { .dv-stat-grid { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 600px) { .dv-stat-grid { grid-template-columns: 1fr 1fr; } }

.dv-stat-card {
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
  border-radius: 14px; padding: 16px 14px 12px; position: relative; overflow: hidden;
}
.dv-stat-bar {
  position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: var(--bar); border-radius: 14px 14px 0 0; opacity: 0.85;
}
.dv-stat-val { font-size: 28px; font-weight: 800; color: #e8e8e7; line-height: 1; margin-bottom: 5px; }
.dv-stat-lbl { font-size: 12px; font-weight: 600; color: #7a7a8a; }

.dv-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
@media (max-width: 760px) { .dv-two-col { grid-template-columns: 1fr; } }

.dv-col { display: flex; flex-direction: column; gap: 14px; }

.dv-panel {
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
  border-radius: 16px; padding: 18px;
}
.dv-panel-header {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;
}
.dv-panel-title { font-size: 13px; font-weight: 700; color: #d4d4d3; }
.dv-link { background: none; border: none; color: #a78bfa; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; }
.dv-link:hover { color: #c4b5fd; }

/* Profit totals */
.dv-profit-totals { display: flex; align-items: center; gap: 0; margin-bottom: 16px; }
.dv-profit-total { flex: 1; text-align: center; }
.dv-profit-total-val { font-size: 26px; font-weight: 800; color: #e8e8e7; }
.dv-profit-total-lbl { font-size: 11px; color: #7a7a8a; margin-top: 2px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
.dv-profit-divider { width: 1px; height: 40px; background: rgba(255,255,255,0.08); flex-shrink: 0; }

/* Bar chart */
.dv-chart-wrap { margin-bottom: 16px; }
.dv-bars {
  display: flex; align-items: flex-end; gap: 4px; height: 80px;
  padding: 0 2px; position: relative;
}
.dv-bar-col {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  height: 100%; justify-content: flex-end; position: relative;
}
.dv-bar-col:hover .dv-bar-tooltip { opacity: 1; }
.dv-bar-tooltip {
  position: absolute; top: -22px; left: 50%; transform: translateX(-50%);
  background: #1a1a2e; border: 1px solid rgba(139,92,246,0.3);
  border-radius: 5px; padding: 2px 6px; font-size: 10px; color: #c4b5fd;
  white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity 0.15s; z-index: 10;
}
.dv-bar {
  width: 100%; border-radius: 4px 4px 0 0; min-height: 0;
  background: linear-gradient(180deg, #8b5cf6, #60a5fa);
  transition: height 0.3s ease;
}
.dv-bar-label {
  font-size: 9px; color: #4b5563; text-align: center; margin-top: 4px;
  line-height: 1.2; white-space: nowrap;
}

/* Add entry */
.dv-add-row { display: flex; gap: 6px; margin-bottom: 10px; }
.dv-task-input-row { display: flex; gap: 6px; margin-bottom: 10px; }
.dv-input {
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);
  border-radius: 8px; color: #d4d4d3; font-size: 12px; font-family: inherit;
  padding: 8px 10px; box-sizing: border-box;
}
.dv-input:focus { outline: none; border-color: rgba(139,92,246,0.45); }
.dv-input::placeholder { color: #4b5563; }
.dv-input-flex { flex: 1; min-width: 0; }
.dv-input-amt { width: 70px; flex-shrink: 0; }
.dv-input-date { width: 100px; flex-shrink: 0; color-scheme: dark; }
.dv-input-goal { width: 80px; flex-shrink: 0; }
.dv-btn-add {
  background: linear-gradient(90deg, #8b5cf6, #60a5fa);
  border: none; border-radius: 8px; color: #fff;
  font-size: 18px; font-weight: 700; width: 34px; flex-shrink: 0;
  cursor: pointer; line-height: 1; padding: 0;
}
.dv-btn-add:hover { opacity: 0.9; }

/* Entry list */
.dv-entry-list { max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
.dv-entry {
  display: flex; align-items: center; justify-content: space-between;
  background: rgba(255,255,255,0.02); border-radius: 8px; padding: 7px 10px;
  border: 1px solid rgba(255,255,255,0.05);
}
.dv-entry-left { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.dv-entry-label { font-size: 12px; font-weight: 600; color: #d4d4d3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dv-entry-date { font-size: 10px; color: #7a7a8a; }
.dv-entry-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.dv-entry-amt { font-size: 13px; font-weight: 700; color: #86efac; }
.dv-entry-del { background: none; border: none; color: #4b5563; cursor: pointer; font-size: 16px; line-height: 1; padding: 0 2px; }
.dv-entry-del:hover { color: #f87171; }

.dv-empty { font-size: 12px; color: #4b5563; text-align: center; padding: 16px 0; }

/* Funnel */
.dv-funnel { display: flex; flex-direction: column; gap: 10px; }
.dv-funnel-row { display: flex; align-items: center; gap: 10px; }
.dv-funnel-label { font-size: 11px; color: #7a7a8a; width: 110px; flex-shrink: 0; }
.dv-funnel-bar-wrap { flex: 1; height: 10px; background: rgba(255,255,255,0.05); border-radius: 999px; overflow: hidden; }
.dv-funnel-bar { height: 100%; border-radius: 999px; transition: width 0.4s ease; opacity: 0.85; }
.dv-funnel-count { font-size: 12px; font-weight: 700; width: 20px; text-align: right; flex-shrink: 0; }

/* Goal */
.dv-goal-edit { display: flex; gap: 6px; align-items: center; }
.dv-btn-save-goal {
  background: rgba(139,92,246,0.2); border: 1px solid rgba(139,92,246,0.35);
  color: #c4b5fd; border-radius: 6px; padding: 5px 10px; font-size: 12px;
  cursor: pointer; font-family: inherit; white-space: nowrap;
}
.dv-btn-save-goal:hover { background: rgba(139,92,246,0.3); }
.dv-goal-amounts { margin-bottom: 10px; }
.dv-goal-earned { font-size: 24px; font-weight: 800; color: #e8e8e7; }
.dv-goal-sep { font-size: 18px; color: #4b5563; margin: 0 4px; }
.dv-goal-target { font-size: 18px; color: #7a7a8a; }
.dv-progress-wrap {
  height: 10px; background: rgba(255,255,255,0.06); border-radius: 999px;
  overflow: hidden; margin-bottom: 8px;
}
.dv-progress-bar {
  height: 100%; border-radius: 999px;
  background: linear-gradient(90deg, #8b5cf6, #60a5fa);
  transition: width 0.5s ease;
}
.dv-goal-pct { font-size: 11px; color: #7a7a8a; font-weight: 600; }

/* Conversion */
.dv-conv-row { display: flex; align-items: center; gap: 20px; }
.dv-conv-stats { display: flex; flex-direction: column; gap: 10px; }
.dv-conv-stat { display: flex; align-items: baseline; gap: 6px; }
.dv-conv-val { font-size: 22px; font-weight: 800; color: #e8e8e7; }
.dv-conv-lbl { font-size: 12px; color: #7a7a8a; }

/* Tasks */
.dv-tasks-count { font-size: 11px; color: #7a7a8a; background: rgba(255,255,255,0.06); border-radius: 4px; padding: 2px 7px; }
.dv-task-list { display: flex; flex-direction: column; gap: 5px; max-height: 240px; overflow-y: auto; }
.dv-task {
  display: flex; align-items: center; gap: 8px;
  background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);
  border-radius: 8px; padding: 7px 10px;
}
.dv-task--done .dv-task-text { text-decoration: line-through; color: #4b5563; }
.dv-task-check {
  width: 18px; height: 18px; border-radius: 5px; flex-shrink: 0;
  border: 1.5px solid rgba(139,92,246,0.4); background: rgba(139,92,246,0.08);
  color: #a78bfa; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center;
  font-family: inherit; padding: 0;
}
.dv-task--done .dv-task-check { background: rgba(139,92,246,0.25); border-color: #8b5cf6; }
.dv-task-text { flex: 1; font-size: 12px; color: #d4d4d3; line-height: 1.4; }
.dv-task-del { background: none; border: none; color: #4b5563; cursor: pointer; font-size: 16px; line-height: 1; padding: 0 2px; flex-shrink: 0; }
.dv-task-del:hover { color: #f87171; }
`;
