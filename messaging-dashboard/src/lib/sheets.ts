import { google } from 'googleapis';
import { normalizePhone } from '@/lib/phone';
import type { LeadRow, LeadUpdateInput } from '@/lib/types';

const HANDLED_MARKER = 'handled_after_msg2';
const ARCHIVED_MARKER = 'archived';
const FOLLOW_UP_MARKER = 'next_follow_up';
const DNC_MARKER = 'dnc';
const DASHBOARD_METADATA_HEADER = 'Dashboard Metadata';
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

function columnNumberToLetter(columnNumber: number): string {
  let value = columnNumber;
  let column = '';

  while (value > 0) {
    const remainder = (value - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    value = Math.floor((value - 1) / 26);
  }

  return column;
}

function findColumnLetter(headers: string[], headerName: string): string | null {
  const index = headers.findIndex((header) => header.trim().toLowerCase() === headerName.trim().toLowerCase());
  return index >= 0 ? columnNumberToLetter(index + 1) : null;
}

function getNotesColumnLetter(lead: LeadRow): string {
  return lead.notesColumn;
}

function getRequiredColumnLetter(headers: string[], headerName: string): string {
  const column = findColumnLetter(headers, headerName);
  if (!column) {
    throw new Error(`Missing required sheet column: ${headerName}`);
  }
  return column;
}

function getMetadataColumnLetter(headers: string[]): string {
  return getRequiredColumnLetter(headers, DASHBOARD_METADATA_HEADER);
}

async function updateLeadInSheet(
  lead: LeadRow,
  input: LeadUpdateInput & { 
    metadata: string;
    handledAfterMsg2At: string | null;
    nextFollowUpAt: string | null;
    archivedAt: string | null;
    dncAt: string | null;
  },
  sheets: any,
  spreadsheetId: string,
  headers: string[],
  notesColumn: string,
  metadataColumn: string
): Promise<LeadRow> {
  const businessNameColumn = getRequiredColumnLetter(headers, 'Business Name');
  const nicheColumn = getRequiredColumnLetter(headers, 'Niche');
  const responseTypeColumn = getRequiredColumnLetter(headers, 'Response Type (Interested / More Info / Not Interested)');
  const settingCallColumn = getRequiredColumnLetter(headers, 'Setting Call Booked');
  const zoomBookedColumn = getRequiredColumnLetter(headers, 'Zoom Booked');
  const showedColumn = getRequiredColumnLetter(headers, 'Showed');
  const closedColumn = getRequiredColumnLetter(headers, 'Closed');

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: `${SHEET_NAME}!${businessNameColumn}${lead.rowNumber}`, values: [[input.businessName]] },
        { range: `${SHEET_NAME}!${nicheColumn}${lead.rowNumber}`, values: [[input.niche]] },
        { range: `${SHEET_NAME}!${responseTypeColumn}${lead.rowNumber}`, values: [[input.responseType]] },
        { range: `${SHEET_NAME}!${settingCallColumn}${lead.rowNumber}`, values: [[input.settingCallBooked]] },
        { range: `${SHEET_NAME}!${zoomBookedColumn}${lead.rowNumber}`, values: [[input.zoomBooked]] },
        { range: `${SHEET_NAME}!${showedColumn}${lead.rowNumber}`, values: [[input.showed]] },
        { range: `${SHEET_NAME}!${closedColumn}${lead.rowNumber}`, values: [[input.closed]] },
        { range: `${SHEET_NAME}!${notesColumn}${lead.rowNumber}`, values: [[input.notes]] },
        { range: `${SHEET_NAME}!${metadataColumn}${lead.rowNumber}`, values: [[input.metadata]] },
      ],
    },
  });

  return {
    ...lead,
    businessName: input.businessName,
    niche: input.niche,
    responseType: input.responseType,
    settingCallBooked: input.settingCallBooked,
    zoomBooked: input.zoomBooked,
    showed: input.showed,
    closed: input.closed,
    notes: input.notes,
    handledAfterMsg2At: input.handledAfterMsg2At,
    nextFollowUpAt: input.nextFollowUpAt,
    archivedAt: input.archivedAt,
    dncAt: input.dncAt,
  };
}

