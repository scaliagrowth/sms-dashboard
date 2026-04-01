'use client';

import { useEffect, useState } from 'react';
import { formatPhoneDisplay } from '@/lib/phone';
import type { ConversationDetail } from '@/lib/types';
import { StatusBadge } from './StatusBadge';

type Props = {
  detail: ConversationDetail | null;
};

export function LeadDetailsPanel({ detail }: Props) {
  const [responseType, setResponseType] = useState('');
  const [settingCallBooked, setSettingCallBooked] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setResponseType(detail?.lead?.responseType || '');
    setSettingCallBooked(detail?.lead?.settingCallBooked || '');
    setSaveMessage(null);
    setSaveError(null);
  }, [detail?.conversation.phone, detail?.lead?.responseType, detail?.lead?.settingCallBooked]);

  if (!detail) {
    return <aside className="detailsPanel emptyState">Lead details will appear here.</aside>;
  }

  const lead = detail.lead;

  async function handleSave() {
    if (!detail) return;

    try {
      setSaving(true);
      setSaveError(null);
      setSaveMessage(null);

      const response = await fetch('/api/leads/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          phone: detail.conversation.phone,
          responseType,
          settingCallBooked,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update lead status.');
      }

      setSaveMessage('Saved');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to update lead status.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside className="detailsPanel">
      <h3>Lead Details</h3>
      <div className="detailGroup">
        <div className="detailRow"><span>Business</span><strong>{lead?.businessName || 'Unknown'}</strong></div>
        <div className="detailRow"><span>Phone</span><strong>{formatPhoneDisplay(detail.conversation.phone)}</strong></div>
        <div className="detailRow"><span>Niche</span><strong>{lead?.niche || '—'}</strong></div>
      </div>

      <div className="statusEditorCard">
        <h4>Quick Update</h4>
        <label className="editorField">
          <span>Response Type</span>
          <select value={responseType} onChange={(event) => setResponseType(event.target.value)}>
            <option value="">Blank</option>
            <option value="Interested">Interested</option>
            <option value="More info">More info</option>
            <option value="Not interested">Not interested</option>
          </select>
        </label>

        <label className="editorField">
          <span>Setting Call</span>
          <select value={settingCallBooked} onChange={(event) => setSettingCallBooked(event.target.value)}>
            <option value="">Blank</option>
            <option value="Yes">Yes</option>
          </select>
        </label>

        <div className="editorActions">
          <button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save status'}
          </button>
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
      </div>
    </aside>
  );
}
