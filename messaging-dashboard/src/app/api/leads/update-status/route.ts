import { NextResponse } from 'next/server';
import { updateLeadStatusFields } from '@/lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const phone = String(body.phone ?? '').trim();
    const responseType = String(body.responseType ?? '').trim();
    const settingCallBooked = String(body.settingCallBooked ?? '').trim();

    if (!phone) {
      return NextResponse.json({ error: 'Phone is required.' }, { status: 400 });
    }

    const validResponseTypes = ['', 'Interested', 'More info', 'Not interested'];
    const validSettingCallValues = ['', 'Yes'];

    if (!validResponseTypes.includes(responseType)) {
      return NextResponse.json({ error: 'Invalid response type.' }, { status: 400 });
    }

    if (!validSettingCallValues.includes(settingCallBooked)) {
      return NextResponse.json({ error: 'Invalid setting call value.' }, { status: 400 });
    }

    const updatedLead = await updateLeadStatusFields(phone, responseType, settingCallBooked);

    if (!updatedLead) {
      return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, updatedLead });
  } catch (error) {
    console.error('POST /api/leads/update-status failed', error);
    return NextResponse.json({ error: 'Failed to update lead status.' }, { status: 500 });
  }
}
