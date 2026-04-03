#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const SHEET_NAME = 'Sheet1';
const HANDLED_MARKER = 'handled_after_msg2';
const ARCHIVED_MARKER = 'archived';
const FOLLOW_UP_MARKER = 'next_follow_up';
const DNC_MARKER = 'dnc';
const DASHBOARD_METADATA_HEADER = 'Dashboard Metadata';

function readEnvFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value.replace(/\\n/g, '\n');
  }

  return env;
}

function requireEnv(env, key) {
  const value = env[key] || process.env[key];
  if (!value) throw new Error(`Missing env var: ${key}`);
  return value;
}

function extractMarker(notes, marker) {
  const match = notes.match(new RegExp(`\\[${marker}:\\s*([^\\]]+)\\]`, 'i'));
  return match ? match[1].trim() : null;
}

function removeMarker(notes, marker) {
  return notes.replace(new RegExp(`\\s*\\[${marker}:\\s*[^\\]]+\\]`, 'gi'), '').trim();
}

function setMarker(notes, marker, value) {
  const cleaned = removeMarker(notes, marker);
  if (!value) return cleaned;
  return `${cleaned}${cleaned ? ' ' : ''}[${marker}: ${value}]`.trim();
}

function columnNumberToLetter(columnNumber) {
  let value = columnNumber;
  let column = '';

  while (value > 0) {
    const remainder = (value - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    value = Math.floor((value - 1) / 26);
  }

  return column;
}

function findColumnLetter(headers, headerName) {
  const index = headers.findIndex((header) => String(header || '').trim().toLowerCase() === headerName.trim().toLowerCase());
  return index >= 0 ? columnNumberToLetter(index + 1) : null;
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const envPath = path.join(root, '.env.local');
  const env = readEnvFile(envPath);

  const auth = new google.auth.JWT({
    email: requireEnv(env, 'GOOGLE_CLIENT_EMAIL'),
    key: requireEnv(env, 'GOOGLE_PRIVATE_KEY'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = requireEnv(env, 'GOOGLE_SHEET_ID');
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A:ZZ`,
  });

  const rows = response.data.values || [];
  const headers = rows[0] || [];
  const metadataColumn = findColumnLetter(headers, DASHBOARD_METADATA_HEADER);
  if (!metadataColumn) {
    throw new Error(`Missing required sheet column: ${DASHBOARD_METADATA_HEADER}`);
  }

  const updates = [];

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i] || [];
    const rowNumber = i + 1;
    const responseType = (row[6] || '').trim().toUpperCase();
    if (responseType !== 'DNC') continue;

    const metadataIndex = headers.findIndex((header) => String(header || '').trim().toLowerCase() === DASHBOARD_METADATA_HEADER.toLowerCase());
    const existingMetadata = metadataIndex >= 0 ? row[metadataIndex] || '' : '';
    const stamp = extractMarker(existingMetadata, DNC_MARKER)
      || extractMarker(existingMetadata, ARCHIVED_MARKER)
      || extractMarker(existingMetadata, HANDLED_MARKER)
      || new Date().toISOString();

    let nextMetadata = existingMetadata;
    nextMetadata = setMarker(nextMetadata, HANDLED_MARKER, stamp);
    nextMetadata = setMarker(nextMetadata, ARCHIVED_MARKER, stamp);
    nextMetadata = setMarker(nextMetadata, DNC_MARKER, stamp);
    nextMetadata = setMarker(nextMetadata, FOLLOW_UP_MARKER, null);

    if (nextMetadata !== existingMetadata) {
      updates.push({
        range: `${SHEET_NAME}!${metadataColumn}${rowNumber}`,
        values: [[nextMetadata]],
      });
    }
  }

  if (!updates.length) {
    console.log('No DNC cleanup changes needed.');
    return;
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: updates,
    },
  });

  console.log(`Cleaned ${updates.length} DNC row(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
