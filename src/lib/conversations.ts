import { normalizePhone } from '@/lib/phone';
import { findLeadByPhone, getLeads } from '@/lib/sheets';
import { listMessagesForNumber, listRecentMessages } from '@/lib/twilio';
import type { ConversationDetail, ConversationSummary, LeadRow, MessageItem } from '@/lib/types';

function getConversationPhone(message: { from: string; to: string }, twilioNumber: string) {
  const from = normalizePhone(message.from);
  const to = normalizePhone(message.to);
  return from === twilioNumber ? to : from;
}

function getNeedsResponse(messages: MessageItem[], lead: LeadRow | null): boolean {
  if (!messages.length) return false;

  const lastInboundIndex = [...messages].reverse().findIndex((message) => message.direction === 'inbound');
  if (lastInboundIndex === -1) return false;

  const inboundMessage = messages[messages.length - 1 - lastInboundIndex];
  const inboundAt = new Date(inboundMessage.dateCreated).getTime();
  const outboundBeforeInbound = messages.filter(
    (message) => message.direction === 'outbound' && new Date(message.dateCreated).getTime() < inboundAt,
  ).length;

  if (outboundBeforeInbound < 3) return false;

  const hasOutboundAfterInbound = messages.some(
    (message) => message.direction === 'outbound' && new Date(message.dateCreated).getTime() > inboundAt,
  );

  if (hasOutboundAfterInbound) return false;

  const handledAt = lead?.handledAfterMsg2At ? new Date(lead.handledAfterMsg2At).getTime() : 0;
  if (handledAt && handledAt >= inboundAt) return false;

  return true;
}

export async function getConversationSummaries(): Promise<ConversationSummary[]> {
  const [recentMessages, leads] = await Promise.all([listRecentMessages(200), getLeads()]);
  const twilioNumber = normalizePhone(process.env.TWILIO_PHONE_NUMBER ?? '');
  const leadMap = new Map<string, LeadRow>();

  for (const lead of leads) {
    if (!leadMap.has(lead.normalizedPhone)) {
      leadMap.set(lead.normalizedPhone, lead);
    }
  }

  const groupedMessages = new Map<string, MessageItem[]>();
  for (const message of recentMessages) {
    const phone = getConversationPhone(message, twilioNumber);
    if (!phone) continue;
    const existing = groupedMessages.get(phone) ?? [];
    existing.push(message);
    groupedMessages.set(phone, existing);
  }

  const conversationMap = new Map<string, ConversationSummary>();

  for (const [phone, messages] of groupedMessages.entries()) {
    const sortedMessages = [...messages].sort(
      (a, b) => new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime(),
    );
    const latestMessage = sortedMessages[sortedMessages.length - 1] ?? null;
    const lead = leadMap.get(phone) ?? null;

    conversationMap.set(phone, {
      phone,
      normalizedPhone: phone,
      businessName: lead?.businessName ?? null,
      niche: lead?.niche ?? null,
      replied: lead?.replied ?? null,
      responseType: lead?.responseType ?? null,
      replyText: lead?.replyText ?? null,
      lastMessageAt: latestMessage?.dateCreated ?? null,
      lastMessageBody: latestMessage?.body ?? null,
      lastDirection: latestMessage?.direction ?? null,
      needsResponse: getNeedsResponse(sortedMessages, lead),
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
        needsResponse: false,
      });
    }
  }

  return Array.from(conversationMap.values()).sort((a, b) => {
    if (a.needsResponse !== b.needsResponse) {
      return a.needsResponse ? -1 : 1;
    }

    const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return bTime - aTime;
  });
}

export async function getConversationDetail(phone: string): Promise<ConversationDetail> {
  const [lead, messages] = await Promise.all([findLeadByPhone(phone), listMessagesForNumber(phone, 100)]);
  const normalizedPhone = normalizePhone(phone);

  return {
    conversation: {
      phone: normalizedPhone,
      normalizedPhone,
      businessName: lead?.businessName ?? null,
      niche: lead?.niche ?? null,
      replied: lead?.replied ?? null,
      responseType: lead?.responseType ?? null,
      replyText: lead?.replyText ?? null,
      lastMessageAt: messages[messages.length - 1]?.dateCreated ?? null,
      lastMessageBody: messages[messages.length - 1]?.body ?? null,
      lastDirection: messages[messages.length - 1]?.direction ?? null,
      needsResponse: getNeedsResponse(messages, lead),
    },
    lead,
    messages,
  };
}
