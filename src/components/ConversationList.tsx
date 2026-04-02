'use client';

import { useMemo, useState } from 'react';
import { formatPhoneDisplay } from '@/lib/phone';
import type { ConversationSummary, LeadWorkflowStatus } from '@/lib/types';

type Props = {
  conversations: ConversationSummary[];
  selectedPhone: string | null;
  onSelect: (phone: string) => void;
};

type FilterMode = 'active' | 'follow-up' | 'closed' | 'dnc' | 'all';

function sortConversations(items: ConversationSummary[]): ConversationSummary[] {
  return [...items].sort((a, b) => {
    if (a.needsResponse !== b.needsResponse) {
      return a.needsResponse ? -1 : 1;
    }

    const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return bTime - aTime;
  });
}

function getStatusPillLabel(status: LeadWorkflowStatus) {
  if (status === 'follow-up') return 'Follow up';
  if (status === 'closed') return 'Closed';
  if (status === 'dnc') return 'DNC';
  return 'Active';
}

export function ConversationList({ conversations, selectedPhone, onSelect }: Props) {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('active');

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();

    const matching = conversations.filter((conversation) => {
      const haystack = [
        conversation.businessName,
        conversation.phone,
        conversation.lastMessageBody,
        conversation.replyText,
        conversation.responseType,
        conversation.niche,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesSearch = !query || haystack.includes(query);
      if (!matchesSearch) return false;

      if (filterMode === 'all') return true;
      return conversation.workflowStatus === filterMode;
    });

    return sortConversations(matching);
  }, [conversations, filterMode, search]);

  return (
    <aside className="sidebar">
      <div className="sidebarHeader">
        <div>
          <h2>Inbox</h2>
          <span>Cleaner status buckets</span>
        </div>
        <span>{filteredConversations.length} shown</span>
      </div>

      <div className="sidebarControls">
        <input
          className="searchInput"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search business, phone, note, or message"
        />

        <div className="filterChips">
          <button type="button" className={`filterChip ${filterMode === 'active' ? 'active' : ''}`} onClick={() => setFilterMode('active')}>Active</button>
          <button type="button" className={`filterChip ${filterMode === 'follow-up' ? 'active' : ''}`} onClick={() => setFilterMode('follow-up')}>Follow up</button>
          <button type="button" className={`filterChip ${filterMode === 'closed' ? 'active' : ''}`} onClick={() => setFilterMode('closed')}>Closed</button>
          <button type="button" className={`filterChip ${filterMode === 'dnc' ? 'active' : ''}`} onClick={() => setFilterMode('dnc')}>DNC</button>
          <button type="button" className={`filterChip ${filterMode === 'all' ? 'active' : ''}`} onClick={() => setFilterMode('all')}>All</button>
        </div>
      </div>

      <div className="conversationList">
        {filteredConversations.length ? filteredConversations.map((conversation) => {
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
                <div className="conversationBadgeStack">
                  <span className={`statusPill ${conversation.workflowStatus}`}>{getStatusPillLabel(conversation.workflowStatus)}</span>
                  {conversation.needsResponse ? <span className="needsResponseBadge">Needs response</span> : null}
                </div>
              </div>
              {conversation.nextFollowUpAt ? <div className="followUpText">Follow up: {new Date(conversation.nextFollowUpAt).toLocaleString()}</div> : null}
              <div className="conversationPreview">{conversation.lastMessageBody || conversation.replyText || 'No messages yet'}</div>
            </button>
          );
        }) : <div className="emptyState sidebarEmptyState">No conversations match that filter.</div>}
      </div>
    </aside>
  );
}
