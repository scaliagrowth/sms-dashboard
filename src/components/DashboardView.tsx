'use client';

import { useEffect, useState } from 'react';
import type { ConversationSummary } from '@/lib/types';

/* ─── Types ─── */
interface Task {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
}

interface PaymentClient {
  id: string;
  name: string;
  amount: number;
  startDate: string; // YYYY-MM-DD
  notes: string;
}

/* ─── Storage keys ─── */
const TASK_KEY = 'scalia_tasks_v1';
const PAY_KEY  = 'scalia_payments_v1';

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function today() { return new Date().toISOString().slice(0, 10); }

function load<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
  catch { return fallback; }
}
function save(key: string, val: unknown) { localStorage.setItem(key, JSON.stringify(val)); }

function fmt$(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/* Given a start date, compute the next invoice due date from today */
function nextInvoiceDate(startDate: string): { date: Date; daysUntil: number } {
  const start = new Date(startDate + 'T12:00:00');
  const now = new Date();
  now.setHours(12, 0, 0, 0);

  // Find next occurrence of the same day-of-month
  let candidate = new Date(now.getFullYear(), now.getMonth(), start.getDate(), 12);
  if (candidate < now) {
    candidate = new Date(now.getFullYear(), now.getMonth() + 1, start.getDate(), 12);
  }

  const daysUntil = Math.round((candidate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return { date: candidate, daysUntil };
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function DashboardView({ conversations, onNavigate }: {
  conversations: ConversationSummary[];
  onNavigate?: (tab: string) => void;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [payments, setPayments] = useState<PaymentClient[]>([]);
  const [newTask, setNewTask] = useState('');

  // Payment form
  const [payName, setPayName] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payStart, setPayStart] = useState(today());
  const [payNotes, setPayNotes] = useState('');
  const [showPayForm, setShowPayForm] = useState(false);

  useEffect(() => {
    setTasks(load<Task[]>(TASK_KEY, []));
    setPayments(load<PaymentClient[]>(PAY_KEY, []));
  }, []);

  /* Tasks */
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

  /* Payments */
  function addPayment() {
    const amt = parseFloat(payAmount.replace(/[^0-9.]/g, ''));
    if (!payName.trim() || isNaN(amt) || amt <= 0 || !payStart) return;
    const p: PaymentClient = { id: uid(), name: payName.trim(), amount: amt, startDate: payStart, notes: payNotes.trim() };
    const next = [...payments, p];
    setPayments(next); save(PAY_KEY, next);
    setPayName(''); setPayAmount(''); setPayStart(today()); setPayNotes('');
    setShowPayForm(false);
  }
  function deletePayment(id: string) {
    const next = payments.filter(p => p.id !== id);
    setPayments(next); save(PAY_KEY, next);
  }

  /* Stats */
  const totalLeads = conversations.filter(c => c.workflowStatus !== 'dnc').length;
  const hotLeads = conversations.filter(c => (c.responseType || '').trim().toLowerCase() === 'highly interested').length;
  const needsResponse = conversations.filter(c => c.needsResponse && c.workflowStatus !== 'dnc').length;

  const sortedTasks = [...tasks].sort((a, b) => Number(a.done) - Number(b.done) || b.createdAt - a.createdAt);

  return (
    <div className="dv-root">
      <style>{dvCss}</style>

      {/* Welcome */}
      <div className="dv-welcome">
        <div>
          <div className="dv-welcome-name">Welcome back, Ali 👋</div>
          <div className="dv-welcome-date">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
        <div className="dv-scalia-badge">Scalia CRM</div>
      </div>

      {/* Stat cards */}
      <div className="dv-stats">
        <div className="dv-stat" style={{ '--c': '#8b5cf6' } as React.CSSProperties}>
          <div className="dv-stat-bar" />
          <div className="dv-stat-val">{totalLeads}</div>
          <div className="dv-stat-lbl">Total leads</div>
        </div>
        <div className="dv-stat" style={{ '--c': '#22c55e' } as React.CSSProperties}>
          <div className="dv-stat-bar" />
          <div className="dv-stat-val">{hotLeads}</div>
          <div className="dv-stat-lbl">Hot leads</div>
        </div>
        <div className="dv-stat" style={{ '--c': '#f59e0b' } as React.CSSProperties}>
          <div className="dv-stat-bar" />
          <div className="dv-stat-val">{needsResponse}</div>
          <div className="dv-stat-lbl">Need reply</div>
        </div>
        <div
          className="dv-stat dv-stat--link"
          style={{ '--c': '#60a5fa' } as React.CSSProperties}
          onClick={() => onNavigate?.('pipeline')}
        >
          <div className="dv-stat-bar" />
          <div className="dv-stat-val">{payments.length}</div>
          <div className="dv-stat-lbl">Active clients</div>
        </div>
      </div>

      <div className="dv-grid">
        {/* Payment Reminders */}
        <div className="dv-panel dv-panel--wide">
          <div className="dv-panel-hdr">
            <span className="dv-panel-title">💳 Payment Reminders</span>
            <button className="dv-btn-ghost" onClick={() => setShowPayForm(f => !f)}>
              {showPayForm ? 'Cancel' : '+ Add Client'}
            </button>
          </div>

          {showPayForm && (
            <div className="dv-pay-form">
              <div className="dv-pay-form-row">
                <div className="dv-ff">
                  <label className="dv-lbl">Client name</label>
                  <input className="dv-input" value={payName} onChange={e => setPayName(e.target.value)} placeholder="Brian - Wright Lane" />
                </div>
                <div className="dv-ff dv-ff--sm">
                  <label className="dv-lbl">Monthly amount</label>
                  <input className="dv-input" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="$500" />
                </div>
                <div className="dv-ff dv-ff--sm">
                  <label className="dv-lbl">First payment date</label>
                  <input className="dv-input" type="date" value={payStart} onChange={e => setPayStart(e.target.value)} style={{ colorScheme: 'dark' }} />
                </div>
              </div>
              <div className="dv-ff" style={{ marginBottom: 10 }}>
                <label className="dv-lbl">Notes (optional)</label>
                <input className="dv-input" value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder="e.g. website client, Meta ads only…" />
              </div>
              <button className="dv-btn-primary" onClick={addPayment} disabled={!payName.trim() || !payAmount}>
                Add Client
              </button>
            </div>
          )}

          {payments.length === 0 && !showPayForm ? (
            <div className="dv-empty">No payment clients yet. Add one above.</div>
          ) : (
            <div className="dv-pay-list">
              {payments.map(p => {
                const { date, daysUntil } = nextInvoiceDate(p.startDate);
                const urgent = daysUntil <= 3;
                const overdue = daysUntil < 0;
                return (
                  <div key={p.id} className={`dv-pay-row${overdue ? ' dv-pay-row--overdue' : urgent ? ' dv-pay-row--urgent' : ''}`}>
                    <div className="dv-pay-left">
                      <div className="dv-pay-name">{p.name}</div>
                      {p.notes && <div className="dv-pay-notes">{p.notes}</div>}
                    </div>
                    <div className="dv-pay-mid">
                      <div className="dv-pay-amount">{fmt$(p.amount)}<span className="dv-pay-mo">/mo</span></div>
                    </div>
                    <div className="dv-pay-right">
                      <div className={`dv-pay-due${overdue ? ' dv-pay-due--overdue' : urgent ? ' dv-pay-due--urgent' : ''}`}>
                        {overdue ? '⚠ Overdue' : `Due ${fmtDate(date)}`}
                      </div>
                      <div className="dv-pay-days">
                        {overdue ? `${Math.abs(daysUntil)}d overdue` : daysUntil === 0 ? 'Due today!' : `${daysUntil}d away`}
                      </div>
                    </div>
                    <button className="dv-pay-del" onClick={() => deletePayment(p.id)}>×</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tasks */}
        <div className="dv-panel">
          <div className="dv-panel-hdr">
            <span className="dv-panel-title">✅ Today's Tasks</span>
            <span className="dv-tasks-left">{tasks.filter(t => !t.done).length} left</span>
          </div>
          <div className="dv-task-input">
            <input
              className="dv-input"
              placeholder="Add a task…"
              value={newTask}
              onChange={e => setNewTask(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTask()}
              style={{ flex: 1 }}
            />
            <button className="dv-btn-add" onClick={addTask}>+</button>
          </div>
          <div className="dv-task-list">
            {sortedTasks.length === 0 && <div className="dv-empty">All caught up.</div>}
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

        {/* Quick links */}
        <div className="dv-panel">
          <div className="dv-panel-hdr">
            <span className="dv-panel-title">🔗 Quick Actions</span>
          </div>
          <div className="dv-quick-list">
            <button className="dv-quick-btn" onClick={() => onNavigate?.('inbox')}>
              <span className="dv-quick-icon">📬</span>
              <div>
                <div className="dv-quick-label">Go to Inbox</div>
                <div className="dv-quick-sub">{needsResponse > 0 ? `${needsResponse} need reply` : 'All caught up'}</div>
              </div>
            </button>
            <button className="dv-quick-btn" onClick={() => onNavigate?.('pipeline')}>
              <span className="dv-quick-icon">📋</span>
              <div>
                <div className="dv-quick-label">Go to Pipeline</div>
                <div className="dv-quick-sub">{hotLeads} hot leads</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const dvCss = `
.dv-root { padding: 20px; max-width: 1100px; }

.dv-welcome {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  background: rgba(139,92,246,0.07);
  border: 1px solid rgba(139,92,246,0.15);
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 20px;
}
.dv-welcome-name { font-size: 17px; font-weight: 700; color: #e8e8e7; }
.dv-welcome-date { font-size: 12px; color: #7a7a8a; margin-top: 2px; }
.dv-scalia-badge {
  background: linear-gradient(90deg, #8b5cf6, #60a5fa);
  border-radius: 8px; padding: 6px 14px;
  font-size: 11px; font-weight: 700; color: #fff;
  white-space: nowrap; flex-shrink: 0;
}

/* Stats */
.dv-stats {
  display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 20px;
}
@media (max-width: 700px) { .dv-stats { grid-template-columns: 1fr 1fr; } }

.dv-stat {
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
  border-radius: 12px; padding: 16px 14px 12px; position: relative; overflow: hidden;
}
.dv-stat--link { cursor: pointer; }
.dv-stat--link:hover { background: rgba(255,255,255,0.05); }
.dv-stat-bar {
  position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: var(--c); opacity: 0.8;
}
.dv-stat-val { font-size: 30px; font-weight: 800; color: #e8e8e7; line-height: 1; margin-bottom: 5px; }
.dv-stat-lbl { font-size: 12px; font-weight: 600; color: #7a7a8a; }

/* Grid */
.dv-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: auto auto;
  gap: 14px;
}
@media (max-width: 700px) { .dv-grid { grid-template-columns: 1fr; } }
.dv-panel--wide { grid-column: 1 / -1; }

/* Panel */
.dv-panel {
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
  border-radius: 14px; padding: 16px;
}
.dv-panel-hdr {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;
}
.dv-panel-title { font-size: 13px; font-weight: 700; color: #d4d4d3; }
.dv-tasks-left { font-size: 11px; color: #7a7a8a; background: rgba(255,255,255,0.06); border-radius: 4px; padding: 2px 7px; }

/* Inputs */
.dv-input {
  box-sizing: border-box;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);
  border-radius: 7px; color: #d4d4d3; font-size: 12px; font-family: inherit;
  padding: 8px 10px;
}
.dv-input:focus { outline: none; border-color: rgba(139,92,246,0.4); }
.dv-input::placeholder { color: #5a5a6a; }
.dv-lbl { display: block; font-size: 10px; font-weight: 700; color: #7a7a8a; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
.dv-ff { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.dv-ff--sm { flex: 0 0 140px; }
.dv-ff .dv-input { width: 100%; }

.dv-btn-ghost {
  background: none; border: 1px solid rgba(255,255,255,0.1); color: #a78bfa;
  border-radius: 6px; padding: 4px 12px; font-size: 11px; font-weight: 600;
  cursor: pointer; font-family: inherit;
}
.dv-btn-ghost:hover { background: rgba(139,92,246,0.1); }
.dv-btn-primary {
  background: linear-gradient(90deg, #8b5cf6, #60a5fa); color: #fff;
  border: none; border-radius: 7px; padding: 9px 18px; font-size: 12px; font-weight: 700;
  cursor: pointer; font-family: inherit;
}
.dv-btn-primary:hover:not(:disabled) { opacity: 0.9; }
.dv-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
.dv-btn-add {
  background: linear-gradient(90deg, #8b5cf6, #60a5fa); color: #fff;
  border: none; border-radius: 7px; font-size: 18px; font-weight: 700;
  width: 34px; height: 34px; flex-shrink: 0; cursor: pointer; line-height: 1;
}
.dv-btn-add:hover { opacity: 0.9; }

/* Payment form */
.dv-pay-form {
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
  border-radius: 10px; padding: 14px; margin-bottom: 14px;
}
.dv-pay-form-row { display: flex; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }

/* Payment list */
.dv-pay-list { display: flex; flex-direction: column; gap: 6px; }
.dv-pay-row {
  display: flex; align-items: center; gap: 10px;
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
  border-radius: 9px; padding: 11px 13px;
  transition: border-color 0.15s;
}
.dv-pay-row--urgent { border-color: rgba(245,158,11,0.3); background: rgba(245,158,11,0.04); }
.dv-pay-row--overdue { border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.04); }
.dv-pay-left { flex: 1; min-width: 0; }
.dv-pay-name { font-size: 13px; font-weight: 600; color: #e2e2e1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dv-pay-notes { font-size: 11px; color: #7a7a8a; margin-top: 1px; }
.dv-pay-mid { flex-shrink: 0; text-align: right; }
.dv-pay-amount { font-size: 14px; font-weight: 700; color: #86efac; }
.dv-pay-mo { font-size: 10px; color: #7a7a8a; margin-left: 2px; }
.dv-pay-right { flex-shrink: 0; text-align: right; }
.dv-pay-due { font-size: 12px; font-weight: 600; color: #d4d4d3; }
.dv-pay-due--urgent { color: #fcd34d; }
.dv-pay-due--overdue { color: #f87171; }
.dv-pay-days { font-size: 10px; color: #7a7a8a; margin-top: 1px; }
.dv-pay-del {
  background: none; border: none; color: #4b5563; cursor: pointer;
  font-size: 18px; line-height: 1; padding: 0 2px; flex-shrink: 0;
}
.dv-pay-del:hover { color: #f87171; }

/* Tasks */
.dv-task-input { display: flex; gap: 6px; margin-bottom: 10px; }
.dv-task-list { display: flex; flex-direction: column; gap: 4px; max-height: 220px; overflow-y: auto; }
.dv-task {
  display: flex; align-items: center; gap: 8px;
  background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);
  border-radius: 7px; padding: 7px 9px;
}
.dv-task--done .dv-task-text { text-decoration: line-through; color: #5a5a6a; }
.dv-task-check {
  width: 17px; height: 17px; border-radius: 4px; flex-shrink: 0;
  border: 1.5px solid rgba(139,92,246,0.35); background: rgba(139,92,246,0.07);
  color: #a78bfa; font-size: 10px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-family: inherit; padding: 0;
}
.dv-task--done .dv-task-check { background: rgba(139,92,246,0.22); border-color: #8b5cf6; }
.dv-task-text { flex: 1; font-size: 12px; color: #d4d4d3; line-height: 1.4; }
.dv-task-del { background: none; border: none; color: #4b5563; cursor: pointer; font-size: 16px; line-height: 1; padding: 0 2px; flex-shrink: 0; }
.dv-task-del:hover { color: #f87171; }

/* Quick actions */
.dv-quick-list { display: flex; flex-direction: column; gap: 8px; }
.dv-quick-btn {
  display: flex; align-items: center; gap: 12px;
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
  border-radius: 9px; padding: 12px 14px;
  cursor: pointer; font-family: inherit; width: 100%; text-align: left;
  transition: background 0.12s, border-color 0.12s;
}
.dv-quick-btn:hover { background: rgba(139,92,246,0.08); border-color: rgba(139,92,246,0.2); }
.dv-quick-icon { font-size: 20px; flex-shrink: 0; }
.dv-quick-label { font-size: 13px; font-weight: 600; color: #d4d4d3; }
.dv-quick-sub { font-size: 11px; color: #7a7a8a; margin-top: 1px; }

.dv-empty { font-size: 12px; color: #5a5a6a; text-align: center; padding: 14px 0; }
`;
