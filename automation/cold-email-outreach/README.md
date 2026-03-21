# Cold Email Outreach (Scalia Growth)

This OpenClaw automation mirrors the original n8n workflow end-to-end:

- Weekday trigger at 7 AM ET (or manual run)
- Brave Search lead discovery
- Duplicate/blacklist detection against the Google Sheets tabs (`sent_emails` & `blacklist`)
- Website research + OpenAI business analysis (same prompts and behavior)
- Personalized email generation (same style, prompts, and JSON output)
- Random send delay + SMTP delivery
- Logging of successes/failures back into Google Sheets

## Requirements

1. Node.js 22+ (already provided in this workspace).
2. A `.env` file based on `.env.example` populated with the Brave token, SMTP credentials, GoG keyring password, and the optional `OPENCLAW_AGENT_ID`/`OPENCLAW_AUTH_PROFILES_PATH` overrides if you run a non-default agent.
3. The `openclaw` CLI available in this workspace so the script can call your `kernel` agent (or whichever agent you specified) via `openclaw agent --local --message ...`.
4. GoG authorized for `scaliagrowth@gmail.com` with access to the `sent_emails` and `blacklist` tabs.
5. Access to the referenced Google Sheets documents so the automation can read/write leads.

## Setup

```bash
cd automation/cold-email-outreach
cp .env.example .env
# edit .env and fill the required secrets (SMTP creds, GOG_KEYRING_PASSWORD, optional overrides)
npm install
```

## Running

- `npm run start` executes the workflow immediately and keeps the cron scheduler running on weekdays at 7 AM ET.
- Set `RUN_ONCE=true` in `.env` if you want a single execution without the scheduler.
- `TEST_TARGET_EMAIL` can redirect every send to a single inbox (like `scaliagrowth@gmail.com`) while the logs continue to reference the original lead.
- The script already logs each step, including search results, delay waits, SMTP success/failure, and Google Sheets updates.

## Original behavior preserved

- Lead discovery, analysis, and email generation prompts/code are verbatim from your n8n workflow.
- Duplicate prevention relies on the same Google Sheets tabs and `email` column.
- Random delay (3–7 minutes) is unchanged.
- SMTP success logic (`accepted.length > 0`) stays the same.
- Sent logging now appends `email`, `business_name`, `subject`, `body`, `sent_at`, `status`, `website`, and `location` so the exact outbound message is reviewable in Google Sheets.
- Bounced logging behavior is unchanged.

If any credentials change (OpenAI model availability, SMTP server, GoG password/sheets), update `.env` and restart the script. Let me know if you want me to drop a heartbeat explorer or add monitoring outputs.