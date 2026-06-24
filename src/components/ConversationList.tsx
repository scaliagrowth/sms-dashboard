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

function isHot(responseType: string | null) {
  return (responseType || '').trim().toLowerCase() === 'highly interested';
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${date} ${time}`;
}

export function ConversationList({ conversations, selectedPhone, onSelect }: Props) {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  const needsResponseCount = useMemo(() =>
    conversations.filter(c => c.needsResponse && c.workflowStatus !== 'dnc').length,
    [conversations]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matching = conversations.filter((c) => {
      const haystack = [c.businessName, c.phone, c.lastMessageBody, c.replyText, c.responseType, c.niche]
        .filter(Boolean).join(' ').toLowerCase();
      if (query && !haystack.includes(query)) return false;
      if (filterMode === 'hot') return isHot(c.responseType);
      if (filterMode === 'dnc') return c.workflowStatus === 'dnc';
      // All tab excludes DNC
      return c.workflowStatus !== 'dnc';
    });
    return sortConversations(matching);
  }, [conversations, filterMode, search]);

  const tabs: { id: FilterMode; label: string; count?: number }[] = [
    { id: 'all', label: 'All', count: conversations.filter(c => c.workflowStatus !== 'dnc').length },
    { id: 'hot', label: '🔥 Hot', count: conversations.filter(c => isHot(c.responseType)).length },
    { id: 'dnc', label: 'DNC', count: conversations.filter(c => c.workflowStatus === 'dnc').length },
  ];

  return (
    <aside className="sidebar">
      <style>{`
        .cl-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .cl-title {
          font-size: 16px;
          font-weight: 700;
          color: #e8e8e7;
          margin: 0;
        }
        .cl-needs-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: rgba(245,158,11,0.15);
          border: 1px solid rgba(245,158,11,0.3);
          border-radius: 999px;
          padding: 3px 10px;
          font-size: 11px;
          font-weight: 700;
          color: #fcd34d;
          white-space: nowrap;
        }
        .cl-needs-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #f59e0b;
          flex-shrink: 0;
        }
        .cl-search {
          width: 100%;
          box-sizing: border-box;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          padding: 9px 12px;
          color: #d4d4d3;
          font-size: 12px;
          font-family: inherit;
          margin-bottom: 10px;
        }
        .cl-search:focus { outline: none; border-color: rgba(139,92,246,0.4); }
        .cl-search::placeholder { color: #7a7a8a; }
        .cl-tabs {
          display: flex;
          gap: 4px;
          margin-bottom: 12px;
        }
        .cl-tab {
          flex: 1;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 7px;
          color: #7a7a8a;
          font-size: 11px;
          font-weight: 600;
          font-family: inherit;
          padding: 6px 4px;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
          text-align: center;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
        }
        .cl-tab:hover { color: #d4d4d3; background: rgba(255,255,255,0.06); }
        .cl-tab--active {
          background: rgba(139,92,246,0.15);
          border-color: rgba(139,92,246,0.35);
          color: #c4b5fd;
        }
        .cl-tab-count {
          background: rgba(255,255,255,0.08);
          border-radius: 4px;
          padding: 1px 5px;
          font-size: 10px;
        }
        .cl-tab--active .cl-tab-count {
          background: rgba(139,92,246,0.25);
        }

        /* Conversation cards */
        .cl-card {
          width: 100%;
          text-align: left;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px;
          padding: 10px 12px;
          cursor: pointer;
          transition: background 0.12s, border-color 0.12s;
          margin-bottom: 4px;
          position: relative;
          overflow: hidden;
        }
        .cl-card::before {
          content: '';
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 3px;
          background: transparent;
          border-radius: 10px 0 0 10px;
          transition: background 0.12s;
        }
        .cl-card:hover { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.1); }
        .cl-card--active {
          background: rgba(139,92,246,0.08);
          border-color: rgba(139,92,246,0.3);
        }
        .cl-card--active::before { background: #8b5cf6; }
        .cl-card--needs::before { background: #f59e0b; }
        .cl-card--needs { border-color: rgba(245,158,11,0.2); }

        .cl-card-top {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 3px;
        }
        .cl-card-name {
          font-size: 13px;
          font-weight: 600;
          color: #e8e8e7;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          min-width: 0;
        }
        .cl-card-time {
          font-size: 10px;
          color: #7a7a8a;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .cl-card-mid {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
          margin-bottom: 4px;
        }
        .cl-card-phone {
          font-size: 11px;
          color: #7a7a8a;
        }
        .cl-card-badges {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }
        .cl-badge {
          font-size: 9px;
          font-weight: 700;
          border-radius: 4px;
          padding: 2px 6px;
          white-space: nowrap;
          letter-spacing: 0.03em;
        }
        .cl-badge--active { background: rgba(96,165,250,0.12); color: #93c5fd; border: 1px solid rgba(96,165,250,0.2); }
        .cl-badge--followup { background: rgba(245,158,11,0.12); color: #fcd34d; border: 1px solid rgba(245,158,11,0.2); }
        .cl-badge--closed { background: rgba(148,163,184,0.1); color: #94a3b8; border: 1px solid rgba(148,163,184,0.15); }
        .cl-badge--dnc { background: rgba(248,113,113,0.1); color: #f87171; border: 1px solid rgba(248,113,113,0.18); }
        .cl-badge--needs { background: rgba(245,158,11,0.15); color: #fcd34d; border: 1px solid rgba(245,158,11,0.3); }
        .cl-badge--hot { font-size: 11px; }

        .cl-card-preview {
          font-size: 11px;
          color: #7a7a8a;
          line-height: 1.4;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .cl-card-delivery {
          font-size: 10px;
          color: #4b5563;
          margin-top: 2px;
        }
        .cl-card-delivery--undelivered { color: #f87171; }
        .cl-card-delivery--delivered { color: #4b5563; }

        .cl-empty {
          text-align: center;
          color: #7a7a8a;
          font-size: 12px;
          padding: 32px 0;
        }
      `}</style>

      <div className="cl-top">
        <h2 className="cl-title">Inbox</h2>
        {needsResponseCount > 0 && (
          <div className="cl-needs-badge">
            <span className="cl-needs-dot" />
            {needsResponseCount} need reply
          </div>
        )}
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
            {t.count !== undefined && <span className="cl-tab-count">{t.count}</span>}
          </button>
        ))}
      </div>

      <div className="conversationList" style={{ gap: 0 }}>
        {filtered.length ? filtered.map((c) => {
          const isActive = selectedPhone === c.phone;
          const hot = isHot(c.responseType);
          const statusLabel =
            c.workflowStatus === 'dnc' ? 'dnc' :
            c.workflowStatus === 'closed' ? 'closed' :
            c.workflowStatus === 'follow-up' ? 'followup' : 'active';

          return (
            <button
              key={c.phone}
              className={`cl-card${isActive ? ' cl-card--active' : ''}${c.needsResponse ? ' cl-card--needs' : ''}`}
              onClick={() => onSelect(c.phone)}
            >
              <div className="cl-card-top">
                <span className="cl-card-name">
                  {hot && <span className="cl-badge--hot">🔥 </span>}
                  {c.businessName || formatPhoneDisplay(c.phone)}
                </span>
                <span className="cl-card-time">{fmtDateTime(c.lastMessageAt)}</span>
              </div>
              <div className="cl-card-mid">
                <span className="cl-card-phone">{formatPhoneDisplay(c.phone)}</span>
                <div className="cl-card-badges">
                  <span className={`cl-badge cl-badge--${statusLabel}`}>
                    {c.workflowStatus === 'dnc' ? 'DNC' :
                     c.workflowStatus === 'closed' ? 'Closed' :
                     c.workflowStatus === 'follow-up' ? 'Follow up' : 'Active'}
                  </span>
                  {c.needsResponse && <span className="cl-badge cl-badge--needs">Reply needed</span>}
                </div>
              </div>
              <div className="cl-card-preview">
                {c.lastMessageBody || c.replyText || 'No messages yet'}
              </div>
            </button>
          );
        }) : (
          <div className="cl-empty">No conversations match.</div>
        )}
      </div>
    </aside>
  );
}
