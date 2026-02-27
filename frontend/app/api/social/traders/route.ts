import { NextRequest, NextResponse } from 'next/server';
import { getTopTraders, getTraderStatsByUserId, getOrCreateTraderStats } from '../../../../../shared/services/social-trading';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (userId) {
      const stats = await getTraderStatsByUserId(parseInt(userId));
      return NextResponse.json(stats);
    }

    const traders = await getTopTraders(limit);
    
    const enrichedTraders = traders.map((trader: any) => ({
      ...trader,
      displayName: trader.walletAddress 
        ? `${trader.walletAddress.slice(0, 6)}...${trader.walletAddress.slice(-4)}`
        : `Trader ${trader.userId}`,
    }));

    return NextResponse.json(enrichedTraders);
  } catch (error) {
    console.error('Error fetching traders:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const stats = await getOrCreateTraderStats(userId);
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error creating trader stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
