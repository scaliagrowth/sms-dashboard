# Messaging Dashboard v1

Simple deployable SMS inbox built with **Next.js + Twilio + Google Sheets**.

## What it does

- Shows a conversation list by phone number
- Links each conversation to the matching business in Google Sheets when possible
- Shows Twilio message history for a selected lead
- Lets you manually send SMS replies through Twilio
- Updates only these Google Sheet fields on manual send:
  - `F = Replied (Y/N)` → `Yes`
  - `H = Reply Text` → latest manual reply text

## What it does not do in v1

- Does **not** modify your Twilio inbound webhook
- Does **not** modify your Make.com scenarios
- Does **not** use a separate database
- Does **not** update any other Google Sheet columns

---

## Environment variables

Copy `.env.local.example` to `.env.local` and fill in your real values.

```bash
cp .env.local.example .env.local
```

Required:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `GOOGLE_CLIENT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `GOOGLE_SHEET_ID`
- `NEXT_PUBLIC_APP_NAME` (optional)

### Important note for `GOOGLE_PRIVATE_KEY`

Keep the value wrapped in quotes and preserve the `\n` line breaks, for example:

```env
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nABC123...\n-----END PRIVATE KEY-----\n"
```

---

## Google service account setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or use an existing one
3. Enable the **Google Sheets API**
4. Open **APIs & Services → Credentials**
5. Click **Create Credentials → Service Account**
6. Create the service account
7. Open the new service account and go to **Keys**
8. Click **Add Key → Create new key → JSON**
9. Download the JSON file
10. Use these values from the JSON file:
    - `client_email` → `GOOGLE_CLIENT_EMAIL`
    - `private_key` → `GOOGLE_PRIVATE_KEY`
11. Open your `CRM` spreadsheet
12. Click **Share**
13. Share the sheet with the service account email as **Editor**
14. Copy the spreadsheet ID from the sheet URL and set it as `GOOGLE_SHEET_ID`

Example spreadsheet URL:

```text
https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890/edit#gid=0
```

Spreadsheet ID:

```text
1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890
```

---

## Local development

Install dependencies:

```bash
npm install
```

Run the app:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## Deploying

### Recommended: Vercel

1. Push this folder to GitHub
2. Import the repo into Vercel
3. Set these environment variables in the Vercel project settings:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER`
   - `GOOGLE_CLIENT_EMAIL`
   - `GOOGLE_PRIVATE_KEY`
   - `GOOGLE_SHEET_ID`
   - `NEXT_PUBLIC_APP_NAME`
4. Deploy

### Important deployment note

For `GOOGLE_PRIVATE_KEY` in Vercel, paste the full private key exactly as a single env var value. The app converts `\n` into real line breaks at runtime.

---

## API endpoints

- `GET /api/conversations`
  - returns inbox sidebar data
- `GET /api/conversations/:phone`
  - returns selected conversation thread + lead details
- `POST /api/messages/send`
  - sends a Twilio SMS and updates sheet columns F + H
- `GET /api/leads`
  - returns normalized lead data from Google Sheets

---

## Matching logic

- Reads phone numbers from Google Sheets column `C`
- Normalizes both Twilio and Google Sheets numbers before matching
- If duplicate phone numbers exist, **the first match is used** for v1

---

## Current data flow

### Inbound SMS

```text
Lead SMS -> Twilio -> existing inbound webhook -> Make.com
```

Unchanged.

### Dashboard reads

```text
Dashboard UI -> Next.js API -> Google Sheets + Twilio REST API
```

### Manual reply

```text
Dashboard UI -> Next.js API -> Twilio send
                         -> Google Sheets update (F + H only)
```

---

## Notes

- Twilio history is pulled using the Twilio REST API
- If later you want better inbound syncing or real-time updates, Make.com can forward inbound copies to a dashboard endpoint after v1
