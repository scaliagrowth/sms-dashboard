import { NextResponse } from 'next/server';
import { updateLeadReply } from '@/lib/sheets';
import { sendSms } from '@/lib/twilio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const phone = String(body.phone ?? '').trim();
    const message = String(body.message ?? '').trim();

    if (!phone || !message) {
      return NextResponse.json({ error: 'Phone and message are required.' }, { status: 400 });
    }

    const result = await sendSms(phone, message);
    const updatedLead = await updateLeadReply(phone, message);

    return NextResponse.json({
      success: true,
      sid: result.sid,
      updatedLead,
    });
  } catch (error) {
    console.error('POST /api/messages/send failed', error);
    return NextResponse.json({ error: 'Failed to send SMS.' }, { status: 500 });
  }
}
