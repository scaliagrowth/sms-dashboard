'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatPhoneDisplay } from '@/lib/phone';
import type { ConversationDetail, LeadUpdateInput } from '@/lib/types';
import { StatusBadge } from './StatusBadge';

type Props = {
  detail: ConversationDetail | null;
  onUpdated?: () => Promise<void>;
};

function toDatetimeLocalValue(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function getSelectOptions(currentValue: string) {
  const base = ['', 'Yes'];
  return currentValue && !base.includes(currentValue) ? [currentValue, ...base] : base;
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
      nextFollowUpAt: toDatetimeLocalValue(detail?.lead?.nextFollowUpAt),
      markDnc: detail?.lead?.responseType === 'DNC',
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
    return <aside className="detailsPanel emptyState">Lead details will appear here.</aside>;
  }

  const lead = detail.lead;

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

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update lead details.');
      }

      setForm(nextForm);
      setSaveMessage(successMessage || (nextForm.markDnc ? 'Marked as DNC and archived.' : 'Saved'));
      if (onUpdated) await onUpdated();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to update lead details.');
    } finally {
      setSaving(false);
    }
  }

  const settingCallOptions = getSelectOptions(form.settingCallBooked);
  const zoomOptions = getSelectOptions(form.zoomBooked);
  const showedOptions = getSelectOptions(form.showed);
  const closedOptions = getSelectOptions(form.closed);

  return (
    <aside className="detailsPanel">
      <div className="panelSectionHeader">
        <div>
          <h3>Lead Details</h3>
          <p className="sectionHint">Everything here saves to the sheet.</p>
        </div>
        <span className={`statusPill ${detail.conversation.workflowStatus}`}>{workflowLabel}</span>
      </div>

      <div className="detailGroup">
        <div className="detailRow"><span>Phone</span><strong>{formatPhoneDisplay(detail.conversation.phone)}</strong></div>
        <div className="detailRow"><span>Needs reply</span><strong>{detail.conversation.needsResponse ? 'Yes' : 'No'}</strong></div>
      </div>

      <div className="statusEditorCard">
        <h4>Quick Update</h4>

        <label className="editorField">
          <span>Business name</span>
          <input value={form.businessName} onChange={(event) => setForm((current) => ({ ...current, businessName: event.target.value }))} />
        </label>

        <label className="editorField">
          <span>Niche</span>
          <input value={form.niche} onChange={(event) => setForm((current) => ({ ...current, niche: event.target.value }))} />
        </label>

        <label className="editorField">
          <span>Response type</span>
          <select value={form.responseType} onChange={(event) => setForm((current) => ({ ...current, responseType: event.target.value, markDnc: false }))} disabled={form.markDnc}>
            <option value="">Blank</option>
            <option value="Highly interested">Highly interested</option>
            <option value="Interested">Interested</option>
            <option value="More info">More info</option>
            <option value="Not interested">Not interested</option>
          </select>
        </label>

        <div className="editorGridTwo">
          <label className="editorField">
            <span>Setting call</span>
            <select value={form.settingCallBooked} onChange={(event) => setForm((current) => ({ ...current, settingCallBooked: event.target.value }))}>
              {settingCallOptions.map((value) => <option key={value || 'blank'} value={value}>{value || 'Blank'}</option>)}
            </select>
          </label>

          <label className="editorField">
            <span>Zoom booked</span>
            <select value={form.zoomBooked} onChange={(event) => setForm((current) => ({ ...current, zoomBooked: event.target.value }))}>
              {zoomOptions.map((value) => <option key={value || 'blank'} value={value}>{value || 'Blank'}</option>)}
            </select>
          </label>

          <label className="editorField">
            <span>Showed</span>
            <select value={form.showed} onChange={(event) => setForm((current) => ({ ...current, showed: event.target.value }))}>
              {showedOptions.map((value) => <option key={value || 'blank'} value={value}>{value || 'Blank'}</option>)}
            </select>
          </label>

          <label className="editorField">
            <span>Closed</span>
            <select value={form.closed} onChange={(event) => setForm((current) => ({ ...current, closed: event.target.value, markDnc: false }))} disabled={form.markDnc}>
              {closedOptions.map((value) => <option key={value || 'blank'} value={value}>{value || 'Blank'}</option>)}
            </select>
          </label>
        </div>

        <label className="editorField">
          <span>Next follow-up</span>
          <input type="datetime-local" value={form.nextFollowUpAt} onChange={(event) => setForm((current) => ({ ...current, nextFollowUpAt: event.target.value, markDnc: false }))} disabled={form.markDnc} />
        </label>

        <label className="editorField">
          <span>Notes</span>
          <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={5} />
        </label>

        <div className="editorActions">
          <button onClick={() => handleSave({ markDnc: false })} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
          <button className="successButton" onClick={() => handleSave({ markDnc: false, responseType: 'Highly interested' }, 'Marked as highly interested.')} disabled={saving}>Highly interested</button>
          <button className="dangerButton" onClick={() => handleSave({ markDnc: true, responseType: '', closed: '', nextFollowUpAt: '' })} disabled={saving}>Mark DNC</button>
          {saveMessage ? <span className="saveSuccess">{saveMessage}</span> : null}
          {saveError ? <span className="errorText">{saveError}</span> : null}
        </div>
      </div>

      <div className="statusGrid">
        <StatusBadge label="Message 1 Sent" value={lead?.message1Sent} />
        <StatusBadge label="Replied" value={lead?.replied} />
        <StatusBadge label="Response Type" value={lead?.responseType} />
        <StatusBadge label="Message 2 Sent" value={lead?.message2Sent} />
        <StatusBadge label="Message 3 Sent" value={lead?.message3Sent} />
        <StatusBadge label="Setting Call" value={lead?.settingCallBooked} />
        <StatusBadge label="Zoom Booked" value={lead?.zoomBooked} />
        <StatusBadge label="Showed" value={lead?.showed} />
        <StatusBadge label="Closed" value={lead?.closed} />
        <StatusBadge label="Follow Up" value={lead?.nextFollowUpAt ? new Date(lead.nextFollowUpAt).toLocaleString() : ''} />
      </div>
    </aside>
  );
}
