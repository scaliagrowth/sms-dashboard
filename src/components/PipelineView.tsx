'use client';

import { useEffect, useState } from 'react';

type Stage = 'needs-call' | 'meeting-booked' | 'closed-dead';

interface Lead {
  id: string;
  name: string;
  business: string;
  source: 'SMS' | 'Instagram DM';
  notes: string;
  stage: Stage;
  meetingDate?: string;
  createdAt: number;
}

const STORAGE_KEY = 'pipeline_leads_v1';

const STAGES: { id: Stage; label: string; color: string }[] = [
  { id: 'needs-call', label: 'Needs a Call', color: '#e8a020' },
  { id: 'meeting-booked', label: 'Meeting Booked', color: '#2a7de1' },
  { id: 'closed-dead', label: 'Closed / Dead', color: '#6b7280' },
];

const NEXT_STAGE: Record<Stage, Stage | null> = {
  'needs-call': 'meeting-booked',
  'meeting-booked': 'closed-dead',
  'closed-dead': null,
};

const MOVE_LABEL: Record<Stage, string | null> = {
  'needs-call': 'Mark as Booked →',
  'meeting-booked': 'Move to Closed →',
  'closed-dead': null,
};

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function loadLeads(): Lead[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Lead[]) : [];
  } catch {
    return [];
  }
}

