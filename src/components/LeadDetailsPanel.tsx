import { formatPhoneDisplay } from '@/lib/phone';
import type { ConversationDetail } from '@/lib/types';
import { StatusBadge } from './StatusBadge';

type Props = {
  detail: ConversationDetail | null;
};

export function LeadDetailsPanel({ detail }: Props) {
  if (!detail) {
    return <aside className="detailsPanel emptyState">Lead details will appear here.</aside>;
  }

  const lead = detail.lead;

  return (
    <aside className="detailsPanel">
      <h3>Lead Details</h3>
      <div className="detailGroup">
        <div className="detailRow"><span>Business</span><strong>{lead?.businessName || 'Unknown'}</strong></div>
        <div className="detailRow"><span>Phone</span><strong>{formatPhoneDisplay(detail.conversation.phone)}</strong></div>
        <div className="detailRow"><span>Niche</span><strong>{lead?.niche || '—'}</strong></div>
      </div>

      <div className="statusGrid">
        <StatusBadge label="Message 1 Sent" value={lead?.message1Sent} />
        <StatusBadge label="Replied" value={lead?.replied} />
        <StatusBadge label="Response Type" value={lead?.responseType} />
        <StatusBadge label="Message 2 Sent" value={lead?.message2Sent} />
        <StatusBadge label="Setting Call" value={lead?.settingCallBooked} />
        <StatusBadge label="Zoom Booked" value={lead?.zoomBooked} />
        <StatusBadge label="Showed" value={lead?.showed} />
        <StatusBadge label="Closed" value={lead?.closed} />
      </div>

      <div className="detailNotes">
        <h4>Latest Reply Text</h4>
        <p>{lead?.replyText || '—'}</p>
      </div>

      <div className="detailNotes">
        <h4>Notes</h4>
        <p>{lead?.notes || '—'}</p>
      </div>
    </aside>
  );
}
