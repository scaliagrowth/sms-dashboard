import { useState } from 'react';

type Props = {
  phone: string | null;
  niche?: string | null;
  onSent: () => Promise<void>;
  disabled?: boolean;
};

export function ReplyBox({ phone, niche, onSent, disabled = false }: Props) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nicheLabel = niche?.trim() || 'local businesses';

  const presets = [
    {
      label: 'Message 2',
      text: `Hey man my name is Ali, I work with local ${nicheLabel} and had a quick question. Are you booked out right now or do you have room for more jobs this month?`,
    },
    {
      label: 'Message 3',
      text: `We run Meta ads that bring in booked appointments and we're doing a free 7 day trial right now where you just cover the ad spend and we handle everything else. Would you be open to a quick call to see if it makes sense for you? if not interested say stop`,
    },
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
      {!disabled && phone ? (
        <div className="presetButtons">
          {presets.map((preset) => (
            <button
              key={preset.label}
              className="presetBtn"
              onClick={() => setMessage(preset.text)}
              disabled={sending}
              type="button"
            >
              {preset.label}
            </button>
          ))}
        </div>
      ) : null}
      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder={
          disabled
            ? 'DNC leads are blocked from future outreach'
            : phone
            ? 'Type a reply…'
            : 'Select a conversation first'
        }
        disabled={!phone || sending || disabled}
      />
      <div className="replyActions">
        {error ? (
          <span className="errorText">{error}</span>
        ) : (
          <span className="helperText">
            {disabled ? 'This lead is DNC and archived from outreach.' : ''}
          </span>
        )}
        <button
          onClick={handleSend}
          disabled={!phone || sending || !message.trim() || disabled}
        >
          {sending ? 'Sending…' : 'Send SMS'}
        </button>
      </div>
    </div>
  );
}
