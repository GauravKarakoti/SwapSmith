import { NextRequest, NextResponse } from 'next/server';
import { claimPendingTokens } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Accept wallet address from request body (user's MetaMask wallet).
    // Falls back to whatever address is saved in the user's profile.
    let walletAddress: string | undefined;
    try {
      const body = await request.json();
      walletAddress = body?.walletAddress;
    } catch {
      // body is optional – ignore parse errors
    }

    if (walletAddress && !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    const result = await claimPendingTokens(parseInt(userId), walletAddress);

    if (!result) {
      return NextResponse.json(
        { error: 'No pending tokens to claim' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Tokens sent to your wallet on Sepolia!',
      txHash: result.txHash,
      sepoliaEtherscan: `https://sepolia.etherscan.io/tx/${result.txHash}`,
      totalPending: result.totalPending,
      rewardCount: result.rewardCount,
    });
  } catch (error) {
    console.error('Error claiming tokens:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Internal server error' },
      { status: 500 }
    );
  }
}

