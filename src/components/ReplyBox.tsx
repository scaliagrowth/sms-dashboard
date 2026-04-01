import { useState } from 'react';

type Props = {
  phone: string | null;
  onSent: () => Promise<void>;
};

export function ReplyBox({ phone, onSent }: Props) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!phone || !message.trim()) return;

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
        placeholder={phone ? 'Type a reply…' : 'Select a conversation first'}
        disabled={!phone || sending}
      />
      <div className="replyActions">
        {error ? <span className="errorText">{error}</span> : <span className="helperText" />}
        <button onClick={handleSend} disabled={!phone || sending || !message.trim()}>
          {sending ? 'Sending…' : 'Send SMS'}
        </button>
      </div>
    </div>
  );
}
