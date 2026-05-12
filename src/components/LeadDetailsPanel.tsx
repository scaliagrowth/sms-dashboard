'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatPhoneDisplay } from '@/lib/phone';
import type { ConversationDetail, LeadUpdateInput } from '@/lib/types';

type Props = {
  detail: ConversationDetail | null;
  onUpdated?: () => Promise<void>;
};

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
    return <aside className="detailsPanel emptyState">Select a conversation to see lead details.</aside>;
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
      setSaveMessage(successMessage || (nextForm.markDnc ? 'Marked as DNC.' : 'Saved'));
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

  return (
    <aside className="detailsPanel">
      <style>{`
        .ldp-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        .ldp-title {
          font-size: 15px;
          font-weight: 700;
          color: #e8e8e7;
          margin: 0;
        }
        .ldp-meta {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 12px 14px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          margin-bottom: 14px;
        }
        .ldp-meta-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
        }
        .ldp-meta-label { color: #7a7a8a; }
        .ldp-meta-value { font-weight: 600; color: #d4d4d3; }
        .ldp-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .ldp-card-title {
          font-size: 13px;
          font-weight: 700;
          color: #7a7a8a;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          margin: 0 0 4px;
        }
        .ldp-field {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .ldp-field label {
          font-size: 11px;
          font-weight: 700;
          color: #7a7a8a;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .ldp-field input {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          color: #d4d4d3;
          font-size: 13px;
          font-family: inherit;
          padding: 9px 11px;
          width: 100%;
          box-sizing: border-box;
        }
        .ldp-field input:focus {
          outline: none;
          border-color: rgba(139,92,246,0.5);
        }
        .ldp-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding-top: 4px;
        }
        .ldp-btn {
          width: 100%;
          padding: 11px;
          border: none;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          transition: opacity 0.15s;
        }
        .ldp-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .ldp-btn:hover:not(:disabled) { opacity: 0.88; }
        .ldp-btn-save {
          background: linear-gradient(90deg, #8b5cf6 0%, #60a5fa 100%);
          color: #fff;
          box-shadow: 0 4px 14px rgba(139,92,246,0.28);
        }
        .ldp-btn-hot {
          background: linear-gradient(90deg, #16a34a 0%, #22c55e 100%);
          color: #fff;
        }
        .ldp-btn-dnc {
          background: linear-gradient(90deg, #ef4444 0%, #f97316 100%);
          color: #fff;
        }
        .ldp-btn-undnc {
          background: linear-gradient(90deg, #f59e0b 0%, #f97316 100%);
          color: #fff;
        }
        .ldp-msg-success {
          font-size: 12px;
          color: #86efac;
          font-weight: 600;
          text-align: center;
        }
        .ldp-msg-error {
          font-size: 12px;
          color: #f87171;
          text-align: center;
        }
      `}</style>

      <div className="ldp-header">
        <h3 className="ldp-title">Lead Details</h3>
        <span className={`statusPill ${detail.conversation.workflowStatus}`}>{workflowLabel}</span>
      </div>

      <div className="ldp-meta">
        <div className="ldp-meta-row">
          <span className="ldp-meta-label">Phone</span>
          <span className="ldp-meta-value">{formatPhoneDisplay(detail.conversation.phone)}</span>
        </div>
        <div className="ldp-meta-row">
          <span className="ldp-meta-label">Needs reply</span>
          <span className="ldp-meta-value">{detail.conversation.needsResponse ? 'Yes' : 'No'}</span>
        </div>
      </div>

      <div className="ldp-card">
        <p className="ldp-card-title">Quick Update</p>

        <div className="ldp-field">
          <label>Business name</label>
          <input
            value={form.businessName}
            onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))}
          />
        </div>

        <div className="ldp-field">
          <label>Niche</label>
          <input
            value={form.niche}
            onChange={e => setForm(f => ({ ...f, niche: e.target.value }))}
          />
        </div>

        <div className="ldp-actions">
          <button
            className="ldp-btn ldp-btn-save"
            onClick={() => handleSave({ markDnc: false })}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>

          <button
            className="ldp-btn ldp-btn-hot"
            onClick={() => handleSave({ markDnc: false, responseType: 'Highly interested' }, 'Marked as highly interested.')}
            disabled={saving}
          >
            Highly interested
          </button>

          {detail.conversation.workflowStatus === 'dnc' ? (
            <button
              className="ldp-btn ldp-btn-undnc"
              onClick={() => handleSave({ removeDnc: true, responseType: 'Not interested', closed: '', nextFollowUpAt: '' }, 'Removed from DNC.')}
              disabled={saving}
            >
              Remove from DNC
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

          {saveMessage ? <div className="ldp-msg-success">{saveMessage}</div> : null}
          {saveError ? <div className="ldp-msg-error">{saveError}</div> : null}
        </div>
      </div>
    </aside>
  );
}
