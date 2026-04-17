'use client';

import { useMemo, useState } from 'react';
import { formatPhoneDisplay } from '@/lib/phone';
import type { ConversationSummary, LeadWorkflowStatus } from '@/lib/types';

type Props = {
  conversations: ConversationSummary[];
  selectedPhone: string | null;
  onSelect: (phone: string) => void;
};

type FilterMode = 'work' | 'highly-interested' | 'active' | 'follow-up' | 'closed' | 'dnc' | 'all';

function sortConversations(items: ConversationSummary[]): ConversationSummary[] {
  return [...items].sort((a, b) => {
    // Manual follow-ups with "needs response" should be at the top
    const aIsManualFollowUp = a.nextFollowUpAt && !a.lastMessageAt;
    const bIsManualFollowUp = b.nextFollowUpAt && !b.lastMessageAt;
    
    if (aIsManualFollowUp && !bIsManualFollowUp) return -1;
    if (!aIsManualFollowUp && bIsManualFollowUp) return 1;
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

function isHighlyInterested(responseType: string | null) {
  return (responseType || '').trim().toLowerCase() === 'highly interested';
}

export function ConversationList({ conversations, selectedPhone, onSelect }: Props) {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('work');

  const clearNeedsResponse = async (phone: string) => {
    try {
      const response = await fetch('/api/leads/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          phone,
          markDnc: false,
          removeDnc: false,
          responseType: '',
          notes: 'Needs response cleared manually',
        }),
      });
      
      if (response.ok) {
        // Reload the page to refresh everything
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to clear needs response:', error);
      alert('Failed to clear response status');
    }
  };

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
      if (filterMode === 'work') {
        return conversation.workflowStatus === 'active' || conversation.workflowStatus === 'follow-up';
      }
      if (filterMode === 'highly-interested') {
        return isHighlyInterested(conversation.responseType);
      }
      return conversation.workflowStatus === filterMode;
    });

    return sortConversations(matching);
  }, [conversations, filterMode, search]);

  return (
    <aside className="sidebar">
      <div className="sidebarHeader">
        <div>
          <h2>Inbox</h2>
          <span>Main view stays focused on leads that still matter</span>
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
          <button type="button" className={`filterChip ${filterMode === 'work' ? 'active' : ''}`} onClick={() => setFilterMode('work')}>Work queue</button>
          <button type="button" className={`filterChip ${filterMode === 'highly-interested' ? 'active' : ''}`} onClick={() => setFilterMode('highly-interested')}>Highly interested</button>
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
                  {isHighlyInterested(conversation.responseType) ? <span className="statusPill highlyInterested">Hot lead</span> : null}
                  {conversation.needsResponse ? <span className="needsResponseBadge">Needs response</span> : null}
                </div>
              </div>
              {conversation.needsResponse && (
                <button 
                  className="clearResponseButton" 
                  onClick={(e) => {
                    e.stopPropagation();
                    clearNeedsResponse(conversation.phone);
                  }}
                >
                  Clear response
                </button>
              )}
              {conversation.nextFollowUpAt ? <div className="followUpText">Follow up: {new Date(conversation.nextFollowUpAt).toLocaleString()}</div> : null}
              <div className="conversationPreview">{conversation.lastMessageBody || conversation.replyText || 'No messages yet'}</div>
            </button>
          );
        }) : <div className="emptyState sidebarEmptyState">No conversations match that filter.</div>}
      </div>
    </aside>
  );
}
