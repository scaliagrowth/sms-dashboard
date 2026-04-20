import { normalizePhone } from '@/lib/phone';
import { findLeadByPhone, getLeads } from '@/lib/sheets';
import { listMessagesForNumber, listRecentMessages } from '@/lib/twilio';
import type { ConversationDetail, ConversationSummary, LeadRow, LeadWorkflowStatus, MessageItem } from '@/lib/types';

function getConversationPhone(message: { from: string; to: string }, twilioNumber: string) {
  const from = normalizePhone(message.from);
  const to = normalizePhone(message.to);
  return from === twilioNumber ? to : from;
}

function getNeedsResponse(messages: MessageItem[], lead: LeadRow | null): boolean {
  if (!messages.length) return false;
  // DNC and closed leads never need a response
  if ((lead?.responseType || '').trim().toUpperCase() === 'DNC') return false;
  if ((lead?.closed || '').trim().toLowerCase() === 'yes') return false;

  // Find the most recent inbound message
  const lastInboundIndex = [...messages].reverse().findIndex((message) => message.direction === 'inbound');
  if (lastInboundIndex === -1) return false;

  const inboundMessage = messages[messages.length - 1 - lastInboundIndex];
  const inboundAt = new Date(inboundMessage.dateCreated).getTime();

  // needsResponse = true only when there is NO outbound reply after the last inbound
  const hasOutboundAfterInbound = messages.some(
    (message) => message.direction === 'outbound' && new Date(message.dateCreated).getTime() > inboundAt,
  );
  if (hasOutboundAfterInbound) return false;

  // If the lead was manually marked as handled after the inbound timestamp, skip it
  const handledAt = lead?.handledAfterMsg2At ? new Date(lead.handledAfterMsg2At).getTime() : 0;
  if (handledAt && handledAt >= inboundAt) return false;

  return true;
}

function getWorkflowStatus(lead: LeadRow | null): LeadWorkflowStatus {
  if (lead?.responseType && lead.responseType.trim().toUpperCase() === 'DNC') {
    return 'dnc';
  }
  if (lead?.closed && lead.closed.trim().toLowerCase() === 'yes') {
    return 'closed';
  }
  if (lead?.nextFollowUpAt) {
    return 'follow-up';
  }
  return 'active';
}

function toConversationSummary(phone: string, messages: MessageItem[], lead: LeadRow | null): ConversationSummary {
  const sortedMessages = [...messages].sort((a, b) => new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime());
  const latestMessage = sortedMessages[sortedMessages.length - 1] ?? null;

  return {
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
    workflowStatus: getWorkflowStatus(lead),
    isArchived: Boolean(lead?.archivedAt),
    nextFollowUpAt: lead?.nextFollowUpAt ?? null,
  };
}

export async function getConversationSummaries(): Promise<ConversationSummary[]> {
  const [recentMessages, leads] = await Promise.all([listRecentMessages(), getLeads()]);
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
    const lead = leadMap.get(phone) ?? null;
    conversationMap.set(phone, toConversationSummary(phone, messages, lead));
  }

  for (const lead of leads) {
    if (lead.normalizedPhone && !conversationMap.has(lead.normalizedPhone)) {
      conversationMap.set(lead.normalizedPhone, toConversationSummary(lead.normalizedPhone, [], lead));
    }
  }

  return Array.from(conversationMap.values()).sort((a, b) => {
    if (a.isArchived !== b.isArchived) return a.isArchived ? 1 : -1;
    if (a.needsResponse !== b.needsResponse) return a.needsResponse ? -1 : 1;
    const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return bTime - aTime;
  });
}

export async function getConversationDetail(phone: string): Promise<ConversationDetail> {
  const [lead, messages] = await Promise.all([findLeadByPhone(phone), listMessagesForNumber(phone, 100)]);
  const normalizedPhone = normalizePhone(phone);

  return {
    conversation: toConversationSummary(normalizedPhone, messages, lead),
    lead,
    messages,
  };
}