function toLeadRow(values: string[], rowNumber: number, headers: string[]): LeadRow {
  const byHeader = (name: string) => {
    const idx = headers.findIndex((header) => header.trim().toLowerCase() === name.trim().toLowerCase());
    return idx >= 0 ? values[idx] ?? '' : '';
  };

  const notesColumn = getRequiredColumnLetter(headers, 'Notes');
  const metadata = byHeader(DASHBOARD_METADATA_HEADER) || byHeader('Notes');

  return {
    rowNumber,
    businessName: byHeader('Business Name'),
    phone: byHeader('Phone'),
    normalizedPhone: normalizePhone(byHeader('Phone')),
    niche: byHeader('Niche'),
    message1Sent: byHeader('Message 1 Sent'),
    replied: byHeader('Replied (Y/N)'),
    responseType: byHeader('Response Type (Interested / More Info / Not Interested)'),
    replyText: byHeader('Reply Text'),
    message2Sent: byHeader('Message 2 Sent'),
    settingCallBooked: byHeader('Setting Call Booked'),
    zoomBooked: byHeader('Zoom Booked'),
    showed: byHeader('Showed'),
    closed: byHeader('Closed'),
    message3Sent: byHeader('Message 3 Sent'),
    notes: byHeader('Notes'),
    notesColumn,
    // Read-only: dashboard-specific flag first, then legacy fallback for older rows.
    // This does NOT write/modify automation columns.
    needsResponseFlag: byHeader('Dashboard Needs Response') || byHeader('Needs Response'),
    handledAfterMsg2At: extractMarker(metadata, HANDLED_MARKER),
    archivedAt: extractMarker(metadata, ARCHIVED_MARKER),
    nextFollowUpAt: extractMarker(metadata, FOLLOW_UP_MARKER),
    dncAt: extractMarker(metadata, DNC_MARKER),
  };
}

export async function getLeads(): Promise<LeadRow[]> {
  const sheets = getSheetsClient();
  const spreadsheetId = getEnv('GOOGLE_SHEET_ID');
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A:ZZ`,
  });

  const rows = response.data.values ?? [];
  const headers = rows[0] ?? [];
  const dataRows = rows.slice(1);

  return dataRows.map((row, index) => toLeadRow(row, index + 2, headers)).filter((lead) => lead.phone);
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

  const handledAt = new Date().toISOString();
  const notesColumn = getNotesColumnLetter(lead);
  const sheets = getSheetsClient();
  const spreadsheetId = getEnv('GOOGLE_SHEET_ID');
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!1:1`,
  });
  const headers = response.data.values?.[0] ?? [];
  const metadataColumn = getMetadataColumnLetter(headers);

  const notes = (input.notes || '').trim();
  let metadata = '';
  metadata = setMarker(metadata, HANDLED_MARKER, handledAt);
  
  // Handle DNC status changes
  if (input.markDnc) {
    // Mark as DNC
    const normalizedResponseType = 'DNC';
    const normalizedClosed = '';
    metadata = setMarker(metadata, FOLLOW_UP_MARKER, null);
    metadata = setMarker(metadata, ARCHIVED_MARKER, handledAt);
    metadata = setMarker(metadata, DNC_MARKER, handledAt);
    
    return updateLeadInSheet(lead, {
      ...input,
      responseType: normalizedResponseType,
      closed: normalizedClosed,
      notes,
      metadata,
      handledAfterMsg2At: handledAt,
      nextFollowUpAt: null,
      archivedAt: handledAt,
      dncAt: handledAt,
    } as any, sheets, spreadsheetId, headers, notesColumn, metadataColumn);
  } else if (input.removeDnc) {
    // Remove from DNC (manual override) - comprehensive version
    const normalizedResponseType = 'Not interested'; // Always set to a clear response type
    const normalizedClosed = '';
    metadata = setMarker(metadata, FOLLOW_UP_MARKER, null);
    metadata = setMarker(metadata, ARCHIVED_MARKER, null);
    metadata = setMarker(metadata, DNC_MARKER, null); // Clear DNC completely
    
    console.log('Removing from DNC for phone:', input.phone);
    console.log('Setting responseType to:', normalizedResponseType);
    console.log('Current DNC marker:', lead.dncAt);
    
    return updateLeadInSheet(lead, {
      ...input,
      responseType: normalizedResponseType,
      closed: normalizedClosed,
      notes: `Removed from DNC: ${notes}`,
      metadata,
      handledAfterMsg2At: handledAt,
      nextFollowUpAt: null,
      archivedAt: null,
      dncAt: null,
    } as any, sheets, spreadsheetId, headers, notesColumn, metadataColumn);
  } else {
    // Normal update
    const normalizedResponseType = input.responseType;
    const normalizedClosed = input.closed;
    metadata = setMarker(metadata, FOLLOW_UP_MARKER, input.nextFollowUpAt || null);
    metadata = setMarker(metadata, ARCHIVED_MARKER, lead.archivedAt || null);
    metadata = setMarker(metadata, DNC_MARKER, lead.dncAt || null);
    
    return updateLeadInSheet(lead, {
      ...input,
      responseType: normalizedResponseType,
      closed: normalizedClosed,
      notes,
      metadata,
      handledAfterMsg2At: handledAt,
      nextFollowUpAt: input.nextFollowUpAt || null,
      archivedAt: lead.archivedAt,
      dncAt: lead.dncAt,
    } as any, sheets, spreadsheetId, headers, notesColumn, metadataColumn);
  }
}
