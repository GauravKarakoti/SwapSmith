import { NextRequest, NextResponse } from 'next/server';
import { getStrategyById, getStrategyPerformance, getStrategyTrades } from '@/shared/services/strategy-marketplace';

export async function GET(
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

    const strategy = await getStrategyById(strategyId);
    
    if (!strategy) {
      return NextResponse.json(
        { error: 'Strategy not found' },
        { status: 404 }
      );
    }

    // Get optional query params
    const searchParams = request.nextUrl.searchParams;
    const includePerformance = searchParams.get('includePerformance') === 'true';
    const includeTrades = searchParams.get('includeTrades') === 'true';
    const limit = Number(searchParams.get('limit')) || 30;

    const response: Record<string, unknown> = { strategy };

    if (includePerformance) {
      const performance = await getStrategyPerformance(strategyId, limit);
      response.performance = performance;
    }

    if (includeTrades) {
      const trades = await getStrategyTrades(strategyId, limit);
      response.trades = trades;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching strategy:', error);
    return NextResponse.json(
      { error: 'Failed to fetch strategy' },
      { status: 500 }
    );
  }
}
