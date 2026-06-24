'use client';

import { useEffect, useState } from 'react';
import { ConversationList } from './ConversationList';
import { ChatThread } from './ChatThread';
import { LeadDetailsPanel } from './LeadDetailsPanel';
import { ReplyBox } from './ReplyBox';
import { PipelineView } from './PipelineView';
import { DashboardView } from './DashboardView';
import type { ConversationDetail, ConversationSummary } from '@/lib/types';

type Tab = 'dashboard' | 'inbox' | 'pipeline';

const LOGO_SRC = 'data:image/png;base64,';

export function InboxLayout() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
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

  function handleGoToSMS(phone: string) {
    setSelectedPhone(phone);
    setActiveTab('inbox');
    setMobileView('thread');
  }

  function handleNavigate(tab: string) {
    setActiveTab(tab as Tab);
  }

  const showList = !isMobile || mobileView === 'list';
  const showThread = !isMobile || mobileView === 'thread';

  const tabs: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'inbox',     label: 'Inbox' },
    { id: 'pipeline',  label: 'Pipeline' },
  ];

  return (
    <main className="appShell">
      <style>{`
        .app-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0;
          flex-shrink: 0;
        }
        .app-logo {
          display: flex;
          align-items: center;
          gap: 9px;
        }
        .app-logo img {
          width: 28px;
          height: 28px;
          object-fit: contain;
          filter: drop-shadow(0 0 8px rgba(139,92,246,0.5));
        }
        .app-wordmark {
          font-size: 19px;
          font-weight: 800;
          color: #e8e8e7;
          letter-spacing: -0.4px;
          font-family: Inter, Arial, sans-serif;
        }
        .app-nav {
          display: flex;
          align-items: center;
          gap: 2px;
          padding: 10px 0 0;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          margin-bottom: 16px;
          flex-shrink: 0;
        }
        .app-tab {
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          color: rgba(255,255,255,0.35);
          font-size: 13px;
          font-weight: 600;
          font-family: inherit;
          padding: 8px 18px 10px;
          cursor: pointer;
          margin-bottom: -1px;
          transition: color 0.15s, border-color 0.15s;
          white-space: nowrap;
        }
        .app-tab:hover { color: rgba(255,255,255,0.7); }
        .app-tab--active {
          color: #e8e8e7;
          border-bottom-color: #8b5cf6;
        }
        .scroll-wrapper {
          flex: 1;
          overflow-y: auto;
          min-height: 0;
        }
        .ourNumberBadge {
          display: inline-block;
          background: rgba(139,92,246,0.15);
          color: #a78bfa;
          border: 1px solid rgba(139,92,246,0.3);
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          padding: 3px 8px;
          margin-bottom: 4px;
        }
      `}</style>

      <header className="app-header">
        <div className="app-logo">
          <img src={LOGO_SRC} alt="Scalia" />
          <span className="app-wordmark">Scalia</span>
        </div>
      </header>

      <nav className="app-nav" aria-label="Main navigation">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`app-tab${activeTab === t.id ? ' app-tab--active' : ''}`}
            onClick={() => setActiveTab(t.id)}
            aria-current={activeTab === t.id ? 'page' : undefined}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {error ? <div className="errorBanner">{error}</div> : null}

      {activeTab === 'dashboard' ? (
        <div className="scroll-wrapper">
          <DashboardView conversations={conversations} onNavigate={handleNavigate} />
        </div>
      ) : activeTab === 'pipeline' ? (
        <div className="scroll-wrapper">
          <PipelineView onGoToSMS={handleGoToSMS} />
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
                    ← Back
                  </button>
                  {detail?.conversation?.needsResponse ? (
                    <span className="needsResponseBadge">Needs response</span>
                  ) : null}
                </div>
              ) : null}
              <ChatThread detail={detail} loading={loadingDetail} />
              <ReplyBox
                phone={selectedPhone}
                ourNumber={detail?.conversation.ourNumber ?? null}
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
