import { google } from 'googleapis';

const PIPELINE_SHEET = 'Pipeline';
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID!;

// Column order in the Pipeline sheet (1-indexed, row 1 = headers)
// A=ID, B=Name, C=Business, D=Phone, E=Source, F=Stage, G=Notes,
// H=MeetingDate, I=MeetingHour, J=MeetingMinute, K=CreatedAt

export type PipelineStage = 'needs-call' | 'meeting-booked' | 'closed' | 'dead';
export type PipelineSource = 'SMS' | 'Instagram DM' | 'Cold Call';

export interface PipelineLead {
  id: string;
  name: string;
  business: string;
  phone?: string;
  source: PipelineSource;
  stage: PipelineStage;
  notes: string;
  meetingDate?: string;
  meetingHour?: string;
  meetingMinute?: string;
  createdAt: string;
  rowNumber: number;
}

function getSheetsClient() {
  function getEnv(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Missing env var: ${name}`);
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

  const auth = new google.auth.JWT({
    email: getEnv('GOOGLE_CLIENT_EMAIL'),
    key: normalizePrivateKey(getEnv('GOOGLE_PRIVATE_KEY')),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

const HEADERS = [
  'ID', 'Name', 'Business', 'Phone', 'Source', 'Stage',
  'Notes', 'MeetingDate', 'MeetingHour', 'MeetingMinute', 'CreatedAt',
];

export async function ensurePipelineHeaders(): Promise<void> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${PIPELINE_SHEET}!A1:K1`,
  });
  const existing = res.data.values?.[0] ?? [];
  if (existing.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${PIPELINE_SHEET}!A1:K1`,
      valueInputOption: 'RAW',
      requestBody: { values: [HEADERS] },
    });
  }
}

function rowToLead(row: string[], rowNumber: number): PipelineLead {
  return {
    id: row[0] ?? '',
    name: row[1] ?? '',
    business: row[2] ?? '',
    phone: row[3] || undefined,
    source: (row[4] as PipelineSource) || 'SMS',
    stage: (row[5] as PipelineStage) || 'needs-call',
    notes: row[6] ?? '',
    meetingDate: row[7] || undefined,
    meetingHour: row[8] || undefined,
    meetingMinute: row[9] || undefined,
    createdAt: row[10] ?? new Date().toISOString(),
    rowNumber,
  };
}

export async function getPipelineLeads(): Promise<PipelineLead[]> {
  await ensurePipelineHeaders();
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${PIPELINE_SHEET}!A:K`,
  });
  const rows = res.data.values ?? [];
  // Skip header row (row 1 = index 0), data starts at row 2
  return rows
    .slice(1)
    .map((row, i) => rowToLead(row, i + 2))
    .filter((l) => l.id);
}

export async function addPipelineLead(
  lead: Omit<PipelineLead, 'rowNumber'>
): Promise<PipelineLead> {
  await ensurePipelineHeaders();
  const sheets = getSheetsClient();
  const row = [
    lead.id,
    lead.name,
    lead.business,
    lead.phone ?? '',
    lead.source,
    lead.stage,
    lead.notes,
    lead.meetingDate ?? '',
    lead.meetingHour ?? '',
    lead.meetingMinute ?? '',
    lead.createdAt,
  ];
  const appendRes = await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${PIPELINE_SHEET}!A:K`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
  // Figure out what row it landed on
  const updatedRange = appendRes.data.updates?.updatedRange ?? '';
  const match = updatedRange.match(/(\d+)$/);
  const rowNumber = match ? parseInt(match[1]) : -1;
  return { ...lead, rowNumber };
}

export async function updatePipelineLead(
  lead: Omit<PipelineLead, 'rowNumber'> & { rowNumber: number }
): Promise<void> {
  const sheets = getSheetsClient();
  const row = [
    lead.id,
    lead.name,
    lead.business,
    lead.phone ?? '',
    lead.source,
    lead.stage,
    lead.notes,
    lead.meetingDate ?? '',
    lead.meetingHour ?? '',
    lead.meetingMinute ?? '',
    lead.createdAt,
  ];
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${PIPELINE_SHEET}!A${lead.rowNumber}:K${lead.rowNumber}`,
    valueInputOption: 'RAW',
    requestBody: { values: [row] },
  });
}

export async function deletePipelineLead(rowNumber: number): Promise<void> {
  const sheets = getSheetsClient();
  // Get the sheet ID for the Pipeline tab
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = meta.data.sheets?.find(
    (s) => s.properties?.title === PIPELINE_SHEET
  );
  if (!sheet?.properties?.sheetId) throw new Error('Pipeline sheet not found');

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheet.properties.sheetId,
              dimension: 'ROWS',
              startIndex: rowNumber - 1,
              endIndex: rowNumber,
            },
          },
        },
      ],
    },
  });
}
