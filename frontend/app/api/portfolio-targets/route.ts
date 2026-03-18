import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth-middleware';
import { 
  getPortfolioTargets, 
  getPortfolioTargetById,
  createPortfolioTarget, 
  updatePortfolioTarget, 
  deletePortfolioTarget,
  getRebalanceHistory 
} from '@/lib/database';
import { 
  portfolioTargetsQuerySchema, 
  portfolioTargetBodySchema,
  validateInput 
} from '@/lib/api-validation';

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const queryParams = {
      id: searchParams.get('id') ?? undefined,
      history: searchParams.get('history') ?? undefined
    };

    const validation = validateInput(portfolioTargetsQuerySchema, queryParams);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { id, history } = validation.data;

    if (id) {
      if (history) {
        const portfolio = await getPortfolioTargetById(id, userId.toString());
        if (!portfolio) {
          return NextResponse.json(
            { error: 'Portfolio not found' },
            { status: 404 }
          );
        }
        const historyData = await getRebalanceHistory(id);
        return NextResponse.json({ history: historyData });
      }
      
      const portfolio = await getPortfolioTargetById(id, userId.toString());
      if (!portfolio) {
        return NextResponse.json(
          { error: 'Portfolio not found' },
          { status: 404 }
        );
      }
      
      return NextResponse.json(portfolio);
    }

    const portfolios = await getPortfolioTargets(userId.toString());
    
    return NextResponse.json(portfolios);
  } catch (error) {
    console.error('Error fetching portfolios:', error);
    return NextResponse.json(
      { error: 'Failed to fetch portfolios' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = validateInput(portfolioTargetBodySchema, body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { name, assets, driftThreshold, autoRebalance } = validation.data;

    const newPortfolio = await createPortfolioTarget(
      userId.toString(),
      name,
      assets,
      driftThreshold,
      autoRebalance
    );

    if (!newPortfolio) {
      return NextResponse.json(
        { error: 'Failed to create portfolio' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(newPortfolio, { status: 201 });
  } catch (error) {
    console.error('Error creating portfolio:', error);
    return NextResponse.json(
      { error: 'Failed to create portfolio' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = validateInput(
      portfolioTargetBodySchema.extend({ id: portfolioTargetsQuerySchema.shape.id }), 
      body
    );
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { id, ...updates } = validation.data;

    const updatedPortfolio = await updatePortfolioTarget(
      id!,
      userId.toString(),
      updates
    );

    if (!updatedPortfolio) {
      return NextResponse.json(
        { error: 'Portfolio not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(updatedPortfolio);
  } catch (error) {
    console.error('Error updating portfolio:', error);
    return NextResponse.json(
      { error: 'Failed to update portfolio' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = validateInput(
      portfolioTargetsQuerySchema.pick({ id: true }), 
      body
    );
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { id } = validation.data;

    const success = await deletePortfolioTarget(id!, userId.toString());

    if (!success) {
      return NextResponse.json(
        { error: 'Portfolio not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting portfolio:', error);
    return NextResponse.json(
      { error: 'Failed to delete portfolio' },
      { status: 500 }
    );
  }
}
