import { NextResponse } from 'next/server';
import { getAgentReputation } from '@/lib/database';

export const dynamic = 'force-dynamic'; // Ensure this route is not statically cached

export async function GET() {
  try {
    const reputation = await getAgentReputation();
    
    return NextResponse.json({
      success: true,
      data: reputation
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      }
    });
  } catch (error) {
    console.error('Error fetching agent reputation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent reputation' },
      { status: 500 }
    );
  }
}
