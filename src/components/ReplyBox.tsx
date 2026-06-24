'use client';

import { useState } from 'react';

type Props = {
  phone: string | null;
  ourNumber: string | null;
  niche?: string | null;
  onSent: () => Promise<void>;
  disabled?: boolean;
};

export function ReplyBox({ phone, ourNumber, niche, onSent, disabled = false }: Props) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nicheLabel = niche?.trim() || 'local businesses';

  const presets = [
    {
      label: 'Message 2',
      text: `Hey man my name is Ali. I run Meta ads for local ${nicheLabel} and just got a client 6 leads in 3 days at $6.77 a lead. I'm a student working with a small number of businesses right now and offering a free 7 day trial where u just cover the ad spend and we handle everything. Open to a quick call to see if it's a fit?`,
    },
    { label: 'Variant 1', text: '' },
    { label: 'Variant 2', text: '' },
  ];

  async function handleSend() {
    if (!phone || !message.trim() || disabled) return;
    try {
      setSending(true);
      setError(null);
      const response = await fetch('/api/messages/send', {
        cache: 'no-store',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message, ourNumber }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to send message.');
      }
      setMessage('');
      await onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="replyBox">
      <style>{`
        .rb-presets {
          display: flex;
          gap: 6px;
          margin-bottom: 8px;
          flex-wrap: wrap;
        }
        .rb-preset {
          background: rgba(139,92,246,0.1);
          border: 1px solid rgba(139,92,246,0.25);
          border-radius: 6px;
          color: #c4b5fd;
          font-size: 11px;
          font-weight: 600;
          font-family: inherit;
          padding: 5px 12px;
          cursor: pointer;
          transition: all 0.12s;
          white-space: nowrap;
        }
        .rb-preset:hover:not(:disabled) {
          background: rgba(139,92,246,0.2);
          border-color: rgba(139,92,246,0.4);
          color: #e9d5ff;
        }
        .rb-preset:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }
        .rb-send-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 10px;
        }
        .rb-send-btn {
          background: linear-gradient(90deg, #8b5cf6, #60a5fa);
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 10px 20px;
          font-size: 13px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          white-space: nowrap;
          box-shadow: 0 3px 12px rgba(139,92,246,0.25);
          transition: opacity 0.15s;
        }
        .rb-send-btn:hover:not(:disabled) { opacity: 0.88; }
        .rb-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .rb-hint { font-size: 11px; color: #7a7a8a; }
        .rb-error { font-size: 11px; color: #f87171; }
        .rb-disabled-msg {
          text-align: center;
          font-size: 12px;
          color: #7a7a8a;
          padding: 8px;
          background: rgba(248,113,113,0.06);
          border: 1px solid rgba(248,113,113,0.15);
          border-radius: 8px;
          margin-bottom: 8px;
        }
      `}</style>

      {disabled && (
        <div className="rb-disabled-msg">🚫 This lead is DNC — blocked from outreach</div>
      )}

      {!disabled && phone && (
        <div className="rb-presets">
          {presets.map((preset) => (
            <button
              key={preset.label}
              className="rb-preset"
              onClick={() => setMessage(preset.text)}
              disabled={sending || !preset.text.trim()}
              title={!preset.text.trim() ? 'No message set yet' : undefined}
              type="button"
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={
          disabled ? 'DNC — replies blocked' :
          phone ? 'Type a reply…' :
          'Select a conversation first'
        }
        disabled={!phone || sending || disabled}
      />

      <div className="rb-send-row">
        {error ? (
          <span className="rb-error">{error}</span>
        ) : (
          <span className="rb-hint">
            {disabled ? '' : phone ? `Replying to ${phone}` : ''}
          </span>
        )}
        <button
          className="rb-send-btn"
          onClick={handleSend}
          disabled={!phone || sending || !message.trim() || disabled}
        >
          {sending ? 'Sending…' : 'Send SMS'}
        </button>
      </div>
    </div>
  );
}
