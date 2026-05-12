'use client';

import { useEffect, useState, useRef } from 'react';
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
    if (selectedPhone) {
      void loadConversation(selectedPhone);
    } else {
      setDetail(null);
    }
  }, [selectedPhone]);

  useEffect(() => {
    const interval = setInterval(() => {
      void loadConversations();
      if (selectedPhone) {
        void loadConversation(selectedPhone);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [selectedPhone]);

  async function refreshSelectedConversation(phone?: string) {
    if (phone) {
      await loadConversation(phone);
    } else {
      await loadConversations();
      if (selectedPhone) {
        await loadConversation(selectedPhone);
      }
    }
  }

  async function forceRefreshAll() {
    await loadConversations();
    if (selectedPhone) {
      await loadConversation(selectedPhone);
    }
  }

  function handleSelectConversation(phone: string) {
    setSelectedPhone(phone);
    if (typeof window !== 'undefined' && window.innerWidth <= 760) {
      setMobileView('thread');
    }
  }

  const showList = !isMobile || mobileView === 'list';
  const showThread = !isMobile || mobileView === 'thread';

  return (
    <main className="appShell">
      <style>{`
        .tabBar {
          display: flex;
          align-items: center;
          gap: 2px;
          padding: 0 20px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          background: inherit;
        }
        .tabBtn {
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          color: rgba(255,255,255,0.45);
          font-size: 13px;
          font-weight: 500;
          font-family: inherit;
          padding: 10px 14px;
          cursor: pointer;
          margin-bottom: -1px;
          transition: color 0.15s, border-color 0.15s;
          white-space: nowrap;
        }
        .tabBtn:hover {
          color: rgba(255,255,255,0.75);
        }
        .tabBtn--active {
          color: #f0f0ef;
          border-bottom-color: #2a7de1;
        }
        .pipelineWrapper {
          flex: 1;
          overflow-y: auto;
          min-height: 0;
        }
      `}</style>

      <header className="appHeader">
        <div>
          <h1>{process.env.NEXT_PUBLIC_APP_NAME || 'Messaging Dashboard'}</h1>
          <p>Twilio + Google Sheets inbox for manual lead replies.</p>
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
              <ConversationList conversations={conversations} selectedPhone={selectedPhone} onSelect={handleSelectConversation} />
            )
          ) : null}

          {showThread ? (
            <div className="centerColumn threadColumnMobile">
              {isMobile ? (
                <div className="mobileThreadBar">
                  <button className="backButton" onClick={() => setMobileView('list')}>
                    ← Back to inbox
                  </button>
                  {detail?.conversation?.needsResponse ? <span className="needsResponseBadge">Needs response</span> : null}
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
