import { NextRequest, NextResponse } from 'next/server';
import { subscribeToStrategy, unsubscribeFromStrategy, pauseSubscription, resumeSubscription } from '../../../../../../shared/services/strategy-marketplace';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const strategyId = Number(id);
    
    if (isNaN(strategyId)) {
      return NextResponse.json(
        { error: 'Invalid strategy ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { 
      subscriberId, 
      subscriberTelegramId, 
      allocationPercent, 
      autoRebalance, 
      stopLossPercent 
    } = body;

    if (!subscriberId) {
      return NextResponse.json(
        { error: 'Missing subscriberId' },
        { status: 400 }
      );
    }

    const subscription = await subscribeToStrategy({
      strategyId,
      subscriberId,
      subscriberTelegramId,
      allocationPercent,
      autoRebalance,
      stopLossPercent,
    });

    return NextResponse.json(subscription, { status: 201 });
  } catch (error) {
    console.error('Error subscribing to strategy:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to subscribe to strategy' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const strategyId = Number(id);
    
    if (isNaN(strategyId)) {
      return NextResponse.json(
        { error: 'Invalid strategy ID' },
        { status: 400 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const subscriberId = Number(searchParams.get('subscriberId'));
    
    if (isNaN(subscriberId)) {
      return NextResponse.json(
        { error: 'Missing subscriberId' },
        { status: 400 }
      );
    }

    const success = await unsubscribeFromStrategy(strategyId, subscriberId);
    
    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Error unsubscribing from strategy:', error);
    return NextResponse.json(
      { error: 'Failed to unsubscribe from strategy' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const strategyId = Number(id);
    
    if (isNaN(strategyId)) {
      return NextResponse.json(
        { error: 'Invalid strategy ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { action, subscriberId } = body;

    if (!subscriberId) {
      return NextResponse.json(
        { error: 'Missing subscriberId' },
        { status: 400 }
      );
    }

    let success = false;
    
    if (action === 'pause') {
      success = await pauseSubscription(strategyId, subscriberId);
    } else if (action === 'resume') {
      success = await resumeSubscription(strategyId, subscriberId);
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "pause" or "resume"' },
        { status: 400 }
      );
    }
    
    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: 'Subscription not found or invalid state' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Error updating subscription:', error);
    return NextResponse.json(
      { error: 'Failed to update subscription' },
      { status: 500 }
    );
  }
}
