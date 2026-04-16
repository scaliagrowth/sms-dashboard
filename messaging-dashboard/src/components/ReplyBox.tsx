import { useState } from 'react';

type Props = {
  phone: string | null;
  onSent: () => Promise<void>;
  disabled?: boolean;
};

export function ReplyBox({ phone, onSent, disabled = false }: Props) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!phone || !message.trim() || disabled) return;

    try {
      setSending(true);
      setError(null);
      const response = await fetch('/api/messages/send', {
        cache: 'no-store',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message }),
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
      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder={disabled ? 'DNC leads are blocked from future outreach' : phone ? 'Type a reply…' : 'Select a conversation first'}
        disabled={!phone || sending || disabled}
      />
      <div className="replyActions">
        {error ? <span className="errorText">{error}</span> : <span className="helperText">{disabled ? 'This lead is DNC and archived from outreach.' : ''}</span>}
        <button onClick={handleSend} disabled={!phone || sending || !message.trim() || disabled}>
          {sending ? 'Sending…' : 'Send SMS'}
        </button>
      </div>
    </div>
  );
}
