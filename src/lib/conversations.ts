import { normalizePhone } from '@/lib/phone';
import { findLeadByPhone, getLeads } from '@/lib/sheets';
import { getLeadPhone, getOurNumberForMessage, getOurNumbers, listMessagesForNumber, listRecentMessages } from '@/lib/twilio';
import type { ConversationDetail, ConversationSummary, LeadRow, LeadWorkflowStatus, MessageItem } from '@/lib/types';

function getNeedsResponse(messages: MessageItem[], lead: LeadRow | null): boolean {
  if (!messages.length) return false;
  if ((lead?.responseType || '').trim().toUpperCase() === 'DNC') return false;
  if ((lead?.closed || '').trim().toLowerCase() === 'yes') return false;

  const lastInboundIndex = [...messages].reverse().findIndex((m) => m.direction === 'inbound');
  if (lastInboundIndex === -1) return false;

  const inboundMessage = messages[messages.length - 1 - lastInboundIndex];
  const inboundAt = new Date(inboundMessage.dateCreated).getTime();

  const hasOutboundAfterInbound = messages.some(
    (m) => m.direction === 'outbound' && new Date(m.dateCreated).getTime() > inboundAt,
  );
  if (hasOutboundAfterInbound) return false;

  const handledAt = lead?.handledAfterMsg2At ? new Date(lead.handledAfterMsg2At).getTime() : 0;
  if (handledAt && handledAt >= inboundAt) return false;

  return true;
}

function getWorkflowStatus(lead: LeadRow | null): LeadWorkflowStatus {
  if (lead?.responseType && lead.responseType.trim().toUpperCase() === 'DNC') return 'dnc';
  if (lead?.closed && lead.closed.trim().toLowerCase() === 'yes') return 'closed';
  if (lead?.nextFollowUpAt) return 'follow-up';
  return 'active';
}

// Derive the best "ourNumber" for a conversation from its messages.
// Uses the most recently sent message's our-side number.
function deriveOurNumber(messages: MessageItem[], ourNumbers: Set<string>): string | null {
  const sorted = [...messages].sort(
    (a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime(),
  );
  for (const m of sorted) {
    const n = getOurNumberForMessage(m, ourNumbers);
    if (n) return n;
  }
  return null;
}

function toConversationSummary(
  phone: string,
  messages: MessageItem[],
  lead: LeadRow | null,
  ourNumbers: Set<string>,
): ConversationSummary {
  const sortedMessages = [...messages].sort(
    (a, b) => new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime(),
  );
  const latestMessage = sortedMessages[sortedMessages.length - 1] ?? null;

  return {
    phone,
    normalizedPhone: phone,
    ourNumber: deriveOurNumber(messages, ourNumbers),
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
  const [recentMessages, leads, ourNumbers] = await Promise.all([
    listRecentMessages(),
    getLeads(),
    getOurNumbers(),
  ]);

  const leadMap = new Map<string, LeadRow>();
  for (const lead of leads) {
    if (!leadMap.has(lead.normalizedPhone)) {
      leadMap.set(lead.normalizedPhone, lead);
    }
  }

  // Group messages by lead phone number
  const groupedMessages = new Map<string, MessageItem[]>();
  for (const message of recentMessages) {
    const phone = getLeadPhone(message, ourNumbers);
    if (!phone) continue;
    const existing = groupedMessages.get(phone) ?? [];
    existing.push(message);
    groupedMessages.set(phone, existing);
  }

  const conversationMap = new Map<string, ConversationSummary>();

  for (const [phone, messages] of groupedMessages.entries()) {
    const lead = leadMap.get(phone) ?? null;
    conversationMap.set(phone, toConversationSummary(phone, messages, lead, ourNumbers));
  }

  // Add leads that have no Twilio messages yet
  for (const lead of leads) {
    if (lead.normalizedPhone && !conversationMap.has(lead.normalizedPhone)) {
      conversationMap.set(
        lead.normalizedPhone,
        toConversationSummary(lead.normalizedPhone, [], lead, ourNumbers),
      );
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
  const [lead, ourNumbers] = await Promise.all([findLeadByPhone(phone), getOurNumbers()]);
  const messages = await listMessagesForNumber(phone, 100);
  const normalizedPhone = normalizePhone(phone);

  return {
    conversation: toConversationSummary(normalizedPhone, messages, lead, ourNumbers),
    lead,
    messages,
  };
}
