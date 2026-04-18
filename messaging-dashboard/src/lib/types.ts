export type LeadRow = {
  rowNumber: number;
  businessName: string;
  phone: string;
  normalizedPhone: string;
  niche: string;
  message1Sent: string;
  replied: string;
  responseType: string;
  replyText: string;
  message2Sent: string;
  settingCallBooked: string;
  zoomBooked: string;
  showed: string;
  closed: string;
  message3Sent: string;
  notes: string;
  notesColumn: string;
  needsResponseFlag?: string;
  handledAfterMsg2At?: string | null;
  archivedAt?: string | null;
  nextFollowUpAt?: string | null;
  dncAt?: string | null;
};

export type MessageItem = {
  sid: string;
  direction: 'inbound' | 'outbound';
  body: string;
  dateCreated: string;
  status: string;
  from: string;
  to: string;
};

export type LeadWorkflowStatus = 'active' | 'follow-up' | 'closed' | 'dnc';

export type ConversationSummary = {
  phone: string;
  normalizedPhone: string;
  businessName: string | null;
  niche: string | null;
  replied: string | null;
  responseType: string | null;
  replyText: string | null;
  lastMessageAt: string | null;
  lastMessageBody: string | null;
  lastDirection: 'inbound' | 'outbound' | null;
  needsResponse: boolean;
  needsResponseReason?: string;
  workflowStatus: LeadWorkflowStatus;
  isArchived: boolean;
  nextFollowUpAt: string | null;
};

export type ConversationDetail = {
  conversation: ConversationSummary;
  lead: LeadRow | null;
  messages: MessageItem[];
};

export type LeadUpdateInput = {
  phone: string;
  businessName: string;
  niche: string;
  responseType: string;
  settingCallBooked: string;
  zoomBooked: string;
  showed: string;
  closed: string;
  notes: string;
  nextFollowUpAt: string;
  markDnc: boolean;
  removeDnc: boolean;
};
