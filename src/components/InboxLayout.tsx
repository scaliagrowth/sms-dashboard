'use client';

import { useEffect, useState } from 'react';
import { ConversationList } from './ConversationList';
import { ChatThread } from './ChatThread';
import { LeadDetailsPanel } from './LeadDetailsPanel';
import { ReplyBox } from './ReplyBox';
import { PipelineView } from './PipelineView';
import type { ConversationDetail, ConversationSummary } from '@/lib/types';

type Tab = 'inbox' | 'pipeline';

export function InboxLayout() {
  const [activeTab, setActiveTab] = useState<Tab>('inbox');
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list');
  const [isMobile, setIsMobile] = useState(false);

  async function loadConversations() {
    try {
      setLoadingList(true);
      const response = await fetch('/api/conversations', { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to load conversations.');
      const data = await response.json();
      setConversations(data.conversations || []);
      setSelectedPhone((current) => current || data.conversations?.[0]?.phone || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations.');
    } finally {
      setLoadingList(false);
    }
  }

  async function loadConversation(phone: string) {
    try {
      setLoadingDetail(true);
      const response = await fetch(`/api/conversations/${encodeURIComponent(phone)}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to load conversation.');
      const data = await response.json();
      setDetail(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversation.');
    } finally {
      setLoadingDetail(false);
    }
  }

  useEffect(() => {
    const updateViewport = () => setIsMobile(window.innerWidth <= 760);
    updateViewport();
    window.addEventListener('resize', updateViewport);
    void loadConversations();
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useEffect(() => {
    if (selectedPhone) void loadConversation(selectedPhone);
    else setDetail(null);
  }, [selectedPhone]);

  useEffect(() => {
    const interval = setInterval(() => {
      void loadConversations();
      if (selectedPhone) void loadConversation(selectedPhone);
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedPhone]);

  async function refreshSelectedConversation(phone?: string) {
    if (phone) {
      await loadConversation(phone);
    } else {
      await loadConversations();
      if (selectedPhone) await loadConversation(selectedPhone);
    }
  }

  function handleSelectConversation(phone: string) {
    setSelectedPhone(phone);
    if (typeof window !== 'undefined' && window.innerWidth <= 760) setMobileView('thread');
  }

  const showList = !isMobile || mobileView === 'list';
  const showThread = !isMobile || mobileView === 'thread';

  return (
    <main className="appShell">
      <style>{`
        .appHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0;
          padding-bottom: 0;
        }
        .scalia-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
        }
        .scalia-wordmark {
          font-size: 22px;
          font-weight: 700;
          color: #e8e8e7;
          letter-spacing: -0.3px;
          font-family: Inter, Arial, sans-serif;
        }
        .tabBar {
          display: flex;
          align-items: center;
          gap: 2px;
          padding: 10px 0 0;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          margin-bottom: 16px;
          flex-shrink: 0;
        }
        .tabBtn {
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          color: rgba(255,255,255,0.35);
          font-size: 13px;
          font-weight: 600;
          font-family: inherit;
          padding: 8px 16px 10px;
          cursor: pointer;
          margin-bottom: -1px;
          transition: color 0.15s, border-color 0.15s;
          white-space: nowrap;
          letter-spacing: 0.01em;
        }
        .tabBtn:hover { color: rgba(255,255,255,0.7); }
        .tabBtn--active {
          color: #e8e8e7;
          border-bottom-color: #8b5cf6;
        }
        .pipelineWrapper {
          flex: 1;
          overflow-y: auto;
          min-height: 0;
        }
      `}</style>

      <header className="appHeader">
        <div className="scalia-logo">
          {/* Scalia logo mark — inline SVG, no image dependency */}
          <svg width="36" height="36" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <defs>
              <linearGradient id="scaliaGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#a78bfa" />
                <stop offset="100%" stopColor="#60a5fa" />
              </linearGradient>
            </defs>
            {/* Dot */}
            <circle cx="62" cy="62" r="22" fill="url(#scaliaGrad)" />
            {/* Slash / bar */}
            <rect x="78" y="78" width="36" height="88" rx="18" transform="rotate(-20 78 78)" fill="url(#scaliaGrad)" />
          </svg>
          <span className="scalia-wordmark">Scalia</span>
        </div>
      </header>

      <nav className="tabBar" aria-label="Main navigation">
        <button
          className={`tabBtn${activeTab === 'inbox' ? ' tabBtn--active' : ''}`}
          onClick={() => setActiveTab('inbox')}
          aria-current={activeTab === 'inbox' ? 'page' : undefined}
        >
          Inbox
        </button>
        <button
          className={`tabBtn${activeTab === 'pipeline' ? ' tabBtn--active' : ''}`}
          onClick={() => setActiveTab('pipeline')}
          aria-current={activeTab === 'pipeline' ? 'page' : undefined}
        >
          Pipeline
        </button>
      </nav>

      {error ? <div className="errorBanner">{error}</div> : null}

      {activeTab === 'pipeline' ? (
        <div className="pipelineWrapper">
          <PipelineView />
        </div>
      ) : (
        <div className="dashboardGrid">
          {showList ? (
            loadingList ? (
              <aside className="sidebar emptyState">Loading inbox…</aside>
            ) : (
              <ConversationList
                conversations={conversations}
                selectedPhone={selectedPhone}
                onSelect={handleSelectConversation}
              />
            )
          ) : null}

          {showThread ? (
            <div className="centerColumn threadColumnMobile">
              {isMobile ? (
                <div className="mobileThreadBar">
                  <button className="backButton" onClick={() => setMobileView('list')}>
                    ← Back to inbox
                  </button>
                  {detail?.conversation?.needsResponse ? (
                    <span className="needsResponseBadge">Needs response</span>
                  ) : null}
                </div>
              ) : null}
              <ChatThread detail={detail} loading={loadingDetail} />
              <ReplyBox
                phone={selectedPhone}
                niche={detail?.lead?.niche}
                onSent={refreshSelectedConversation}
                disabled={detail?.conversation.workflowStatus === 'dnc'}
              />
              {isMobile ? <LeadDetailsPanel detail={detail} onUpdated={refreshSelectedConversation} /> : null}
            </div>
          ) : null}

          {!isMobile ? <LeadDetailsPanel detail={detail} onUpdated={refreshSelectedConversation} /> : null}
        </div>
      )}
    </main>
  );
}
