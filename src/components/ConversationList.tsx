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

type FilterMode = 'all' | 'needs-response' | 'recent';

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

function isRecentReply(conversation: ConversationSummary): boolean {
  if (!conversation.needsResponse || !conversation.lastMessageAt || conversation.lastDirection !== 'inbound') return false;
  const ageMs = Date.now() - new Date(conversation.lastMessageAt).getTime();
  return ageMs <= 1000 * 60 * 60 * 24;
}

export function ConversationList({ conversations, selectedPhone, onSelect }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();

    return conversations.filter((conversation) => {
      const haystack = [
        conversation.businessName,
        conversation.phone,
        conversation.lastMessageBody,
        conversation.replyText,
        conversation.responseType,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesSearch = !query || haystack.includes(query);
      if (!matchesSearch) return false;

      if (filterMode === 'needs-response') return conversation.needsResponse;
      if (filterMode === 'recent') return isRecentReply(conversation);
      return true;
    });
  }, [conversations, filterMode, search]);

  const groups = useMemo<ConversationGroup[]>(() => {
    const grouped = filteredConversations.reduce<Record<string, ConversationSummary[]>>((acc, conversation) => {
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
  }, [filteredConversations]);

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
        <span>{filteredConversations.length} shown</span>
      </div>

      <div className="sidebarControls">
        <input
          className="searchInput"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search business, phone, or message"
        />

        <div className="filterChips">
          <button className={`filterChip ${filterMode === 'all' ? 'active' : ''}`} onClick={() => setFilterMode('all')}>All</button>
          <button className={`filterChip ${filterMode === 'needs-response' ? 'active' : ''}`} onClick={() => setFilterMode('needs-response')}>Needs response</button>
          <button className={`filterChip ${filterMode === 'recent' ? 'active' : ''}`} onClick={() => setFilterMode('recent')}>Fresh replies</button>
        </div>
      </div>

      <div className="conversationList groupedConversationList">
        {groups.length ? groups.map((group) => {
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

              <div className={`conversationGroupCards ${isCollapsed ? 'collapsed' : ''}`}>
                {group.conversations.map((conversation) => {
                  const isActive = selectedPhone === conversation.phone;
                  const recentReply = isRecentReply(conversation);

                  return (
                    <button
                      key={conversation.phone}
                      className={`conversationCard ${isActive ? 'active' : ''} ${conversation.needsResponse ? 'needsResponseCard' : ''} ${recentReply ? 'freshReplyCard' : ''}`}
                      onClick={() => onSelect(conversation.phone)}
                    >
                      <div className="conversationTopRow">
                        <strong>{conversation.businessName || formatPhoneDisplay(conversation.phone)}</strong>
                        <span>{conversation.lastMessageAt ? new Date(conversation.lastMessageAt).toLocaleDateString() : ''}</span>
                      </div>
                      <div className="conversationMetaRow">
                        <div className="conversationMeta">{formatPhoneDisplay(conversation.phone)}</div>
                        <div className="conversationBadgeStack">
                          {recentReply ? <span className="freshReplyBadge">Fresh reply</span> : null}
                          {conversation.needsResponse ? <span className="needsResponseBadge">Needs response</span> : null}
                        </div>
                      </div>
                      <div className="conversationPreview">{conversation.lastMessageBody || conversation.replyText || 'No messages yet'}</div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        }) : <div className="emptyState sidebarEmptyState">No conversations match your filters.</div>}
      </div>
    </aside>
  );
}
