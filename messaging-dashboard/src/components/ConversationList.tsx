import { formatPhoneDisplay } from '@/lib/phone';
import type { ConversationSummary } from '@/lib/types';

type Props = {
  conversations: ConversationSummary[];
  selectedPhone: string | null;
  onSelect: (phone: string) => void;
};

type ConversationGroup = {
  key: string;
  label: string;
  conversations: ConversationSummary[];
};

function getConversationGroup(conversation: ConversationSummary): string {
  const responseType = (conversation.responseType || '').trim().toLowerCase();

  if (responseType === 'interested') return 'interested';
  if (responseType === 'more info') return 'more-info';
  if (responseType === 'not interested') return 'not-interested';
  return 'unassigned';
}

export function ConversationList({ conversations, selectedPhone, onSelect }: Props) {
  const grouped = conversations.reduce<Record<string, ConversationSummary[]>>((acc, conversation) => {
    const key = getConversationGroup(conversation);
    acc[key] = acc[key] || [];
    acc[key].push(conversation);
    return acc;
  }, {});

  const groups: ConversationGroup[] = [
    { key: 'interested', label: 'Interested', conversations: grouped.interested || [] },
    { key: 'more-info', label: 'More info', conversations: grouped['more-info'] || [] },
    { key: 'not-interested', label: 'Not interested', conversations: grouped['not-interested'] || [] },
    { key: 'unassigned', label: 'Uncategorized', conversations: grouped.unassigned || [] },
  ].filter((group) => group.conversations.length > 0);

  return (
    <aside className="sidebar">
      <div className="sidebarHeader">
        <div>
          <h2>Inbox</h2>
          <span>Organized by lead status</span>
        </div>
        <span>{conversations.length} leads</span>
      </div>

      <div className="conversationList groupedConversationList">
        {groups.map((group) => (
          <section key={group.key} className="conversationGroup">
            <div className="conversationGroupHeader">
              <h3>{group.label}</h3>
              <span>{group.conversations.length}</span>
            </div>

            <div className="conversationGroupCards">
              {group.conversations.map((conversation) => {
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
          </section>
        ))}
      </div>
    </aside>
  );
}
