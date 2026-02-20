import { NextRequest, NextResponse } from 'next/server';
import { updateSwapHistoryStatus } from '@/lib/database';

// POST /api/swap-status - Update swap status (called by webhooks or status polling)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sideshiftOrderId,
      status,
      txHash,
    } = body;

    if (!sideshiftOrderId || !status) {
      return NextResponse.json(
        { error: 'sideshiftOrderId and status are required' },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ['pending', 'processing', 'completed', 'settled', 'failed', 'cancelled', 'expired'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    await updateSwapHistoryStatus(sideshiftOrderId, status, txHash);

    console.log(`[Reputation] Swap status updated: ${sideshiftOrderId} -> ${status}`);

    return NextResponse.json({
      success: true,
      message: 'Swap status updated successfully',
      sideshiftOrderId,
      status,
    });

  } catch (error) {
    console.error('Error updating swap status:', error);
    return NextResponse.json(
      { error: 'Failed to update swap status' },
      { status: 500 }
    );
  }
}

// GET /api/swap-status - Get current status of a swap
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sideshiftOrderId = searchParams.get('orderId');

    if (!sideshiftOrderId) {
      return NextResponse.json(
        { error: 'orderId query parameter is required' },
        { status: 400 }
      );
    }

    // Import getSwapHistory to query the swap
    const { getSwapHistory } = await import('@/lib/database');
    
    // We need to search by sideshiftOrderId - for now, get recent history and filter
    // This is a workaround since we don't have a direct lookup by orderId
    const allHistory = await getSwapHistory('system', 1000);
    const swap = allHistory.find(h => h.sideshiftOrderId === sideshiftOrderId);

    if (!swap) {
      return NextResponse.json(
        { error: 'Swap not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        sideshiftOrderId: swap.sideshiftOrderId,
        status: swap.status,
        txHash: swap.txHash,
        fromAsset: swap.fromAsset,
        toAsset: swap.toAsset,
        fromAmount: swap.fromAmount,
        settleAmount: swap.settleAmount,
        createdAt: swap.createdAt,
        updatedAt: swap.updatedAt,
      },
    });

  } catch (error) {
    console.error('Error fetching swap status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch swap status' },
      { status: 500 }
    );
  }
}