function saveLeads(leads: Lead[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
}

interface AddLeadModalProps {
  onAdd: (lead: Lead) => void;
  onClose: () => void;
}

function AddLeadModal({ onAdd, onClose }: AddLeadModalProps) {
  const [name, setName] = useState('');
  const [business, setBusiness] = useState('');
  const [source, setSource] = useState<'SMS' | 'Instagram DM'>('SMS');
  const [stage, setStage] = useState<Stage>('needs-call');
  const [notes, setNotes] = useState('');
  const [meetingDate, setMeetingDate] = useState('');

  function handleSubmit() {
    if (!name.trim() || !business.trim()) return;
    const lead: Lead = {
      id: generateId(),
      name: name.trim(),
      business: business.trim(),
      source,
      notes: notes.trim(),
      stage,
      meetingDate: stage === 'meeting-booked' ? meetingDate : undefined,
      createdAt: Date.now(),
    };
    onAdd(lead);
    onClose();
  }

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="modalCard" onClick={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <h2 className="modalTitle">Add Lead</h2>
          <button className="modalClose" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="formGroup">
          <label className="formLabel">Name *</label>
          <input
            className="formInput"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="John Smith"
            autoFocus
          />
        </div>

        <div className="formGroup">
          <label className="formLabel">Business Name *</label>
          <input
            className="formInput"
            value={business}
            onChange={(e) => setBusiness(e.target.value)}
            placeholder="Smith's Auto Detail"
          />
        </div>

        <div className="formRow">
          <div className="formGroup">
            <label className="formLabel">Source</label>
            <select className="formSelect" value={source} onChange={(e) => setSource(e.target.value as 'SMS' | 'Instagram DM')}>
              <option value="SMS">SMS</option>
              <option value="Instagram DM">Instagram DM</option>
            </select>
          </div>

          <div className="formGroup">
            <label className="formLabel">Stage</label>
            <select className="formSelect" value={stage} onChange={(e) => setStage(e.target.value as Stage)}>
              {STAGES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {stage === 'meeting-booked' && (
          <div className="formGroup">
            <label className="formLabel">Meeting Date &amp; Time</label>
            <input
              className="formInput"
              type="datetime-local"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
            />
          </div>
        )}

        <div className="formGroup">
          <label className="formLabel">Notes</label>
          <textarea
            className="formTextarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any context on this lead..."
            rows={3}
          />
        </div>

        <div className="modalActions">
          <button className="btnSecondary" onClick={onClose}>Cancel</button>
          <button className="btnPrimary" onClick={handleSubmit} disabled={!name.trim() || !business.trim()}>
            Add Lead
          </button>
        </div>
      </div>
    </div>
  );
}

interface LeadCardProps {
  lead: Lead;
  onMove: (id: string, stage: Stage) => void;
  onDelete: (id: string) => void;
  onUpdateNotes: (id: string, notes: string) => void;
  onUpdateMeeting: (id: string, date: string) => void;
}

function LeadCard({ lead, onMove, onDelete, onUpdateNotes, onUpdateMeeting }: LeadCardProps) {
  const [notes, setNotes] = useState(lead.notes);
  const nextStage = NEXT_STAGE[lead.stage];
  const moveLabel = MOVE_LABEL[lead.stage];

  return (
    <div className="leadCard">
      <div className="cardHeader">
        <div>
          <div className="leadName">{lead.name}</div>
          <div className="leadBusiness">{lead.business}</div>
        </div>
        <span className={`sourceBadge sourceBadge--${lead.source === 'SMS' ? 'sms' : 'ig'}`}>
          {lead.source}
        </span>
      </div>

      {lead.stage === 'meeting-booked' && (
        <div className="meetingRow">
          <span className="meetingLabel">📅 Meeting</span>
          <input
            className="meetingInput"
            type="datetime-local"
            defaultValue={lead.meetingDate || ''}
            onBlur={(e) => onUpdateMeeting(lead.id, e.target.value)}
          />
        </div>
      )}

      <textarea
        className="notesArea"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => onUpdateNotes(lead.id, notes)}
        placeholder="Add notes..."
        rows={2}
      />

      <div className="cardActions">
        {nextStage && moveLabel && (
          <button className="btnMove" onClick={() => onMove(lead.id, nextStage)}>
            {moveLabel}
          </button>
        )}
        <button className="btnDelete" onClick={() => onDelete(lead.id)} aria-label="Delete lead">
          Delete
        </button>
      </div>
    </div>
  );
}

export function PipelineView() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    setLeads(loadLeads());
  }, []);

  function updateLeads(updated: Lead[]) {
    setLeads(updated);
    saveLeads(updated);
  }

  function handleAdd(lead: Lead) {
    updateLeads([...leads, lead]);
  }

  function handleMove(id: string, newStage: Stage) {
    updateLeads(leads.map((l) => (l.id === id ? { ...l, stage: newStage } : l)));
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this lead?')) return;
    updateLeads(leads.filter((l) => l.id !== id));
  }

  function handleUpdateNotes(id: string, notes: string) {
    updateLeads(leads.map((l) => (l.id === id ? { ...l, notes } : l)));
  }

  function handleUpdateMeeting(id: string, meetingDate: string) {
    updateLeads(leads.map((l) => (l.id === id ? { ...l, meetingDate } : l)));
  }

  return (
    <div className="pipelineView">
      <style>{`
        .pipelineView {
          padding: 20px;
          min-height: 100%;
        }
        .pipelineTopBar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .pipelineTitle {
          font-size: 16px;
          font-weight: 500;
          color: var(--color-text-primary, #f0f0ef);
          margin: 0;
        }
        .pipelineSubtitle {
          font-size: 12px;
          color: var(--color-text-secondary, #9ca3af);
          margin: 2px 0 0;
        }
        .btnAddLead {
          background: #2a7de1;
          color: #fff;
          border: none;
          border-radius: 6px;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
        }
        .btnAddLead:hover { background: #1e6bcf; }

        .pipelineColumns {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          align-items: start;
        }
        @media (max-width: 760px) {
          .pipelineColumns { grid-template-columns: 1fr; }
        }

        .column {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          overflow: hidden;
        }
        .columnHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .columnLabel {
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text-primary, #f0f0ef);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .columnDot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .columnCount {
          font-size: 11px;
          color: var(--color-text-secondary, #9ca3af);
          background: rgba(255,255,255,0.07);
          border-radius: 4px;
          padding: 1px 7px;
        }
        .columnBody {
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          min-height: 120px;
        }
        .emptyColumn {
          color: var(--color-text-secondary, #6b7280);
          font-size: 12px;
          text-align: center;
          padding: 24px 0;
        }

        .leadCard {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 8px;
          padding: 12px;
        }
        .cardHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 8px;
          gap: 8px;
        }
        .leadName {
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text-primary, #f0f0ef);
          line-height: 1.3;
        }
        .leadBusiness {
          font-size: 12px;
          color: var(--color-text-secondary, #9ca3af);
          margin-top: 2px;
        }
        .sourceBadge {
          font-size: 10px;
          font-weight: 500;
          border-radius: 4px;
          padding: 2px 7px;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .sourceBadge--sms {
          background: rgba(42,125,225,0.2);
          color: #7eb8f7;
          border: 1px solid rgba(42,125,225,0.3);
        }
        .sourceBadge--ig {
          background: rgba(200,80,180,0.15);
          color: #e78fd4;
          border: 1px solid rgba(200,80,180,0.25);
        }

        .meetingRow {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .meetingLabel {
          font-size: 11px;
          color: var(--color-text-secondary, #9ca3af);
          white-space: nowrap;
        }
        .meetingInput {
          font-size: 11px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 5px;
          color: var(--color-text-primary, #f0f0ef);
          padding: 3px 7px;
          flex: 1;
          min-width: 0;
          color-scheme: dark;
        }

        .notesArea {
          width: 100%;
          box-sizing: border-box;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 5px;
          color: var(--color-text-primary, #e5e5e4);
          font-size: 12px;
          font-family: inherit;
          padding: 6px 8px;
          resize: vertical;
          margin-bottom: 10px;
          line-height: 1.5;
        }
        .notesArea::placeholder { color: rgba(255,255,255,0.25); }
        .notesArea:focus { outline: none; border-color: rgba(42,125,225,0.5); }

        .cardActions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .btnMove {
          font-size: 11px;
          font-weight: 500;
          color: #7eb8f7;
          background: rgba(42,125,225,0.12);
          border: 1px solid rgba(42,125,225,0.25);
          border-radius: 5px;
          padding: 4px 10px;
          cursor: pointer;
          white-space: nowrap;
        }
        .btnMove:hover { background: rgba(42,125,225,0.22); }
        .btnDelete {
          font-size: 11px;
          color: rgba(255,255,255,0.3);
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px 6px;
          border-radius: 4px;
        }
        .btnDelete:hover { color: #f87171; background: rgba(248,113,113,0.1); }

        /* Modal */
        .modalOverlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.65);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 16px;
        }
        .modalCard {
          background: #1a1a1a;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 12px;
          padding: 24px;
          width: 100%;
          max-width: 440px;
          max-height: 90vh;
          overflow-y: auto;
        }
        .modalHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .modalTitle {
          font-size: 16px;
          font-weight: 500;
          color: var(--color-text-primary, #f0f0ef);
          margin: 0;
        }
        .modalClose {
          background: none;
          border: none;
          color: var(--color-text-secondary, #9ca3af);
          font-size: 22px;
          cursor: pointer;
          line-height: 1;
          padding: 0 4px;
        }
        .modalClose:hover { color: var(--color-text-primary, #f0f0ef); }

        .formGroup {
          margin-bottom: 14px;
        }
        .formRow {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .formLabel {
          display: block;
          font-size: 12px;
          font-weight: 500;
          color: var(--color-text-secondary, #9ca3af);
          margin-bottom: 5px;
        }
        .formInput, .formSelect, .formTextarea {
          width: 100%;
          box-sizing: border-box;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 6px;
          color: var(--color-text-primary, #f0f0ef);
          font-size: 13px;
          font-family: inherit;
          padding: 8px 10px;
          color-scheme: dark;
        }
        .formInput:focus, .formSelect:focus, .formTextarea:focus {
          outline: none;
          border-color: rgba(42,125,225,0.6);
        }
        .formSelect option { background: #1a1a1a; }
        .formTextarea { resize: vertical; }

        .modalActions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 20px;
        }
        .btnPrimary {
          background: #2a7de1;
          color: #fff;
          border: none;
          border-radius: 6px;
          padding: 8px 18px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
        }
        .btnPrimary:hover:not(:disabled) { background: #1e6bcf; }
        .btnPrimary:disabled { opacity: 0.4; cursor: not-allowed; }
        .btnSecondary {
          background: rgba(255,255,255,0.07);
          color: var(--color-text-secondary, #9ca3af);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 6px;
          padding: 8px 18px;
          font-size: 13px;
          cursor: pointer;
        }
        .btnSecondary:hover { background: rgba(255,255,255,0.12); }
      `}</style>

      <div className="pipelineTopBar">
        <div>
          <h2 className="pipelineTitle">Pipeline</h2>
          <p className="pipelineSubtitle">Track leads from first contact to close.</p>
        </div>
        <button className="btnAddLead" onClick={() => setShowModal(true)}>
          + Add Lead
        </button>
      </div>

      <div className="pipelineColumns">
        {STAGES.map((stage) => {
          const stageLeads = leads.filter((l) => l.stage === stage.id);
          return (
            <div key={stage.id} className="column">
              <div className="columnHeader">
                <span className="columnLabel">
                  <span className="columnDot" style={{ background: stage.color }} />
                  {stage.label}
                </span>
                <span className="columnCount">{stageLeads.length}</span>
              </div>
              <div className="columnBody">
                {stageLeads.length === 0 ? (
                  <div className="emptyColumn">No leads here yet</div>
                ) : (
                  stageLeads.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      onMove={handleMove}
                      onDelete={handleDelete}
                      onUpdateNotes={handleUpdateNotes}
                      onUpdateMeeting={handleUpdateMeeting}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showModal && <AddLeadModal onAdd={handleAdd} onClose={() => setShowModal(false)} />}
    </div>
  );
}
