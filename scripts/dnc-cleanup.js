#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const SHEET_NAME = 'Sheet1';
const HANDLED_MARKER = 'handled_after_msg2';
const ARCHIVED_MARKER = 'archived';
const FOLLOW_UP_MARKER = 'next_follow_up';
const DNC_MARKER = 'dnc';

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
    range: `${SHEET_NAME}!A:O`,
  });

  const rows = response.data.values || [];
  const updates = [];

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i] || [];
    const rowNumber = i + 1;
    const responseType = (row[6] || '').trim().toUpperCase();
    if (responseType !== 'DNC') continue;

    const hasMessage3Column = row.length >= 15;
    const notesIndex = hasMessage3Column ? 14 : 13;
    const notesColumn = hasMessage3Column ? 'O' : 'N';
    const existingNotes = row[notesIndex] || '';
    const stamp = extractMarker(existingNotes, DNC_MARKER)
      || extractMarker(existingNotes, ARCHIVED_MARKER)
      || extractMarker(existingNotes, HANDLED_MARKER)
      || new Date().toISOString();

    let nextNotes = existingNotes;
    nextNotes = setMarker(nextNotes, HANDLED_MARKER, stamp);
    nextNotes = setMarker(nextNotes, ARCHIVED_MARKER, stamp);
    nextNotes = setMarker(nextNotes, DNC_MARKER, stamp);
    nextNotes = setMarker(nextNotes, FOLLOW_UP_MARKER, null);

    if (nextNotes !== existingNotes) {
      updates.push({
        range: `${SHEET_NAME}!${notesColumn}${rowNumber}`,
        values: [[nextNotes]],
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
