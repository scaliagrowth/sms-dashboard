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

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function ConversationList({ conversations, selectedPhone, onSelect }: Props) {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  const needsResponseCount = useMemo(() =>
    conversations.filter(c => c.needsResponse && c.workflowStatus !== 'dnc').length,
    [conversations]
  );

  const counts = useMemo(() => ({
    all: conversations.filter(c => c.workflowStatus !== 'dnc').length,
    hot: conversations.filter(c => isHot(c.responseType)).length,
    dnc: conversations.filter(c => c.workflowStatus === 'dnc').length,
  }), [conversations]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matching = conversations.filter((c) => {
      const haystack = [c.businessName, c.phone, c.lastMessageBody, c.replyText, c.responseType, c.niche]
        .filter(Boolean).join(' ').toLowerCase();
      if (query && !haystack.includes(query)) return false;
      if (filterMode === 'hot') return isHot(c.responseType);
      if (filterMode === 'dnc') return c.workflowStatus === 'dnc';
      return c.workflowStatus !== 'dnc';
    });
    return sortConversations(matching);
  }, [conversations, filterMode, search]);

  return (
    <aside className="sidebar">
      <style>{`
        .cl-wrap {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
          overflow: hidden;
        }
        .cl-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
          flex-shrink: 0;
        }
        .cl-title {
          font-size: 15px;
          font-weight: 700;
          color: #e8e8e7;
          margin: 0;
        }
        .cl-needs-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: rgba(245,158,11,0.14);
          border: 1px solid rgba(245,158,11,0.28);
          border-radius: 999px;
          padding: 2px 9px;
          font-size: 11px;
          font-weight: 700;
          color: #fcd34d;
          white-space: nowrap;
        }
        .cl-needs-dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: #f59e0b;
        }
        .cl-search {
          width: 100%;
          box-sizing: border-box;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 8px;
          padding: 8px 11px;
          color: #d4d4d3;
          font-size: 12px;
          font-family: inherit;
          margin-bottom: 8px;
          flex-shrink: 0;
        }
        .cl-search:focus { outline: none; border-color: rgba(139,92,246,0.4); }
        .cl-search::placeholder { color: #5a5a6a; }

        .cl-tabs {
          display: flex;
          gap: 4px;
          margin-bottom: 10px;
          flex-shrink: 0;
        }
        .cl-tab {
          flex: 1;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 6px;
          color: #6a6a7a;
          font-size: 11px;
          font-weight: 600;
          font-family: inherit;
          padding: 5px 4px;
          cursor: pointer;
          transition: all 0.12s;
          text-align: center;
        }
        .cl-tab:hover { color: #d4d4d3; background: rgba(255,255,255,0.06); }
        .cl-tab--active {
          background: rgba(139,92,246,0.14);
          border-color: rgba(139,92,246,0.3);
          color: #c4b5fd;
        }

        /* Cards */
        .cl-list {
          flex: 1;
          overflow-y: auto;
          min-height: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding-right: 2px;
        }
        .cl-card {
          width: 100%;
          text-align: left;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.06);
          border-left: 3px solid transparent;
          border-radius: 8px;
          padding: 9px 10px;
          cursor: pointer;
          transition: background 0.1s, border-color 0.1s;
          box-sizing: border-box;
        }
        .cl-card:hover {
          background: rgba(255,255,255,0.04);
        }
        .cl-card--active {
          background: rgba(139,92,246,0.08);
          border-color: rgba(139,92,246,0.25);
          border-left-color: #8b5cf6;
        }
        .cl-card--needs {
          border-left-color: #f59e0b;
          border-color: rgba(245,158,11,0.18);
        }
        .cl-card--active.cl-card--needs {
          border-left-color: #8b5cf6;
        }

        /* Row 1: name + date */
        .cl-row1 {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 4px;
        }
        .cl-name {
          font-size: 13px;
          font-weight: 600;
          color: #e2e2e1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          min-width: 0;
          flex: 1;
        }
        .cl-date {
          font-size: 10px;
          color: #5a5a6a;
          white-space: nowrap;
          flex-shrink: 0;
        }

        /* Row 2: time + badge */
        .cl-row2 {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
          margin-bottom: 5px;
        }
        .cl-time {
          font-size: 11px;
          color: #6a6a7a;
          white-space: nowrap;
        }
        .cl-badges {
          display: flex;
          align-items: center;
          gap: 3px;
          flex-shrink: 0;
        }
        .cl-badge {
          font-size: 9px;
          font-weight: 700;
          border-radius: 4px;
          padding: 2px 6px;
          white-space: nowrap;
          letter-spacing: 0.02em;
        }
        .cl-badge--active { background: rgba(96,165,250,0.1); color: #7eb8f7; border: 1px solid rgba(96,165,250,0.18); }
        .cl-badge--followup { background: rgba(245,158,11,0.1); color: #fcd34d; border: 1px solid rgba(245,158,11,0.18); }
        .cl-badge--closed { background: rgba(148,163,184,0.1); color: #94a3b8; border: 1px solid rgba(148,163,184,0.14); }
        .cl-badge--dnc { background: rgba(248,113,113,0.1); color: #f87171; border: 1px solid rgba(248,113,113,0.16); }
        .cl-badge--needs { background: rgba(245,158,11,0.12); color: #fcd34d; border: 1px solid rgba(245,158,11,0.25); }

        /* Row 3: preview */
        .cl-preview {
          font-size: 11px;
          color: #6a6a7a;
          line-height: 1.4;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .cl-empty {
          text-align: center;
          color: #5a5a6a;
          font-size: 12px;
          padding: 28px 0;
        }
      `}</style>

      <div className="cl-wrap">
        <div className="cl-top">
          <h2 className="cl-title">Inbox</h2>
          {needsResponseCount > 0 && (
            <div className="cl-needs-pill">
              <span className="cl-needs-dot" />
              {needsResponseCount} need reply
            </div>
          )}
        </div>

        <input
          className="cl-search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name, phone, message…"
        />

        <div className="cl-tabs">
          {([
            { id: 'all' as FilterMode, label: `All ${counts.all}` },
            { id: 'hot' as FilterMode, label: `🔥 ${counts.hot}` },
            { id: 'dnc' as FilterMode, label: `DNC ${counts.dnc}` },
          ]).map(t => (
            <button
              key={t.id}
              className={`cl-tab${filterMode === t.id ? ' cl-tab--active' : ''}`}
              onClick={() => setFilterMode(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="cl-list">
          {filtered.length ? filtered.map((c) => {
            const isActive = selectedPhone === c.phone;
            const hot = isHot(c.responseType);
            const statusKey =
              c.workflowStatus === 'dnc' ? 'dnc' :
              c.workflowStatus === 'closed' ? 'closed' :
              c.workflowStatus === 'follow-up' ? 'followup' : 'active';

            return (
              <button
                key={c.phone}
                className={`cl-card${isActive ? ' cl-card--active' : ''}${c.needsResponse ? ' cl-card--needs' : ''}`}
                onClick={() => onSelect(c.phone)}
              >
                <div className="cl-row1">
                  <span className="cl-name">
                    {hot ? '🔥 ' : ''}{c.businessName || formatPhoneDisplay(c.phone)}
                  </span>
                  <span className="cl-date">{fmtDate(c.lastMessageAt)}</span>
                </div>

                <div className="cl-row2">
                  <span className="cl-time">{fmtTime(c.lastMessageAt)}</span>
                  <div className="cl-badges">
                    <span className={`cl-badge cl-badge--${statusKey}`}>
                      {statusKey === 'dnc' ? 'DNC' :
                       statusKey === 'closed' ? 'Closed' :
                       statusKey === 'followup' ? 'Follow up' : 'Active'}
                    </span>
                    {c.needsResponse && (
                      <span className="cl-badge cl-badge--needs">Reply</span>
                    )}
                  </div>
                </div>

                <div className="cl-preview">
                  {c.lastMessageBody || c.replyText || 'No messages yet'}
                </div>
              </button>
            );
          }) : (
            <div className="cl-empty">No conversations match.</div>
          )}
        </div>
      </div>
    </aside>
  );
}
