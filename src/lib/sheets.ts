import { google } from 'googleapis';
import { normalizePhone } from '@/lib/phone';
import type { LeadRow, LeadUpdateInput } from '@/lib/types';

const HANDLED_MARKER = 'handled_after_msg2';
const ARCHIVED_MARKER = 'archived';
const FOLLOW_UP_MARKER = 'next_follow_up';
const DNC_MARKER = 'dnc';
const SHEET_NAME = 'Sheet1';

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function normalizePrivateKey(rawKey: string): string {
  let normalized = rawKey.trim();

  if ((normalized.startsWith('"') && normalized.endsWith('"')) || (normalized.startsWith("'") && normalized.endsWith("'"))) {
    normalized = normalized.slice(1, -1);
  }

  normalized = normalized.replace(/\\n/g, '\n');
  return normalized;
}

function getSheetsClient() {
  const auth = new google.auth.JWT({
    email: getEnv('GOOGLE_CLIENT_EMAIL'),
    key: normalizePrivateKey(getEnv('GOOGLE_PRIVATE_KEY')),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

function extractMarker(notes: string, marker: string): string | null {
  const regex = new RegExp(`\\[${marker}:\\s*([^\\]]+)\\]`, 'i');
  const match = notes.match(regex);
  return match?.[1]?.trim() ?? null;
}

function removeMarker(notes: string, marker: string): string {
  return notes.replace(new RegExp(`\\s*\\[${marker}:\\s*[^\\]]+\\]`, 'gi'), '').trim();
}

function setMarker(notes: string, marker: string, value: string | null): string {
  const cleaned = removeMarker(notes, marker);
  if (!value) return cleaned;
  return `${cleaned}${cleaned ? ' ' : ''}[${marker}: ${value}]`.trim();
}

function hasMessage3Column(values: string[]): boolean {
  return values.length >= 15;
}

function getNotesColumnLetter(lead: LeadRow): string {
  return lead.message3Sent ? 'O' : 'N';
}

function toLeadRow(values: string[], rowNumber: number): LeadRow {
  const message3Enabled = hasMessage3Column(values);
  const notes = message3Enabled ? values[14] ?? '' : values[13] ?? '';

  return {
    rowNumber,
    businessName: values[1] ?? '',
    phone: values[2] ?? '',
    normalizedPhone: normalizePhone(values[2] ?? ''),
    niche: values[3] ?? '',
    message1Sent: values[4] ?? '',
    replied: values[5] ?? '',
    responseType: values[6] ?? '',
    replyText: values[7] ?? '',
    message2Sent: values[8] ?? '',
    settingCallBooked: values[9] ?? '',
    zoomBooked: values[10] ?? '',
    showed: values[11] ?? '',
    closed: values[12] ?? '',
    message3Sent: message3Enabled ? values[13] ?? '' : '',
    notes,
    notesColumn: message3Enabled ? 'O' : 'N',
    handledAfterMsg2At: extractMarker(notes, HANDLED_MARKER),
    archivedAt: extractMarker(notes, ARCHIVED_MARKER),
    nextFollowUpAt: extractMarker(notes, FOLLOW_UP_MARKER),
    dncAt: extractMarker(notes, DNC_MARKER),
  };
}

export async function getLeads(): Promise<LeadRow[]> {
  const sheets = getSheetsClient();
  const spreadsheetId = getEnv('GOOGLE_SHEET_ID');
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A:O`,
  });

  const rows = response.data.values ?? [];
  const dataRows = rows.slice(1);

  return dataRows.map((row, index) => toLeadRow(row, index + 2)).filter((lead) => lead.phone);
}

export async function findLeadByPhone(phone: string): Promise<LeadRow | null> {
  const normalized = normalizePhone(phone);
  const leads = await getLeads();
  return leads.find((lead) => lead.normalizedPhone === normalized) ?? null;
}

export async function updateLeadReply(phone: string, replyText: string): Promise<LeadRow | null> {
  const lead = await findLeadByPhone(phone);
  if (!lead) return null;

  const sheets = getSheetsClient();
  const spreadsheetId = getEnv('GOOGLE_SHEET_ID');

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: `${SHEET_NAME}!F${lead.rowNumber}`, values: [['Yes']] },
        { range: `${SHEET_NAME}!H${lead.rowNumber}`, values: [[replyText]] },
      ],
    },
  });

  return {
    ...lead,
    replied: 'Yes',
    replyText,
  };
}

export async function updateLeadFields(input: LeadUpdateInput): Promise<LeadRow | null> {
  const lead = await findLeadByPhone(input.phone);
  if (!lead) return null;

  const normalizedResponseType = input.markDnc ? 'DNC' : input.responseType;
  const normalizedClosed = input.markDnc ? '' : input.closed;
  const handledAt = new Date().toISOString();
  const notesColumn = getNotesColumnLetter(lead);

  let notes = (input.notes || '').trim();
  notes = setMarker(notes, HANDLED_MARKER, handledAt);
  notes = setMarker(notes, FOLLOW_UP_MARKER, input.markDnc ? null : input.nextFollowUpAt || null);
  notes = setMarker(notes, ARCHIVED_MARKER, input.markDnc ? handledAt : null);
  notes = setMarker(notes, DNC_MARKER, input.markDnc ? handledAt : null);

  const sheets = getSheetsClient();
  const spreadsheetId = getEnv('GOOGLE_SHEET_ID');

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: `${SHEET_NAME}!B${lead.rowNumber}`, values: [[input.businessName]] },
        { range: `${SHEET_NAME}!D${lead.rowNumber}`, values: [[input.niche]] },
        { range: `${SHEET_NAME}!G${lead.rowNumber}`, values: [[normalizedResponseType]] },
        { range: `${SHEET_NAME}!J${lead.rowNumber}`, values: [[input.settingCallBooked]] },
        { range: `${SHEET_NAME}!K${lead.rowNumber}`, values: [[input.zoomBooked]] },
        { range: `${SHEET_NAME}!L${lead.rowNumber}`, values: [[input.showed]] },
        { range: `${SHEET_NAME}!M${lead.rowNumber}`, values: [[normalizedClosed]] },
        { range: `${SHEET_NAME}!${notesColumn}${lead.rowNumber}`, values: [[notes]] },
      ],
    },
  });

  return {
    ...lead,
    businessName: input.businessName,
    niche: input.niche,
    responseType: normalizedResponseType,
    settingCallBooked: input.settingCallBooked,
    zoomBooked: input.zoomBooked,
    showed: input.showed,
    closed: normalizedClosed,
    notes,
    handledAfterMsg2At: handledAt,
    nextFollowUpAt: input.markDnc ? null : input.nextFollowUpAt || null,
    archivedAt: input.markDnc ? handledAt : null,
    dncAt: input.markDnc ? handledAt : null,
  };
}
