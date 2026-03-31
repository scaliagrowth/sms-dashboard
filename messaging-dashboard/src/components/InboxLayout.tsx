'use client';

import { useEffect, useState } from 'react';
import { ConversationList } from './ConversationList';
import { ChatThread } from './ChatThread';
import { LeadDetailsPanel } from './LeadDetailsPanel';
import { ReplyBox } from './ReplyBox';
import type { ConversationDetail, ConversationSummary } from '@/lib/types';

export function InboxLayout() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadConversations() {
    try {
      setLoadingList(true);
      const response = await fetch('/api/conversations');
      if (!response.ok) throw new Error('Failed to load conversations.');
      const data = await response.json();
      setConversations(data.conversations || []);
      setSelectedPhone((current) => current || data.conversations?.[0]?.phone || null);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversation.');
    } finally {
      setLoadingDetail(false);
    }
  }

  useEffect(() => {
    void loadConversations();
  }, []);

  useEffect(() => {
    if (selectedPhone) {
      void loadConversation(selectedPhone);
    } else {
      setDetail(null);
    }
  }, [selectedPhone]);

  async function refreshSelectedConversation() {
    await loadConversations();
    if (selectedPhone) {
      await loadConversation(selectedPhone);
    }
  }

  return (
    <main className="appShell">
      <header className="appHeader">
        <div>
          <h1>{process.env.NEXT_PUBLIC_APP_NAME || 'Messaging Dashboard'}</h1>
          <p>Twilio + Google Sheets inbox for manual lead replies.</p>
        </div>
      </header>

      {error ? <div className="errorBanner">{error}</div> : null}

      <div className="dashboardGrid">
        {loadingList ? (
          <aside className="sidebar emptyState">Loading inbox…</aside>
        ) : (
          <ConversationList conversations={conversations} selectedPhone={selectedPhone} onSelect={setSelectedPhone} />
        )}

        <div className="centerColumn">
          <ChatThread detail={detail} loading={loadingDetail} />
          <ReplyBox phone={selectedPhone} onSent={refreshSelectedConversation} />
        </div>

        <LeadDetailsPanel detail={detail} />
      </div>
    </main>
  );
}
