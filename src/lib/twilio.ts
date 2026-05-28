import twilio from 'twilio';
import { normalizePhone } from '@/lib/phone';
import type { MessageItem } from '@/lib/types';

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function getTwilioClient() {
  return twilio(getEnv('TWILIO_ACCOUNT_SID'), getEnv('TWILIO_AUTH_TOKEN'));
}

// Returns all active Twilio phone numbers on this account (normalized).
// Results are cached for the lifetime of the process (serverless cold start is fine).
let cachedOurNumbers: Set<string> | null = null;

export async function getOurNumbers(): Promise<Set<string>> {
  if (cachedOurNumbers) return cachedOurNumbers;
  const client = getTwilioClient();
  const numbers = await client.incomingPhoneNumbers.list({ limit: 100 });
  cachedOurNumbers = new Set(numbers.map((n) => normalizePhone(n.phoneNumber)));
  return cachedOurNumbers;
}

// Given a message's from/to, returns which side is the lead's number.
// ourNumbers is the Set from getOurNumbers().
export function getLeadPhone(
  message: { from: string; to: string },
  ourNumbers: Set<string>,
): string {
  const from = normalizePhone(message.from);
  const to = normalizePhone(message.to);
  // whichever side is NOT one of our numbers is the lead
  return ourNumbers.has(from) ? to : from;
}

// Returns which of our numbers was used in this message (the Twilio side).
export function getOurNumberForMessage(
  message: { from: string; to: string },
  ourNumbers: Set<string>,
): string | null {
  const from = normalizePhone(message.from);
  const to = normalizePhone(message.to);
  if (ourNumbers.has(from)) return from;
  if (ourNumbers.has(to)) return to;
  return null;
}

export async function listMessagesForNumber(phone: string, limit = 100): Promise<MessageItem[]> {
  const client = getTwilioClient();
  const ourNumbers = await getOurNumbers();
  const normalizedTarget = normalizePhone(phone);

  // Query against every one of our numbers in parallel
  const queries = Array.from(ourNumbers).flatMap((ourNum) => [
    client.messages.list({ to: ourNum, from: normalizedTarget, limit }),
    client.messages.list({ from: ourNum, to: normalizedTarget, limit }),
  ]);

  const results = await Promise.all(queries);
  const all = results.flat();

  // Deduplicate by SID (parallel queries can overlap)
  const seen = new Set<string>();
  const unique = all.filter((m) => {
    if (seen.has(m.sid)) return false;
    seen.add(m.sid);
    return true;
  });

  return unique
    .map((message): MessageItem => ({
      sid: message.sid,
      direction: ourNumbers.has(normalizePhone(message.from)) ? 'outbound' : 'inbound',
      body: message.body ?? '',
      dateCreated: message.dateCreated?.toISOString() ?? new Date(0).toISOString(),
      status: message.status ?? 'unknown',
      from: message.from,
      to: message.to,
    }))
    .sort((a, b) => new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime());
}

export async function listRecentMessages(): Promise<MessageItem[]> {
  const client = getTwilioClient();
  const ourNumbers = await getOurNumbers();

  const limit = parseInt(process.env.TWILIO_RECENT_FETCH_LIMIT ?? '1000', 10);
  const lookbackDays = parseInt(process.env.TWILIO_RECENT_LOOKBACK_DAYS ?? '90', 10);
  const dateSentAfter = new Date();
  dateSentAfter.setDate(dateSentAfter.getDate() - lookbackDays);

  // Fetch account-wide — no number filter needed
  const messages = await client.messages.list({ limit, dateSentAfter });

  return messages
    // Keep only messages that involve at least one of our numbers
    .filter(
      (m) =>
        ourNumbers.has(normalizePhone(m.from)) ||
        ourNumbers.has(normalizePhone(m.to)),
    )
    .map((message): MessageItem => ({
      sid: message.sid,
      direction: ourNumbers.has(normalizePhone(message.from)) ? 'outbound' : 'inbound',
      body: message.body ?? '',
      dateCreated: message.dateCreated?.toISOString() ?? new Date(0).toISOString(),
      status: message.status ?? 'unknown',
      from: message.from,
      to: message.to,
    }))
    .sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());
}

// from is now required — pass the ourNumber for the conversation
export async function sendSms(to: string, body: string, from: string) {
  const client = getTwilioClient();
  return client.messages.create({
    from: normalizePhone(from),
    to: normalizePhone(to),
    body,
  });
}
