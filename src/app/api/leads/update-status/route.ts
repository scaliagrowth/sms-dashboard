import { NextResponse } from 'next/server';
import { updateLeadFields } from '@/lib/sheets';
import type { LeadUpdateInput } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const validResponseTypes = ['', 'Highly interested', 'Interested', 'More info', 'Not interested', 'DNC'];

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<LeadUpdateInput>;
    const payload: LeadUpdateInput = {
      phone: String(body.phone ?? '').trim(),
      businessName: String(body.businessName ?? '').trim(),
      niche: String(body.niche ?? '').trim(),
      responseType: String(body.responseType ?? '').trim(),
      settingCallBooked: String(body.settingCallBooked ?? '').trim(),
      zoomBooked: String(body.zoomBooked ?? '').trim(),
      showed: String(body.showed ?? '').trim(),
      closed: String(body.closed ?? '').trim(),
      notes: String(body.notes ?? '').trim(),
      nextFollowUpAt: String(body.nextFollowUpAt ?? '').trim(),
      markDnc: Boolean(body.markDnc),
    };

    if (!payload.phone) {
      return NextResponse.json({ error: 'Phone is required.' }, { status: 400 });
    }

    if (!payload.markDnc && !validResponseTypes.includes(payload.responseType)) {
      return NextResponse.json({ error: 'Invalid response type.' }, { status: 400 });
    }

    const updatedLead = await updateLeadFields(payload);
    if (!updatedLead) {
      return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, updatedLead });
  } catch (error) {
    console.error('POST /api/leads/update-status failed', error);
    return NextResponse.json({ error: 'Failed to update lead details.' }, { status: 500 });
  }
}
