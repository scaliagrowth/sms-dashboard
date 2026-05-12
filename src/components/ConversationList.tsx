'use client';

import { useMemo, useState } from 'react';
import { formatPhoneDisplay } from '@/lib/phone';
import type { ConversationSummary, LeadWorkflowStatus } from '@/lib/types';

type Props = {
  conversations: ConversationSummary[];
  selectedPhone: string | null;
  onSelect: (phone: string) => void;
};

type FilterMode = 'all' | 'hot' | 'dnc';

function sortConversations(items: ConversationSummary[]): ConversationSummary[] {
  return [...items].sort((a, b) => {
    const aIsManualFollowUp = a.needsResponse && a.nextFollowUpAt;
    const bIsManualFollowUp = b.needsResponse && b.nextFollowUpAt;
    if (aIsManualFollowUp && !bIsManualFollowUp) return -1;
    if (!aIsManualFollowUp && bIsManualFollowUp) return 1;
    if (a.needsResponse !== b.needsResponse) return a.needsResponse ? -1 : 1;
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

function isHot(responseType: string | null) {
  return (responseType || '').trim().toLowerCase() === 'highly interested';
}

export function ConversationList({ conversations, selectedPhone, onSelect }: Props) {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matching = conversations.filter((c) => {
      const haystack = [c.businessName, c.phone, c.lastMessageBody, c.replyText, c.responseType, c.niche]
        .filter(Boolean).join(' ').toLowerCase();
      if (query && !haystack.includes(query)) return false;
      if (filterMode === 'hot') return isHot(c.responseType);
      if (filterMode === 'dnc') return c.workflowStatus === 'dnc';
      return true;
    });
    return sortConversations(matching);
  }, [conversations, filterMode, search]);

  const tabs: { id: FilterMode; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'hot', label: 'Hot Leads' },
    { id: 'dnc', label: 'DNC' },
  ];

  return (
    <aside className="sidebar">
      <style>{`
        .cl-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 14px;
        }
        .cl-title {
          font-size: 18px;
          font-weight: 700;
          color: #e8e8e7;
          margin: 0 0 3px;
        }
        .cl-sub { font-size: 12px; color: #7a7a8a; margin: 0; }
        .cl-count { font-size: 12px; color: #7a7a8a; white-space: nowrap; margin-top: 3px; }
        .cl-search {
          width: 100%;
          box-sizing: border-box;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          padding: 10px 12px;
          color: #d4d4d3;
          font-size: 13px;
          font-family: inherit;
          margin-bottom: 10px;
        }
        .cl-search:focus { outline: none; border-color: rgba(139,92,246,0.45); }
        .cl-search::placeholder { color: #7a7a8a; }
        .cl-tabs {
          display: flex;
          gap: 6px;
          margin-bottom: 14px;
        }
        .cl-tab {
          flex: 1;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 8px;
          color: #7a7a8a;
          font-size: 12px;
          font-weight: 600;
          font-family: inherit;
          padding: 7px 6px;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
          text-align: center;
        }
        .cl-tab:hover { color: #d4d4d3; background: rgba(255,255,255,0.06); }
        .cl-tab--active {
          background: rgba(139,92,246,0.15);
          border-color: rgba(139,92,246,0.35);
          color: #c4b5fd;
        }
      `}</style>

      <div className="cl-header">
        <div>
          <h2 className="cl-title">Inbox</h2>
          <p className="cl-sub">SMS leads</p>
        </div>
        <span className="cl-count">{filtered.length} shown</span>
      </div>

      <input
        className="cl-search"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search business, phone, message…"
      />

      <div className="cl-tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`cl-tab${filterMode === t.id ? ' cl-tab--active' : ''}`}
            onClick={() => setFilterMode(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="conversationList">
        {filtered.length ? filtered.map((c) => {
          const isActive = selectedPhone === c.phone;
          return (
            <button
              key={c.phone}
              className={`conversationCard ${isActive ? 'active' : ''} ${c.needsResponse ? 'needsResponseCard' : ''}`}
              onClick={() => onSelect(c.phone)}
            >
              <div className="conversationTopRow">
                <strong>{c.businessName || formatPhoneDisplay(c.phone)}</strong>
                <span>{c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleDateString() : ''}</span>
              </div>
              <div className="conversationMetaRow">
                <div className="conversationMeta">{formatPhoneDisplay(c.phone)}</div>
                <div className="conversationBadgeStack">
                  <span className={`statusPill ${c.workflowStatus}`}>{getStatusPillLabel(c.workflowStatus)}</span>
                  {isHot(c.responseType) ? <span className="statusPill highlyInterested">Hot lead</span> : null}
                  {c.needsResponse ? <span className="needsResponseBadge">Needs response</span> : null}
                </div>
              </div>
              {c.nextFollowUpAt ? (
                <div className="followUpText">Follow up: {new Date(c.nextFollowUpAt).toLocaleString()}</div>
              ) : null}
              <div className="conversationPreview">
                {c.lastMessageBody || c.replyText || 'No messages yet'}
              </div>
            </button>
          );
        }) : (
          <div className="emptyState sidebarEmptyState">No conversations match.</div>
        )}
      </div>
    </aside>
  );
}
