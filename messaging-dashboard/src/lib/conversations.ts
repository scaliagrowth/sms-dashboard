import { normalizePhone } from '@/lib/phone';
import { findLeadByPhone, getLeads } from '@/lib/sheets';
import { listMessagesForNumber, listRecentMessages } from '@/lib/twilio';
import type { ConversationDetail, ConversationSummary, LeadRow, LeadWorkflowStatus, MessageItem } from '@/lib/types';

function getConversationPhone(message: { from: string; to: string }, twilioNumber: string) {
  const from = normalizePhone(message.from);
  const to = normalizePhone(message.to);
  return from === twilioNumber ? to : from;
}

function getNeedsResponse(messages: MessageItem[], lead: LeadRow | null): { value: boolean; reason: string } {
  if ((lead?.responseType || '').trim().toUpperCase() === 'DNC') return { value: false, reason: 'dnc' };
  if ((lead?.closed || '').trim().toLowerCase() === 'yes') return { value: false, reason: 'closed' };

  if (!messages.length) {
    // Safe mode: never infer needs-response from sheet reply fields alone.
    // This avoids stale false positives on older leads.
    return { value: false, reason: 'no_messages' };
  }

  // Badge should mean: lead spoke last and we have not replied after that.
  const latestMessage = messages[messages.length - 1];
  if (!latestMessage || latestMessage.direction !== 'inbound') return { value: false, reason: 'latest_not_inbound' };

  const latestInboundAt = new Date(latestMessage.dateCreated).getTime();

  const hasOutboundAfterLatestInbound = messages.some(
    (message) => message.direction === 'outbound' && new Date(message.dateCreated).getTime() > latestInboundAt,
  );

  if (hasOutboundAfterLatestInbound) return { value: false, reason: 'outbound_after_inbound' };

  const handledAt = lead?.handledAfterMsg2At ? new Date(lead.handledAfterMsg2At).getTime() : 0;
  if (handledAt && handledAt >= latestInboundAt) return { value: false, reason: 'handled_after_inbound' };

  return { value: true, reason: 'lead_spoke_last' };
}

function getWorkflowStatus(lead: LeadRow | null): LeadWorkflowStatus {
  // Check DNC first - case insensitive
  if (lead?.responseType && (lead.responseType.trim().toUpperCase() === 'DNC')) {
    return 'dnc';
  }
  
  // Check closed status - case insensitive
  if (lead?.closed && (lead.closed.trim().toLowerCase() === 'yes')) {
    return 'closed';
  }
  
  // Check for follow-up
  if (lead?.nextFollowUpAt) {
    return 'follow-up';
  }
  
  // Default to active
  return 'active';
}

function toConversationSummary(phone: string, messages: MessageItem[], lead: LeadRow | null): ConversationSummary {
  const sortedMessages = [...messages].sort((a, b) => new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime());
  const latestMessage = sortedMessages[sortedMessages.length - 1] ?? null;
  const needs = getNeedsResponse(sortedMessages, lead);

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
    needsResponse: needs.value,
    needsResponseReason: needs.reason,
    workflowStatus: getWorkflowStatus(lead),
    isArchived: Boolean(lead?.archivedAt),
    nextFollowUpAt: lead?.nextFollowUpAt ?? null,
  };
}

export async function getConversationSummaries(): Promise<ConversationSummary[]> {
  const [recentMessages, leads] = await Promise.all([listRecentMessages(1000), getLeads()]);
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
