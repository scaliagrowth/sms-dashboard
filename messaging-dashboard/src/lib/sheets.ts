import { google } from 'googleapis';
import { normalizePhone } from '@/lib/phone';
import type { LeadRow } from '@/lib/types';

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

  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
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

function toLeadRow(values: string[], rowNumber: number): LeadRow {
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
    notes: values[13] ?? '',
  };
}

export async function getLeads(): Promise<LeadRow[]> {
  const sheets = getSheetsClient();
  const spreadsheetId = getEnv('GOOGLE_SHEET_ID');
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A:N`,
  });

  const rows = response.data.values ?? [];
  const dataRows = rows.slice(1);

  return dataRows
    .map((row, index) => toLeadRow(row, index + 2))
    .filter((lead) => lead.phone);
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
        {
          range: `${SHEET_NAME}!F${lead.rowNumber}`,
          values: [['Yes']],
        },
        {
          range: `${SHEET_NAME}!H${lead.rowNumber}`,
          values: [[replyText]],
        },
      ],
    },
  });

  return {
    ...lead,
    replied: 'Yes',
    replyText,
  };
}
