'use client';

import { useEffect, useState, useCallback } from 'react';

type Stage = 'needs-call' | 'meeting-booked' | 'closed' | 'dead';
type Source = 'SMS' | 'Instagram DM' | 'Cold Call';

interface Lead {
  id: string;
  name: string;
  business: string;
  phone?: string;
  source: Source;
  stage: Stage;
  notes: string;
  meetingDate?: string;
  meetingHour?: string;
  meetingMinute?: string;
  createdAt: string;
  rowNumber: number;
}

const STAGES: { id: Stage; label: string; color: string }[] = [
  { id: 'needs-call',     label: 'Needs a Call',   color: '#a78bfa' },
  { id: 'meeting-booked', label: 'Meeting Booked',  color: '#60a5fa' },
  { id: 'closed',         label: 'Closed',          color: '#22c55e' },
  { id: 'dead',           label: 'Dead',            color: '#ef4444' },
];

const NEXT_STAGE: Record<Stage, Stage | null> = {
  'needs-call':     'meeting-booked',
  'meeting-booked': 'closed',
  'closed':         null,
  'dead':           null,
};

const MOVE_LABEL: Record<Stage, string | null> = {
  'needs-call':     'Mark as Booked →',
  'meeting-booked': 'Mark as Closed →',
  'closed':         null,
  'dead':           null,
};

const HOURS = Array.from({ length: 17 }, (_, i) => {
  const h = i + 6;
  const label = h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`;
  return { label, value: String(h).padStart(2, '0') };
});

const MINUTES = [
  { label: ':00', value: '00' },
  { label: ':15', value: '15' },
  { label: ':30', value: '30' },
  { label: ':45', value: '45' },
];

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

function fmtMeeting(lead: Lead) {
  const parts: string[] = [];
  if (lead.meetingDate) {
    const d = new Date(lead.meetingDate + 'T12:00:00');
    parts.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
  }
  if (lead.meetingHour) {
    const h = parseInt(lead.meetingHour);
    const m = lead.meetingMinute || '00';
    const label = h === 12 ? `12:${m} PM` : h < 12 ? `${h}:${m} AM` : `${h - 12}:${m} PM`;
    parts.push(label);
  }
  return parts.length ? parts.join(' at ') : null;
}

function sourceBadgeClass(source: Source) {
  if (source === 'SMS') return 'plSourceBadge--sms';
  if (source === 'Instagram DM') return 'plSourceBadge--ig';
  return 'plSourceBadge--call';
}

/* ─── API helpers ─── */
async function apiGet(): Promise<Lead[]> {
  const res = await fetch('/api/pipeline', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load pipeline.');
  const data = await res.json();
  return data.leads ?? [];
}

async function apiAdd(lead: Omit<Lead, 'rowNumber'>): Promise<Lead> {
  const res = await fetch('/api/pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lead),
  });
  if (!res.ok) throw new Error('Failed to add lead.');
  const data = await res.json();
  return data.lead;
}

async function apiUpdate(lead: Lead): Promise<void> {
  const res = await fetch(`/api/pipeline/${lead.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lead),
  });
  if (!res.ok) throw new Error('Failed to update lead.');
}

