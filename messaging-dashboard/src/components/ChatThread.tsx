import { useEffect, useRef } from 'react';
import { formatPhoneDisplay } from '@/lib/phone';
import type { ConversationDetail, MessageItem } from '@/lib/types';

type Props = {
  detail: ConversationDetail | null;
  loading: boolean;
};

function getStatusLabel(message: MessageItem): string {
  if (message.direction === 'inbound') return 'Received';

  const status = (message.status || '').toLowerCase();

  switch (status) {
    case 'delivered':
      return 'Delivered';
    case 'sent':
      return 'Sent';
    case 'queued':
      return 'Queued';
    case 'sending':
      return 'Sending';
    case 'undelivered':
      return 'Undelivered';
    case 'failed':
      return 'Failed';
    default:
      return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Sent';
  }
}

export function ChatThread({ detail, loading }: Props) {
  const messageListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = messageListRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [detail?.conversation.phone, detail?.messages.length]);

  if (loading) {
    return <section className="threadPanel emptyState">Loading conversation…</section>;
  }

  if (!detail) {
    return <section className="threadPanel emptyState">Select a conversation to view messages.</section>;
  }

  return (
    <section className="threadPanel">
      <div className="threadHeader">
        <div>
          <h2>{detail.lead?.businessName || formatPhoneDisplay(detail.conversation.phone)}</h2>
          <p>{formatPhoneDisplay(detail.conversation.phone)}</p>
        </div>
        <div className="threadHeaderStatus">
          <span className="threadHeaderHint">SMS status</span>
          <strong>Delivery only — no true read receipt</strong>
        </div>
      </div>

      <div ref={messageListRef} className="messageList">
        {detail.messages.length ? (
          detail.messages.map((message) => (
            <div key={message.sid} className={`messageRow ${message.direction}`}>
              <div className={`messageBubble ${message.direction}`}>
                <div className="messageBody">{message.body || '(empty message)'}</div>
                <div className="messageMeta">
                  <span>{message.direction === 'inbound' ? 'Lead' : 'You'} • {getStatusLabel(message)}</span>
                  <span>{new Date(message.dateCreated).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="emptyThreadText">No message history found in Twilio for this lead yet.</div>
        )}
      </div>
    </section>
  );
}
