import { NextResponse } from 'next/server';
import { getLeads } from '@/lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const leads = await getLeads();
    return NextResponse.json({ leads });
  } catch (error) {
    console.error('GET /api/leads failed', error);
    return NextResponse.json({ error: 'Failed to load leads.' }, { status: 500 });
  }
}