async function apiDelete(id: string): Promise<void> {
  const res = await fetch(`/api/pipeline/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete lead.');
}

/* ─── Add Lead Modal ─── */
function AddLeadModal({ onAdd, onClose }: { onAdd: (l: Omit<Lead, 'rowNumber'>) => void; onClose: () => void }) {
  const [name, setName] = useState('');
  const [business, setBusiness] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState<Source>('SMS');
  const [stage, setStage] = useState<Stage>('needs-call');
  const [notes, setNotes] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingHour, setMeetingHour] = useState('09');
  const [meetingMinute, setMeetingMinute] = useState('00');

  function submit() {
    if (!name.trim() || !business.trim()) return;
    onAdd({
      id: uid(),
      name: name.trim(),
      business: business.trim(),
      phone: phone.trim() || undefined,
      source,
      stage,
      notes: notes.trim(),
      meetingDate: stage === 'meeting-booked' ? meetingDate : undefined,
      meetingHour: stage === 'meeting-booked' ? meetingHour : undefined,
      meetingMinute: stage === 'meeting-booked' ? meetingMinute : undefined,
      createdAt: new Date().toISOString(),
    });
    onClose();
  }

  return (
    <div className="plOverlay" onClick={onClose}>
      <div className="plModal" onClick={e => e.stopPropagation()}>
        <div className="plModalHeader">
          <span className="plModalTitle">Add Lead</span>
          <button className="plModalClose" onClick={onClose}>×</button>
        </div>
        <div className="plField">
          <label className="plLabel">Name *</label>
          <input className="plInput" value={name} onChange={e => setName(e.target.value)} placeholder="John Smith" autoFocus />
        </div>
        <div className="plField">
          <label className="plLabel">Business *</label>
          <input className="plInput" value={business} onChange={e => setBusiness(e.target.value)} placeholder="Smith's Auto Detail" />
        </div>
        <div className="plField">
          <label className="plLabel">Phone (optional)</label>
          <input className="plInput" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" />
        </div>
        <div className="plRow">
          <div className="plField">
            <label className="plLabel">Source</label>
            <select className="plSelect" value={source} onChange={e => setSource(e.target.value as Source)}>
              <option value="SMS">SMS</option>
              <option value="Instagram DM">Instagram DM</option>
              <option value="Cold Call">Cold Call</option>
            </select>
          </div>
          <div className="plField">
            <label className="plLabel">Stage</label>
            <select className="plSelect" value={stage} onChange={e => setStage(e.target.value as Stage)}>
              {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>
        {stage === 'meeting-booked' && (
          <div className="plField">
            <label className="plLabel">Meeting Date &amp; Time</label>
            <div className="plTimeRow">
              <input className="plInput plDateInput" type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} />
              <select className="plSelect plTimeSelect" value={meetingHour} onChange={e => setMeetingHour(e.target.value)}>
                {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
              </select>
              <select className="plSelect plMinSelect" value={meetingMinute} onChange={e => setMeetingMinute(e.target.value)}>
                {MINUTES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>
        )}
        <div className="plField">
          <label className="plLabel">Notes</label>
          <textarea className="plTextarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any context on this lead..." rows={3} />
        </div>
        <div className="plModalActions">
          <button className="plBtnSecondary" onClick={onClose}>Cancel</button>
          <button className="plBtnPrimary" onClick={submit} disabled={!name.trim() || !business.trim()}>Add Lead</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Lead Profile ─── */
function LeadProfile({
  lead, onBack, onSave, onMove, onDelete, onGoToSMS,
}: {
  lead: Lead; onBack: () => void;
  onSave: (l: Lead) => Promise<void>;
  onMove: (id: string, stage: Stage) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onGoToSMS: (phone: string) => void;
}) {
  const [notes, setNotes] = useState(lead.notes);
  const [meetingDate, setMeetingDate] = useState(lead.meetingDate || '');
  const [meetingHour, setMeetingHour] = useState(lead.meetingHour || '09');
  const [meetingMinute, setMeetingMinute] = useState(lead.meetingMinute || '00');
  const [saving, setSaving] = useState(false);

  const stageInfo = STAGES.find(s => s.id === lead.stage)!;
  const nextStage = NEXT_STAGE[lead.stage];
  const moveLabel = MOVE_LABEL[lead.stage];

  async function saveNotes() {
    setSaving(true);
    await onSave({ ...lead, notes });
    setSaving(false);
  }
  async function saveMeeting() {
    setSaving(true);
    await onSave({ ...lead, meetingDate, meetingHour, meetingMinute });
    setSaving(false);
  }

  return (
    <div className="plProfile">
      <div className="plProfileTopBar">
        <button className="plBackBtn" onClick={onBack}>← Back to Pipeline</button>
        <button className="plDeleteBtn" onClick={async () => {
          if (confirm('Delete this lead?')) { await onDelete(lead.id); onBack(); }
        }}>Delete lead</button>
      </div>
      <div className="plProfileCard">
        <div className="plProfileHeader">
          <div>
            <div className="plProfileName">{lead.name}</div>
            <div className="plProfileBusiness">{lead.business}</div>
            {lead.phone && <div className="plProfilePhone">{lead.phone}</div>}
          </div>
          <div className="plProfileBadges">
            <span className={`plSourceBadge ${sourceBadgeClass(lead.source)}`}>{lead.source}</span>
            <span className="plStagePill" style={{ background: stageInfo.color + '22', color: stageInfo.color, border: `1px solid ${stageInfo.color}44` }}>
              {stageInfo.label}
            </span>
          </div>
        </div>

        {lead.source === 'SMS' && lead.phone && (
          <div className="plProfileSection">
            <button className="plSmsBtn" onClick={() => onGoToSMS(lead.phone!)}>
              💬 View SMS conversation
            </button>
          </div>
        )}

        {lead.stage === 'meeting-booked' && (
          <div className="plProfileSection">
            <div className="plSectionLabel">Meeting date &amp; time</div>
            <div className="plTimeRow">
              <input className="plInput plDateInput" type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} onBlur={saveMeeting} />
              <select className="plSelect plTimeSelect" value={meetingHour} onChange={e => setMeetingHour(e.target.value)} onBlur={saveMeeting}>
                {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
              </select>
              <select className="plSelect plMinSelect" value={meetingMinute} onChange={e => setMeetingMinute(e.target.value)} onBlur={saveMeeting}>
                {MINUTES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>
        )}

        <div className="plProfileSection">
          <div className="plSectionLabel">Notes {saving ? '· Saving…' : ''}</div>
          <textarea className="plTextarea plProfileNotes" value={notes} onChange={e => setNotes(e.target.value)} onBlur={saveNotes} placeholder="Add notes about this lead..." rows={10} />
        </div>

        <div className="plProfileActions">
          {nextStage && moveLabel && (
            <button className="plMoveBtn plMoveBtnLarge" onClick={async () => { await onMove(lead.id, nextStage); onBack(); }}>
              {moveLabel}
            </button>
          )}
          {lead.stage !== 'dead' && (
            <button className="plDeadBtn" onClick={async () => { await onMove(lead.id, 'dead'); onBack(); }}>
              Mark as Dead
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Lead Card ─── */
function LeadCard({
  lead, onMove, onDelete, onSaveNotes, onOpenProfile, isDragging, onDragStart, onGoToSMS,
}: {
  lead: Lead;
  onMove: (id: string, stage: Stage) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSaveNotes: (id: string, notes: string) => Promise<void>;
  onOpenProfile: (lead: Lead) => void;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onGoToSMS: (phone: string) => void;
}) {
  const [notes, setNotes] = useState(lead.notes);
  const nextStage = NEXT_STAGE[lead.stage];
  const moveLabel = MOVE_LABEL[lead.stage];
  const meeting = fmtMeeting(lead);

  return (
    <div className={`plCard${isDragging ? ' plCard--dragging' : ''}`} draggable onDragStart={e => onDragStart(e, lead.id)}>
      <div className="plCardHeader" onClick={() => onOpenProfile(lead)} style={{ cursor: 'pointer' }}>
        <div>
          <div className="plCardName">{lead.name}</div>
          <div className="plCardBusiness">{lead.business}</div>
        </div>
        <span className={`plSourceBadge ${sourceBadgeClass(lead.source)}`}>{lead.source}</span>
      </div>

      {meeting && <div className="plMeetingChip">📅 {meeting}</div>}

      {lead.source === 'SMS' && lead.phone && (
        <button className="plCardSmsBtn" onClick={e => { e.stopPropagation(); onGoToSMS(lead.phone!); }}>
          💬 Open SMS convo
        </button>
      )}

      <textarea
        className="plNotesArea"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        onBlur={() => onSaveNotes(lead.id, notes)}
        onClick={e => e.stopPropagation()}
        placeholder="Add notes..."
        rows={2}
      />

      <div className="plCardActions">
        {nextStage && moveLabel && (
          <button className="plMoveBtn" onClick={e => { e.stopPropagation(); onMove(lead.id, nextStage); }}>
            {moveLabel}
          </button>
        )}
        {lead.stage !== 'dead' && (
          <button className="plMoveBtn plDeadBtnSm" onClick={e => { e.stopPropagation(); onMove(lead.id, 'dead'); }}>
            Dead
          </button>
        )}
        <button className="plDeleteCardBtn" onClick={e => { e.stopPropagation(); if (confirm('Delete?')) onDelete(lead.id); }}>
          ×
        </button>
      </div>
    </div>
  );
}

/* ─── Pipeline View ─── */
export function PipelineView({ onGoToSMS }: { onGoToSMS?: (phone: string) => void }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [profileLead, setProfileLead] = useState<Lead | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<Stage | null>(null);

  const loadLeads = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiGet();
      setLeads(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load pipeline.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'n' && !showModal && !profileLead) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') setShowModal(true);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showModal, profileLead]);

  async function handleAdd(lead: Omit<Lead, 'rowNumber'>) {
    // Optimistic: add locally first so it feels instant
    const optimistic = { ...lead, rowNumber: -1 };
    setLeads(prev => [...prev, optimistic]);
    try {
      const saved = await apiAdd(lead);
      setLeads(prev => prev.map(l => l.id === lead.id ? saved : l));
    } catch {
      setLeads(prev => prev.filter(l => l.id !== lead.id));
      alert('Failed to save lead. Try again.');
    }
  }

  async function handleMove(id: string, stage: Stage) {
    const lead = leads.find(l => l.id === id);
    if (!lead) return;
    const updated = { ...lead, stage };
    setLeads(prev => prev.map(l => l.id === id ? updated : l));
    try {
      await apiUpdate(updated);
    } catch {
      setLeads(prev => prev.map(l => l.id === id ? lead : l));
      alert('Failed to update lead.');
    }
  }

  async function handleSave(updated: Lead) {
    setLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
    if (profileLead?.id === updated.id) setProfileLead(updated);
    await apiUpdate(updated);
  }

  async function handleSaveNotes(id: string, notes: string) {
    const lead = leads.find(l => l.id === id);
    if (!lead) return;
    const updated = { ...lead, notes };
    setLeads(prev => prev.map(l => l.id === id ? updated : l));
    await apiUpdate(updated);
  }

  async function handleDelete(id: string) {
    setLeads(prev => prev.filter(l => l.id !== id));
    try {
      await apiDelete(id);
    } catch {
      alert('Failed to delete lead. Refresh and try again.');
      loadLeads();
    }
  }

  function onDragStart(e: React.DragEvent, id: string) { setDraggingId(id); e.dataTransfer.effectAllowed = 'move'; }
  function onDragOver(e: React.DragEvent, stage: Stage) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverStage(stage); }
  function onDrop(e: React.DragEvent, stage: Stage) { e.preventDefault(); if (draggingId) handleMove(draggingId, stage); setDraggingId(null); setDragOverStage(null); }
  function onDragEnd() { setDraggingId(null); setDragOverStage(null); }

  function goToSMS(phone: string) { onGoToSMS?.(phone); }

  if (profileLead) {
    const live = leads.find(l => l.id === profileLead.id) || profileLead;
    return (
      <>
        <style>{css}</style>
        <LeadProfile
          lead={live} onBack={() => setProfileLead(null)}
          onSave={handleSave} onMove={handleMove}
          onDelete={handleDelete} onGoToSMS={goToSMS}
        />
      </>
    );
  }

  return (
    <>
      <style>{css}</style>
      <div className="plView">
        <div className="plTopBar">
          <div>
            <div className="plViewTitle">Pipeline</div>
            <div className="plViewSub">
              {loading ? 'Loading…' : `${leads.length} leads · Press `}
              {!loading && <kbd className="plKbd">N</kbd>}
              {!loading && ' to add'}
            </div>
          </div>
          <button className="plAddBtn" onClick={() => setShowModal(true)}>+ Add Lead</button>
        </div>

        {error && <div className="plError">{error}</div>}

        <div className="plColumns">
          {STAGES.map(stage => {
            const stageLeads = leads.filter(l => l.stage === stage.id);
            const isOver = dragOverStage === stage.id;
            return (
              <div key={stage.id}
                className={`plColumn${isOver ? ' plColumn--over' : ''}`}
                style={{ '--col-color': stage.color } as React.CSSProperties}
                onDragOver={e => onDragOver(e, stage.id)}
                onDrop={e => onDrop(e, stage.id)}
                onDragLeave={() => setDragOverStage(null)}
                onDragEnd={onDragEnd}
              >
                <div className="plColHeader">
                  <span className="plColLabel">
                    <span className="plColDot" style={{ background: stage.color }} />
                    {stage.label}
                  </span>
                  <span className="plColCount">{stageLeads.length}</span>
                </div>
                <div className="plColBody">
                  {loading
                    ? <div className="plEmpty">Loading…</div>
                    : stageLeads.length === 0
                    ? <div className="plEmpty">Drop leads here</div>
                    : stageLeads.map(lead => (
                      <LeadCard
                        key={lead.id} lead={lead}
                        onMove={handleMove} onDelete={handleDelete}
                        onSaveNotes={handleSaveNotes}
                        onOpenProfile={setProfileLead}
                        isDragging={draggingId === lead.id}
                        onDragStart={onDragStart}
                        onGoToSMS={goToSMS}
                      />
                    ))
                  }
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {showModal && <AddLeadModal onAdd={handleAdd} onClose={() => setShowModal(false)} />}
    </>
  );
}

const css = `
.plView { padding: 20px; min-height: 100%; }
.plTopBar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.plViewTitle { font-size: 16px; font-weight: 600; color: #d4d4d3; }
.plViewSub { font-size: 12px; color: #7a7a8a; margin-top: 2px; }
.plKbd { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 4px; padding: 1px 5px; font-size: 11px; color: #a78bfa; font-family: inherit; }
.plError { background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.25); border-radius: 8px; padding: 10px 14px; color: #f87171; font-size: 13px; margin-bottom: 14px; }
.plAddBtn { background: linear-gradient(90deg, #8b5cf6 0%, #60a5fa 100%); color: #fff; border: none; border-radius: 10px; padding: 9px 18px; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 16px rgba(139,92,246,0.25); white-space: nowrap; font-family: inherit; }
.plAddBtn:hover { opacity: 0.9; }
.plColumns { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; align-items: start; }
@media (max-width: 900px) { .plColumns { grid-template-columns: repeat(2,1fr); } }
@media (max-width: 500px) { .plColumns { grid-template-columns: 1fr; } }
.plColumn { background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; overflow: hidden; transition: border-color 0.15s, box-shadow 0.15s; }
.plColumn--over { border-color: var(--col-color, #8b5cf6); box-shadow: 0 0 0 2px color-mix(in srgb, var(--col-color, #8b5cf6) 20%, transparent); }
.plColHeader { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.06); }
.plColLabel { font-size: 13px; font-weight: 600; color: #d4d4d3; display: flex; align-items: center; gap: 8px; }
.plColDot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.plColCount { font-size: 11px; color: #7a7a8a; background: rgba(255,255,255,0.06); border-radius: 4px; padding: 2px 7px; }
.plColBody { padding: 10px; display: flex; flex-direction: column; gap: 8px; min-height: 100px; }
.plEmpty { color: #7a7a8a; font-size: 12px; text-align: center; padding: 28px 0; border: 1px dashed rgba(255,255,255,0.08); border-radius: 8px; }
.plCard { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px; cursor: grab; transition: opacity 0.15s, box-shadow 0.15s; user-select: none; }
.plCard:active { cursor: grabbing; }
.plCard--dragging { opacity: 0.35; }
.plCard:hover { box-shadow: 0 4px 18px rgba(0,0,0,0.35); }
.plCardHeader { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 8px; gap: 8px; }
.plCardName { font-size: 13px; font-weight: 600; color: #d4d4d3; line-height: 1.3; }
.plCardBusiness { font-size: 12px; color: #7a7a8a; margin-top: 2px; }
.plSourceBadge { font-size: 10px; font-weight: 600; border-radius: 5px; padding: 2px 8px; white-space: nowrap; flex-shrink: 0; }
.plSourceBadge--sms  { background: rgba(96,165,250,0.15); color: #93c5fd; border: 1px solid rgba(96,165,250,0.25); }
.plSourceBadge--ig   { background: rgba(167,139,250,0.15); color: #c4b5fd; border: 1px solid rgba(167,139,250,0.25); }
.plSourceBadge--call { background: rgba(34,197,94,0.12); color: #86efac; border: 1px solid rgba(34,197,94,0.22); }
.plMeetingChip { font-size: 11px; color: #93c5fd; margin-bottom: 8px; background: rgba(96,165,250,0.08); border-radius: 5px; padding: 4px 8px; }
.plCardSmsBtn { width: 100%; margin-bottom: 8px; padding: 5px 10px; font-size: 11px; font-weight: 600; background: rgba(96,165,250,0.1); border: 1px solid rgba(96,165,250,0.22); border-radius: 6px; color: #93c5fd; cursor: pointer; font-family: inherit; text-align: left; }
.plCardSmsBtn:hover { background: rgba(96,165,250,0.2); }
.plNotesArea { width: 100%; box-sizing: border-box; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; color: #d4d4d3; font-size: 12px; font-family: inherit; padding: 6px 8px; resize: vertical; margin-bottom: 8px; line-height: 1.5; }
.plNotesArea::placeholder { color: rgba(255,255,255,0.2); }
.plNotesArea:focus { outline: none; border-color: rgba(139,92,246,0.4); }
.plCardActions { display: flex; align-items: center; gap: 6px; }
.plMoveBtn { font-size: 11px; font-weight: 600; color: #c4b5fd; background: rgba(139,92,246,0.12); border: 1px solid rgba(139,92,246,0.25); border-radius: 6px; padding: 4px 10px; cursor: pointer; white-space: nowrap; font-family: inherit; flex: 1; }
.plMoveBtn:hover { background: rgba(139,92,246,0.22); }
.plMoveBtnLarge { width: 100%; padding: 12px; font-size: 14px; border-radius: 10px; text-align: center; font-family: inherit; margin-bottom: 8px; }
.plDeadBtnSm { background: rgba(239,68,68,0.1) !important; border-color: rgba(239,68,68,0.25) !important; color: #fca5a5 !important; flex: none !important; }
.plDeadBtnSm:hover { background: rgba(239,68,68,0.2) !important; }
.plDeleteCardBtn { font-size: 16px; color: rgba(255,255,255,0.2); background: none; border: none; cursor: pointer; padding: 2px 6px; border-radius: 4px; line-height: 1; margin-left: auto; }
.plDeleteCardBtn:hover { color: #f87171; background: rgba(248,113,113,0.1); }
.plProfile { padding: 20px; min-height: 100%; }
.plProfileTopBar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.plBackBtn { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #d4d4d3; border-radius: 8px; padding: 8px 14px; font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit; }
.plBackBtn:hover { background: rgba(255,255,255,0.09); }
.plDeleteBtn { background: none; border: 1px solid rgba(248,113,113,0.25); color: #f87171; border-radius: 8px; padding: 8px 14px; font-size: 13px; cursor: pointer; font-family: inherit; }
.plDeleteBtn:hover { background: rgba(248,113,113,0.1); }
.plProfileCard { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 28px; max-width: 700px; }
.plProfileHeader { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.07); }
.plProfileName { font-size: 24px; font-weight: 700; color: #e8e8e7; line-height: 1.2; }
.plProfileBusiness { font-size: 15px; color: #7a7a8a; margin-top: 5px; }
.plProfilePhone { font-size: 13px; color: #7a7a8a; margin-top: 3px; }
.plProfileBadges { display: flex; gap: 8px; align-items: center; flex-shrink: 0; flex-wrap: wrap; }
.plStagePill { font-size: 12px; font-weight: 600; border-radius: 999px; padding: 4px 12px; white-space: nowrap; }
.plProfileSection { margin-bottom: 20px; }
.plProfileActions { display: flex; flex-direction: column; gap: 8px; }
.plDeadBtn { width: 100%; padding: 11px; font-size: 13px; font-weight: 600; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25); border-radius: 10px; color: #fca5a5; cursor: pointer; font-family: inherit; }
.plDeadBtn:hover { background: rgba(239,68,68,0.18); }
.plSectionLabel { font-size: 11px; font-weight: 700; color: #7a7a8a; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 8px; }
.plProfileNotes { width: 100%; box-sizing: border-box; font-size: 14px; line-height: 1.7; }
.plSmsBtn { width: 100%; padding: 10px 14px; font-size: 13px; font-weight: 600; background: rgba(96,165,250,0.1); border: 1px solid rgba(96,165,250,0.25); border-radius: 10px; color: #93c5fd; cursor: pointer; font-family: inherit; text-align: left; }
.plSmsBtn:hover { background: rgba(96,165,250,0.18); }
.plOverlay { position: fixed; inset: 0; background: rgba(0,0,0,0.72); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px; }
.plModal { background: #14141c; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 24px; width: 100%; max-width: 460px; max-height: 90vh; overflow-y: auto; }
.plModalHeader { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.plModalTitle { font-size: 16px; font-weight: 600; color: #d4d4d3; }
.plModalClose { background: none; border: none; color: #7a7a8a; font-size: 22px; cursor: pointer; line-height: 1; padding: 0 4px; }
.plModalClose:hover { color: #d4d4d3; }
.plField { margin-bottom: 14px; }
.plRow { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.plLabel { display: block; font-size: 11px; font-weight: 700; color: #7a7a8a; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.06em; }
.plInput, .plSelect, .plTextarea { width: 100%; box-sizing: border-box; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #d4d4d3; font-size: 13px; font-family: inherit; padding: 9px 11px; color-scheme: dark; }
.plInput:focus, .plSelect:focus, .plTextarea:focus { outline: none; border-color: rgba(139,92,246,0.5); }
.plSelect option { background: #14141c; }
.plTextarea { resize: vertical; }
.plTimeRow { display: flex; gap: 8px; align-items: center; }
.plDateInput { flex: 2; }
.plTimeSelect { flex: 1.2; }
.plMinSelect { flex: 0.9; }
.plModalActions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
.plBtnPrimary { background: linear-gradient(90deg, #8b5cf6 0%, #60a5fa 100%); color: #fff; border: none; border-radius: 8px; padding: 9px 20px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
.plBtnPrimary:hover:not(:disabled) { opacity: 0.9; }
.plBtnPrimary:disabled { opacity: 0.4; cursor: not-allowed; }
.plBtnSecondary { background: rgba(255,255,255,0.05); color: #7a7a8a; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 9px 20px; font-size: 13px; cursor: pointer; font-family: inherit; }
.plBtnSecondary:hover { background: rgba(255,255,255,0.09); }
`;
