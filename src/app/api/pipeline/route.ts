import { NextResponse } from 'next/server';
import { getPipelineLeads, addPipelineLead } from '@/lib/pipeline';

export async function GET() {
  try {
    const leads = await getPipelineLeads();
    return NextResponse.json({ leads });
  } catch (error) {
    console.error('GET /api/pipeline error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load pipeline leads.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, name, business, phone, source, stage, notes, meetingDate, meetingHour, meetingMinute } = body;

    if (!id || !name || !business || !source || !stage) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    const lead = await addPipelineLead({
      id,
      name,
      business,
      phone: phone || undefined,
      source,
      stage,
      notes: notes || '',
      meetingDate: meetingDate || undefined,
      meetingHour: meetingHour || undefined,
      meetingMinute: meetingMinute || undefined,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ lead });
  } catch (error) {
    console.error('POST /api/pipeline error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add lead.' },
      { status: 500 }
    );
  }
}
