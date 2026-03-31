import { NextResponse } from 'next/server';
import { getConversationSummaries } from '@/lib/conversations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const conversations = await getConversationSummaries();
    return NextResponse.json({ conversations });
  } catch (error) {
    console.error('GET /api/conversations failed', error);
    return NextResponse.json({ error: 'Failed to load conversations.' }, { status: 500 });
  }
}
