import { NextResponse } from 'next/server';
import { getPipelineLeads, updatePipelineLead, deletePipelineLead } from '@/lib/pipeline';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { rowNumber, ...rest } = body;

    if (!rowNumber) {
      return NextResponse.json({ error: 'Missing rowNumber.' }, { status: 400 });
    }

    await updatePipelineLead({ ...rest, id: params.id, rowNumber });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PUT /api/pipeline/[id] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update lead.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const leads = await getPipelineLeads();
    const lead = leads.find((l) => l.id === params.id);
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
    }
    await deletePipelineLead(lead.rowNumber);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/pipeline/[id] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete lead.' },
      { status: 500 }
    );
  }
}
