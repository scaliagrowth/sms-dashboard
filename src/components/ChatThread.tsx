import { formatPhoneDisplay } from '@/lib/phone';
import type { ConversationDetail } from '@/lib/types';

type Props = {
  detail: ConversationDetail | null;
  loading: boolean;
};

export function ChatThread({ detail, loading }: Props) {
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
      </div>

      <div className="messageList">
        {detail.messages.length ? (
          detail.messages.map((message) => (
            <div key={message.sid} className={`messageBubble ${message.direction}`}>
              <div className="messageBody">{message.body || '(empty message)'}</div>
              <div className="messageMeta">
                <span>{message.direction === 'inbound' ? 'Lead' : 'You'}</span>
                <span>{new Date(message.dateCreated).toLocaleString()}</span>
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
