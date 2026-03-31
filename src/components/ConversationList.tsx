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
        <div>
          <h2>Inbox</h2>
          <span>Choose a conversation</span>
        </div>
        <span>{conversations.length} leads</span>
      </div>

      <div className="conversationList">
        {conversations.map((conversation) => {
          const isActive = selectedPhone === conversation.phone;
          return (
            <button
              key={conversation.phone}
              className={`conversationCard ${isActive ? 'active' : ''} ${conversation.needsResponse ? 'needsResponseCard' : ''}`}
              onClick={() => onSelect(conversation.phone)}
            >
              <div className="conversationTopRow">
                <strong>{conversation.businessName || formatPhoneDisplay(conversation.phone)}</strong>
                <span>{conversation.lastMessageAt ? new Date(conversation.lastMessageAt).toLocaleDateString() : ''}</span>
              </div>
              <div className="conversationMetaRow">
                <div className="conversationMeta">{formatPhoneDisplay(conversation.phone)}</div>
                {conversation.needsResponse ? <span className="needsResponseBadge">Needs response</span> : null}
              </div>
              <div className="conversationPreview">{conversation.lastMessageBody || conversation.replyText || 'No messages yet'}</div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
