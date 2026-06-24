'use client';

import { useEffect, useRef } from 'react';
import { formatPhoneDisplay } from '@/lib/phone';
import type { ConversationDetail, MessageItem } from '@/lib/types';

type Props = {
  detail: ConversationDetail | null;
  loading: boolean;
};

function getStatusLabel(message: MessageItem): { label: string; bad: boolean } {
  if (message.direction === 'inbound') return { label: 'Received', bad: false };
  const status = (message.status || '').toLowerCase();
  switch (status) {
    case 'delivered':   return { label: 'Delivered', bad: false };
    case 'sent':        return { label: 'Sent', bad: false };
    case 'queued':      return { label: 'Queued', bad: false };
    case 'sending':     return { label: 'Sending…', bad: false };
    case 'undelivered': return { label: '⚠ Undelivered', bad: true };
    case 'failed':      return { label: '✕ Failed', bad: true };
    default:            return { label: status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Sent', bad: false };
  }
}

function fmtMsgTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${date}, ${time}`;
}

export function ChatThread({ detail, loading }: Props) {
  const messageListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = messageListRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [detail?.conversation.phone, detail?.messages.length]);

  if (loading) {
    return (
      <section className="threadPanel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#7a7a8a', fontSize: '13px' }}>Loading…</span>
      </section>
    );
  }

  if (!detail) {
    return (
      <section className="threadPanel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#7a7a8a', fontSize: '13px' }}>Select a conversation</span>
      </section>
    );
  }

  return (
    <section className="threadPanel">
      <style>{`
        .ct-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          margin-bottom: 4px;
          flex-shrink: 0;
        }
        .ct-header-left { min-width: 0; }
        .ct-name {
          font-size: 15px; font-weight: 700; color: #e8e8e7;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          margin: 0 0 2px;
        }
        .ct-phone { font-size: 12px; color: #7a7a8a; }
        .ct-header-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
        .ct-from-chip {
          background: rgba(139,92,246,0.12);
          border: 1px solid rgba(139,92,246,0.25);
          border-radius: 6px;
          font-size: 11px; font-weight: 600; color: #c4b5fd;
          padding: 3px 9px; white-space: nowrap;
        }
        .ct-receipt-hint {
          font-size: 10px; color: #4b5563; text-align: right;
        }

        /* Message bubbles */
        .ct-bubble-wrap {
          display: flex;
          flex-direction: column;
          gap: 2px;
          margin-bottom: 10px;
        }
        .ct-bubble-wrap--inbound { align-items: flex-start; }
        .ct-bubble-wrap--outbound { align-items: flex-end; }

        .ct-bubble {
          max-width: 76%;
          border-radius: 18px;
          padding: 10px 14px;
          font-size: 13px;
          line-height: 1.45;
        }
        .ct-bubble--inbound {
          background: #1e1e2e;
          color: #d4d4d3;
          border: 1px solid rgba(255,255,255,0.06);
          border-bottom-left-radius: 5px;
        }
        .ct-bubble--outbound {
          background: #6d55f0;
          color: #fff;
          border-bottom-right-radius: 5px;
          box-shadow: 0 4px 14px rgba(109,85,240,0.3);
        }

        .ct-meta {
          font-size: 10px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 4px;
          margin-top: 2px;
        }
        .ct-meta--inbound { color: #7a7a8a; }
        .ct-meta--outbound { color: rgba(255,255,255,0.5); justify-content: flex-end; }
        .ct-meta-status { font-weight: 600; }
        .ct-meta-status--bad { color: #f87171 !important; }
        .ct-meta-dot { opacity: 0.4; }
      `}</style>

      <div className="ct-header">
        <div className="ct-header-left">
          <h2 className="ct-name">
            {detail.lead?.businessName || formatPhoneDisplay(detail.conversation.phone)}
          </h2>
          <div className="ct-phone">{formatPhoneDisplay(detail.conversation.phone)}</div>
        </div>
        <div className="ct-header-right">
          {detail.conversation.ourNumber && (
            <span className="ct-from-chip">
              From {formatPhoneDisplay(detail.conversation.ourNumber)}
            </span>
          )}
          <span className="ct-receipt-hint">Delivery only · no read receipt</span>
        </div>
      </div>

      <div ref={messageListRef} className="messageList">
        {detail.messages.length ? (
          detail.messages.map((message) => {
            const { label, bad } = getStatusLabel(message);
            const isOut = message.direction === 'outbound';
            return (
              <div key={message.sid} className={`ct-bubble-wrap ct-bubble-wrap--${message.direction}`}>
                <div className={`ct-bubble ct-bubble--${message.direction}`}>
                  {message.body || '(empty message)'}
                </div>
                <div className={`ct-meta ct-meta--${message.direction}`}>
                  {!isOut && <span>{message.direction === 'inbound' ? 'Lead' : formatPhoneDisplay(message.from)}</span>}
                  {!isOut && <span className="ct-meta-dot">·</span>}
                  <span className={`ct-meta-status${bad ? ' ct-meta-status--bad' : ''}`}>{label}</span>
                  <span className="ct-meta-dot">·</span>
                  <span>{fmtMsgTime(message.dateCreated)}</span>
                  {isOut && <span className="ct-meta-dot">·</span>}
                  {isOut && <span>You ({formatPhoneDisplay(message.from)})</span>}
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ color: '#7a7a8a', fontSize: '13px', textAlign: 'center', padding: '32px 0' }}>
            No message history found.
          </div>
        )}
      </div>
    </section>
  );
}
