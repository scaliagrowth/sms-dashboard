import { normalizePhone } from '@/lib/phone';
import { getLeads, findLeadByPhone } from '@/lib/sheets';
import { listMessagesForNumber, listRecentMessages } from '@/lib/twilio';
import type { ConversationDetail, ConversationSummary, LeadRow } from '@/lib/types';

function getConversationPhone(message: { from: string; to: string }, twilioNumber: string) {
  const from = normalizePhone(message.from);
  const to = normalizePhone(message.to);
  return from === twilioNumber ? to : from;
}

export async function getConversationSummaries(): Promise<ConversationSummary[]> {
  const [messages, leads] = await Promise.all([listRecentMessages(200), getLeads()]);
  const twilioNumber = normalizePhone(process.env.TWILIO_PHONE_NUMBER ?? '');
  const leadMap = new Map<string, LeadRow>();

  for (const lead of leads) {
    if (!leadMap.has(lead.normalizedPhone)) {
      leadMap.set(lead.normalizedPhone, lead);
    }
  }

  const conversationMap = new Map<string, ConversationSummary>();

  for (const message of messages) {
    const phone = getConversationPhone(message, twilioNumber);
    if (!phone) continue;

    const existing = conversationMap.get(phone);
    if (existing) continue;

    const lead = leadMap.get(phone) ?? null;
    conversationMap.set(phone, {
      phone,
      normalizedPhone: phone,
      businessName: lead?.businessName ?? null,
      niche: lead?.niche ?? null,
      replied: lead?.replied ?? null,
      responseType: lead?.responseType ?? null,
      replyText: lead?.replyText ?? null,
      lastMessageAt: message.dateCreated,
      lastMessageBody: message.body,
      lastDirection: message.direction,
    });
  }

  for (const lead of leads) {
    if (lead.normalizedPhone && !conversationMap.has(lead.normalizedPhone)) {
      conversationMap.set(lead.normalizedPhone, {
        phone: lead.normalizedPhone,
        normalizedPhone: lead.normalizedPhone,
        businessName: lead.businessName || null,
        niche: lead.niche || null,
        replied: lead.replied || null,
        responseType: lead.responseType || null,
        replyText: lead.replyText || null,
        lastMessageAt: null,
        lastMessageBody: null,
        lastDirection: null,
      });
    }
  }

  return Array.from(conversationMap.values()).sort((a, b) => {
    const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return bTime - aTime;
  });
}

export async function getConversationDetail(phone: string): Promise<ConversationDetail> {
  const [lead, messages] = await Promise.all([findLeadByPhone(phone), listMessagesForNumber(phone, 100)]);

  return {
    conversation: {
      phone: normalizePhone(phone),
      normalizedPhone: normalizePhone(phone),
      businessName: lead?.businessName ?? null,
      niche: lead?.niche ?? null,
      replied: lead?.replied ?? null,
      responseType: lead?.responseType ?? null,
      replyText: lead?.replyText ?? null,
      lastMessageAt: messages[messages.length - 1]?.dateCreated ?? null,
      lastMessageBody: messages[messages.length - 1]?.body ?? null,
      lastDirection: messages[messages.length - 1]?.direction ?? null,
    },
    lead,
    messages,
  };
}
