import { NextResponse } from 'next/server';
import { getConversationDetail } from '@/lib/conversations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: { phone: string } }) {
  try {
    const detail = await getConversationDetail(decodeURIComponent(params.phone));
    return NextResponse.json(detail);
  } catch (error) {
    console.error('GET /api/conversations/[phone] failed', error);
    return NextResponse.json({ error: 'Failed to load conversation.' }, { status: 500 });
  }
}
