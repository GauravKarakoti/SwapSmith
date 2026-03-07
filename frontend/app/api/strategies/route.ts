import { NextRequest, NextResponse } from 'next/server';
import { getStrategies, createStrategy } from '../../../../shared/services/strategy-marketplace';
import { strategyQuerySchema, strategyCreateBodySchema, validateInput } from '@/lib/api-validation';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const queryParams = Object.fromEntries(searchParams.entries());
    
    const validation = validateInput(strategyQuerySchema, queryParams);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const strategies = await getStrategies(validation.data);
    return NextResponse.json(strategies);
  } catch (error) {
    console.error('Error fetching strategies:', error);
    return NextResponse.json(
      { error: 'Failed to fetch strategies' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = validateInput(strategyCreateBodySchema, body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const strategy = await createStrategy(validation.data);

    return NextResponse.json(strategy, { status: 201 });
  } catch (error) {
    console.error('Error creating strategy:', error);
    return NextResponse.json(
      { error: 'Failed to create strategy' },
      { status: 500 }
    );
  }
}
