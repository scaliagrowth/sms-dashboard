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
  notesColumn: 'N' | 'O';
  handledAfterMsg2At?: string | null;
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
};

export type ConversationDetail = {
  conversation: ConversationSummary;
  lead: LeadRow | null;
  messages: MessageItem[];
};
