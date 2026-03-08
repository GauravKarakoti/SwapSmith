import { NextRequest, NextResponse } from 'next/server';
import { getStrategies, createStrategy } from '../../../../shared/services/strategy-marketplace';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    const options = {
      riskLevel: searchParams.get('riskLevel') || undefined,
      status: searchParams.get('status') || 'active',
      minReturn: searchParams.get('minReturn') ? Number(searchParams.get('minReturn')) : undefined,
      maxDrawdown: searchParams.get('maxDrawdown') ? Number(searchParams.get('maxDrawdown')) : undefined,
      search: searchParams.get('search') || undefined,
      sortBy: (searchParams.get('sortBy') as 'totalReturn' | 'subscriberCount' | 'monthlyReturn' | 'createdAt') || 'totalReturn',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 20,
      offset: searchParams.get('offset') ? Number(searchParams.get('offset')) : 0,
    };

    const strategies = await getStrategies(options);
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
  // CSRF Protection
  const csrfError = csrfGuard(request);
  if (csrfError) {
    return csrfError;
  }

  try {
    const body = await request.json();
    const { 
      creatorId, 
      creatorTelegramId, 
      name, 
      description, 
      parameters, 
      riskLevel, 
      subscriptionFee, 
      performanceFee,
      minInvestment,
      isPublic,
      tags 
    } = body;

    if (!creatorId || !name || !description || !riskLevel) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const strategy = await createStrategy({
      creatorId,
      creatorTelegramId,
      name,
      description,
      parameters: parameters || {},
      riskLevel,
      subscriptionFee: subscriptionFee || '0',
      performanceFee: performanceFee || 0,
      minInvestment: minInvestment || '100',
      isPublic: isPublic ?? true,
      tags,
    });

    return NextResponse.json(strategy, { status: 201 });
  } catch (error) {
    console.error('Error creating strategy:', error);
    return NextResponse.json(
      { error: 'Failed to create strategy' },
      { status: 500 }
    );
  }
}
