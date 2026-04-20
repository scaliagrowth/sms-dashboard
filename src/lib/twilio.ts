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

export function getTwilioPhoneNumber() {
  return normalizePhone(getEnv('TWILIO_PHONE_NUMBER'));
}

export async function listMessagesForNumber(phone: string, limit = 100): Promise<MessageItem[]> {
  const client = getTwilioClient();
  const twilioNumber = getTwilioPhoneNumber();
  const normalizedTarget = normalizePhone(phone);

  const [incoming, outgoing] = await Promise.all([
    client.messages.list({ to: twilioNumber, from: normalizedTarget, limit }),
    client.messages.list({ from: twilioNumber, to: normalizedTarget, limit }),
  ]);

  return [...incoming, ...outgoing]
    .map((message): MessageItem => ({
      sid: message.sid,
      direction: normalizePhone(message.from) === twilioNumber ? 'outbound' : 'inbound',
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
  const twilioNumber = getTwilioPhoneNumber();

  const limit = parseInt(process.env.TWILIO_RECENT_FETCH_LIMIT ?? '1000', 10);
  const lookbackDays = parseInt(process.env.TWILIO_RECENT_LOOKBACK_DAYS ?? '90', 10);
  const dateSentAfter = new Date();
  dateSentAfter.setDate(dateSentAfter.getDate() - lookbackDays);

  const messages = await client.messages.list({ limit, dateSentAfter });

  return messages
    .filter((message) => normalizePhone(message.from) === twilioNumber || normalizePhone(message.to) === twilioNumber)
    .map((message): MessageItem => ({
      sid: message.sid,
      direction: normalizePhone(message.from) === twilioNumber ? 'outbound' : 'inbound',
      body: message.body ?? '',
      dateCreated: message.dateCreated?.toISOString() ?? new Date(0).toISOString(),
      status: message.status ?? 'unknown',
      from: message.from,
      to: message.to,
    }))
    .sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());
}

export async function sendSms(to: string, body: string) {
  const client = getTwilioClient();
  return client.messages.create({
    from: getTwilioPhoneNumber(),
    to: normalizePhone(to),
    body,
  });
}
