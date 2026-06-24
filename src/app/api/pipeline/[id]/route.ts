import { NextResponse } from 'next/server';
import { updatePipelineLead, deletePipelineLead } from '@/lib/pipeline';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    // rowNumber is ignored — pipeline.ts always looks it up fresh
    await updatePipelineLead({ ...body, id: params.id });
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
    // Pass the ID directly — pipeline.ts looks up the fresh rowNumber itself
    await deletePipelineLead(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/pipeline/[id] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete lead.' },
      { status: 500 }
    );
  }
}
