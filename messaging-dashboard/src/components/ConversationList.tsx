'use client';

import { useMemo, useState } from 'react';
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

function sortGroupConversations(items: ConversationSummary[]): ConversationSummary[] {
  return [...items].sort((a, b) => {
    if (a.needsResponse !== b.needsResponse) {
      return a.needsResponse ? -1 : 1;
    }

    const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return bTime - aTime;
  });
}

export function ConversationList({ conversations, selectedPhone, onSelect }: Props) {
  const groups = useMemo<ConversationGroup[]>(() => {
    const grouped = conversations.reduce<Record<string, ConversationSummary[]>>((acc, conversation) => {
      const key = getConversationGroup(conversation);
      acc[key] = acc[key] || [];
      acc[key].push(conversation);
      return acc;
    }, {});

    return [
      { key: 'interested', label: 'Interested', conversations: sortGroupConversations(grouped.interested || []) },
      { key: 'more-info', label: 'More info', conversations: sortGroupConversations(grouped['more-info'] || []) },
      { key: 'not-interested', label: 'Not interested', conversations: sortGroupConversations(grouped['not-interested'] || []) },
      { key: 'unassigned', label: 'Uncategorized', conversations: sortGroupConversations(grouped.unassigned || []) },
    ].filter((group) => group.conversations.length > 0);
  }, [conversations]);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  function toggleGroup(key: string) {
    setCollapsed((current) => ({ ...current, [key]: !current[key] }));
  }

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
        {groups.map((group) => {
          const isCollapsed = Boolean(collapsed[group.key]);
          const needsResponseCount = group.conversations.filter((conversation) => conversation.needsResponse).length;

          return (
            <section key={group.key} className="conversationGroup">
              <button className="conversationGroupHeader conversationGroupToggle" onClick={() => toggleGroup(group.key)}>
                <div className="conversationGroupTitleWrap">
                  <span className={`conversationChevron ${isCollapsed ? 'collapsed' : ''}`}>⌄</span>
                  <h3>{group.label}</h3>
                </div>
                <div className="conversationGroupStats">
                  {needsResponseCount ? <span className="miniNeedsBadge">{needsResponseCount} need reply</span> : null}
                  <span>{group.conversations.length}</span>
                </div>
              </button>

              {!isCollapsed ? (
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
              ) : null}
            </section>
          );
        })}
      </div>
    </aside>
  );
}
