import { formatPhoneDisplay } from '@/lib/phone';
import type { ConversationSummary } from '@/lib/types';

type Props = {
  conversations: ConversationSummary[];
  selectedPhone: string | null;
  onSelect: (phone: string) => void;
};

export function ConversationList({ conversations, selectedPhone, onSelect }: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebarHeader">
        <h2>Inbox</h2>
        <span>{conversations.length} leads</span>
      </div>

      <div className="conversationList">
        {conversations.map((conversation) => {
          const isActive = selectedPhone === conversation.phone;
          return (
            <button
              key={conversation.phone}
              className={`conversationCard ${isActive ? 'active' : ''}`}
              onClick={() => onSelect(conversation.phone)}
            >
              <div className="conversationTopRow">
                <strong>{conversation.businessName || formatPhoneDisplay(conversation.phone)}</strong>
                <span>{conversation.lastMessageAt ? new Date(conversation.lastMessageAt).toLocaleDateString() : ''}</span>
              </div>
              <div className="conversationMeta">{formatPhoneDisplay(conversation.phone)}</div>
              <div className="conversationPreview">{conversation.lastMessageBody || conversation.replyText || 'No messages yet'}</div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
