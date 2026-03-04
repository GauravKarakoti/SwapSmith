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
    const id = searchParams.get('id');
    const history = searchParams.get('history');

    if (id) {
      const portfolioId = parseInt(id);
      
      if (history === 'true') {
        const historyData = await getRebalanceHistory(portfolioId);
        return NextResponse.json({ history: historyData });
      }
      
      const portfolio = await getPortfolioTargetById(portfolioId, userId.toString());
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
    const { name, assets, driftThreshold, autoRebalance } = body;

    if (!name || !assets || !Array.isArray(assets)) {
      return NextResponse.json(
        { error: 'Invalid input: name and assets array are required' },
        { status: 400 }
      );
    }

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
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 }
      );
    }

    const updatedPortfolio = await updatePortfolioTarget(
      id,
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
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 }
      );
    }

    const success = await deletePortfolioTarget(id, userId.toString());

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
