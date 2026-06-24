'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatPhoneDisplay } from '@/lib/phone';
import type { ConversationDetail, LeadUpdateInput } from '@/lib/types';

type Props = {
  detail: ConversationDetail | null;
  onUpdated?: () => Promise<void>;
};

function isHot(responseType: string | null | undefined) {
  return (responseType || '').trim().toLowerCase() === 'highly interested';
}

export function LeadDetailsPanel({ detail, onUpdated }: Props) {
  const [form, setForm] = useState<LeadUpdateInput>({
    phone: '',
    businessName: '',
    niche: '',
    responseType: '',
    settingCallBooked: '',
    zoomBooked: '',
    showed: '',
    closed: '',
    notes: '',
    nextFollowUpAt: '',
    markDnc: false,
    removeDnc: false,
  });
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      phone: detail?.conversation.phone || '',
      businessName: detail?.lead?.businessName || detail?.conversation.businessName || '',
      niche: detail?.lead?.niche || detail?.conversation.niche || '',
      responseType: detail?.lead?.responseType === 'DNC' ? '' : detail?.lead?.responseType || '',
      settingCallBooked: detail?.lead?.settingCallBooked || '',
      zoomBooked: detail?.lead?.zoomBooked || '',
      showed: detail?.lead?.showed || '',
      closed: detail?.lead?.closed || '',
      notes: detail?.lead?.notes || '',
      nextFollowUpAt: '',
      markDnc: detail?.lead?.responseType === 'DNC',
      removeDnc: false,
    });
    setSaveMessage(null);
    setSaveError(null);
  }, [detail]);

  const workflowLabel = useMemo(() => {
    if (detail?.conversation.workflowStatus === 'dnc') return 'DNC';
    if (detail?.conversation.workflowStatus === 'closed') return 'Closed';
    if (detail?.conversation.workflowStatus === 'follow-up') return 'Follow up';
    return 'Active';
  }, [detail?.conversation.workflowStatus]);

  if (!detail) {
    return (
      <aside className="detailsPanel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#7a7a8a', fontSize: '13px' }}>Select a conversation</span>
      </aside>
    );
  }

  async function handleSave(overrides?: Partial<LeadUpdateInput>, successMessage?: string) {
    if (!detail) return;
    const nextForm = { ...form, ...overrides };
    try {
      setSaving(true);
      setSaveError(null);
      setSaveMessage(null);
      const response = await fetch('/api/leads/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          ...nextForm,
          phone: detail.conversation.phone,
          nextFollowUpAt: nextForm.nextFollowUpAt ? new Date(nextForm.nextFollowUpAt).toISOString() : '',
        }),
      });
      const result = await response.json();
      if (result.success && result.updatedLead) {
        setForm({ ...nextForm, responseType: result.updatedLead.responseType });
      }
      if (!response.ok) throw new Error(result.error || 'Failed to update.');
      setForm(nextForm);
      setSaveMessage(successMessage || (nextForm.markDnc ? 'Marked as DNC.' : 'Saved ✓'));
      setTimeout(() => setSaveMessage(null), 2500);
      if (onUpdated) {
        if (nextForm.markDnc || nextForm.removeDnc) {
          window.location.reload();
        } else {
          await onUpdated();
        }
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to update.');
    } finally {
      setSaving(false);
    }
  }

  const currentlyHot = isHot(form.responseType);
  const isDnc = detail.conversation.workflowStatus === 'dnc';

  return (
    <aside className="detailsPanel">
      <style>{`
        .ldp-wrap { display: flex; flex-direction: column; gap: 12px; height: 100%; }

        /* Header */
        .ldp-hdr {
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
        }
        .ldp-hdr-name {
          font-size: 14px; font-weight: 700; color: #e8e8e7;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;
        }
        .ldp-status {
          font-size: 10px; font-weight: 700; border-radius: 5px; padding: 3px 8px;
          white-space: nowrap; flex-shrink: 0;
        }
        .ldp-status--active { background: rgba(96,165,250,0.12); color: #93c5fd; border: 1px solid rgba(96,165,250,0.2); }
        .ldp-status--dnc { background: rgba(248,113,113,0.12); color: #f87171; border: 1px solid rgba(248,113,113,0.2); }
        .ldp-status--closed { background: rgba(148,163,184,0.1); color: #94a3b8; border: 1px solid rgba(148,163,184,0.15); }
        .ldp-status--follow-up { background: rgba(245,158,11,0.12); color: #fcd34d; border: 1px solid rgba(245,158,11,0.2); }

        /* Meta row */
        .ldp-meta {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 6px;
        }
        .ldp-meta-item {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 8px; padding: 8px 10px;
        }
        .ldp-meta-lbl { font-size: 10px; color: #7a7a8a; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
        .ldp-meta-val { font-size: 12px; font-weight: 600; color: #d4d4d3; }

        /* Hot lead banner */
        .ldp-hot-banner {
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
          background: rgba(34,197,94,0.08);
          border: 1px solid rgba(34,197,94,0.2);
          border-radius: 8px; padding: 8px 12px;
        }
        .ldp-hot-text { font-size: 12px; font-weight: 600; color: #86efac; }
        .ldp-hot-remove {
          font-size: 11px; color: #7a7a8a; background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1); border-radius: 5px;
          padding: 3px 8px; cursor: pointer; font-family: inherit;
        }
        .ldp-hot-remove:hover { color: #f87171; border-color: rgba(248,113,113,0.3); background: rgba(248,113,113,0.08); }

        /* Fields */
        .ldp-fields { display: flex; flex-direction: column; gap: 8px; }
        .ldp-field-lbl {
          font-size: 10px; font-weight: 700; color: #7a7a8a;
          text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px;
        }
        .ldp-input {
          width: 100%; box-sizing: border-box;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 7px; color: #d4d4d3;
          font-size: 12px; font-family: inherit;
          padding: 8px 10px;
        }
        .ldp-input:focus { outline: none; border-color: rgba(139,92,246,0.45); }

        /* Actions */
        .ldp-actions { display: flex; flex-direction: column; gap: 6px; }
        .ldp-btn {
          width: 100%; padding: 10px 12px; border: none; border-radius: 8px;
          font-size: 12px; font-weight: 700; cursor: pointer;
          font-family: inherit; transition: opacity 0.15s; text-align: center;
        }
        .ldp-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .ldp-btn:hover:not(:disabled) { opacity: 0.85; }
        .ldp-btn-save {
          background: linear-gradient(90deg, #8b5cf6, #60a5fa);
          color: #fff; box-shadow: 0 3px 12px rgba(139,92,246,0.25);
        }
        .ldp-btn-row { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
        .ldp-btn-hot {
          background: rgba(34,197,94,0.12); color: #86efac;
          border: 1px solid rgba(34,197,94,0.25);
        }
        .ldp-btn-hot:hover:not(:disabled) { background: rgba(34,197,94,0.2); opacity: 1; }
        .ldp-btn-dnc {
          background: rgba(239,68,68,0.1); color: #f87171;
          border: 1px solid rgba(239,68,68,0.22);
        }
        .ldp-btn-dnc:hover:not(:disabled) { background: rgba(239,68,68,0.18); opacity: 1; }
        .ldp-btn-undnc {
          background: rgba(245,158,11,0.1); color: #fcd34d;
          border: 1px solid rgba(245,158,11,0.22);
        }
        .ldp-btn-undnc:hover:not(:disabled) { background: rgba(245,158,11,0.18); opacity: 1; }

        .ldp-feedback {
          font-size: 11px; text-align: center; font-weight: 600; padding: 2px 0;
        }
        .ldp-feedback--ok { color: #86efac; }
        .ldp-feedback--err { color: #f87171; }
      `}</style>

      <div className="ldp-wrap">
        <div className="ldp-hdr">
          <span className="ldp-hdr-name">
            {currentlyHot && '🔥 '}
            {detail.lead?.businessName || formatPhoneDisplay(detail.conversation.phone)}
          </span>
          <span className={`ldp-status ldp-status--${detail.conversation.workflowStatus}`}>
            {workflowLabel}
          </span>
        </div>

        <div className="ldp-meta">
          <div className="ldp-meta-item">
            <div className="ldp-meta-lbl">Phone</div>
            <div className="ldp-meta-val">{formatPhoneDisplay(detail.conversation.phone)}</div>
          </div>
          <div className="ldp-meta-item">
            <div className="ldp-meta-lbl">Needs reply</div>
            <div className="ldp-meta-val" style={{ color: detail.conversation.needsResponse ? '#fcd34d' : '#d4d4d3' }}>
              {detail.conversation.needsResponse ? 'Yes ⚠️' : 'No'}
            </div>
          </div>
        </div>

        {currentlyHot && (
          <div className="ldp-hot-banner">
            <span className="ldp-hot-text">🔥 Hot lead</span>
            <button
              className="ldp-hot-remove"
              onClick={() => handleSave({ responseType: 'Interested', markDnc: false }, 'Hot lead removed.')}
              disabled={saving}
            >
              Remove
            </button>
          </div>
        )}

        <div className="ldp-fields">
          <div>
            <div className="ldp-field-lbl">Business name</div>
            <input
              className="ldp-input"
              value={form.businessName}
              onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))}
            />
          </div>
          <div>
            <div className="ldp-field-lbl">Niche</div>
            <input
              className="ldp-input"
              value={form.niche}
              onChange={e => setForm(f => ({ ...f, niche: e.target.value }))}
            />
          </div>
        </div>

        <div className="ldp-actions">
          <button className="ldp-btn ldp-btn-save" onClick={() => handleSave({ markDnc: false })} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <div className="ldp-btn-row">
            {!currentlyHot && (
              <button
                className="ldp-btn ldp-btn-hot"
                onClick={() => handleSave({ markDnc: false, responseType: 'Highly interested' }, '🔥 Marked as hot!')}
                disabled={saving}
              >
                🔥 Hot lead
              </button>
            )}
            {isDnc ? (
              <button
                className={`ldp-btn ldp-btn-undnc${currentlyHot ? ' ' : ''}`}
                style={currentlyHot ? { gridColumn: '1 / -1' } : {}}
                onClick={() => handleSave({ removeDnc: true, responseType: 'Not interested', closed: '', nextFollowUpAt: '' }, 'Removed from DNC.')}
                disabled={saving}
              >
                Remove DNC
              </button>
            ) : (
              <button
                className="ldp-btn ldp-btn-dnc"
                onClick={() => handleSave({ markDnc: true, responseType: '', closed: '', nextFollowUpAt: '' })}
                disabled={saving}
              >
                Mark DNC
              </button>
            )}
          </div>
          {saveMessage && <div className="ldp-feedback ldp-feedback--ok">{saveMessage}</div>}
          {saveError && <div className="ldp-feedback ldp-feedback--err">{saveError}</div>}
        </div>
      </div>
    </aside>
  );
}
