import { NextRequest, NextResponse } from 'next/server';
import { getSwapHistory, getSwapHistoryByWallet, createSwapHistoryEntry } from '@/lib/database';

// GET /api/history - Get swap history for authenticated user or wallet
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const walletAddress = searchParams.get('wallet');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!userId && !walletAddress) {
      return NextResponse.json(
        { error: 'userId or wallet address is required' },
        { status: 400 }
      );
    }

    let history;
    if (userId) {
      history = await getSwapHistory(userId, limit);
    } else if (walletAddress) {
      history = await getSwapHistoryByWallet(walletAddress, limit);
    }

    return NextResponse.json({
      history: history || [],
      count: (history || []).length,
    }, {
      headers: {
        'Cache-Control': 'private, s-maxage=30, stale-while-revalidate=60',
      }
    });

  } catch (error) {
    console.error('Error fetching swap history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch swap history' },
      { status: 500 }
    );
  }
}

// POST /api/history - Create new swap history entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      walletAddress,
      sideshiftOrderId,
      quoteId,
      fromAsset,
      fromNetwork,
      fromAmount,
      toAsset,
      toNetwork,
      settleAmount,
      depositAddress,
      status,
      txHash,
    } = body;

    if (!userId || !sideshiftOrderId || !fromAsset || !toAsset) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await createSwapHistoryEntry(userId, walletAddress, {
      sideshiftOrderId,
      quoteId,
      fromAsset,
      fromNetwork,
      fromAmount: parseFloat(fromAmount),
      toAsset,
      toNetwork,
      settleAmount,
      depositAddress,
      status,
      txHash,
    });

    return NextResponse.json({
      success: true,
      message: 'Swap history entry created',
    }, {
      status: 201,
    });

  } catch (error) {
    console.error('Error creating swap history:', error);
    return NextResponse.json(
      { error: 'Failed to create swap history entry' },
      { status: 500 }
    );
  }
}
