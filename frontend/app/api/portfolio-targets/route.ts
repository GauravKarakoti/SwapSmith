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

function validateAssets(assets: any[]): { valid: boolean; error?: string } {
  if (!Array.isArray(assets) || assets.length === 0) {
    return { valid: false, error: 'Assets must be a non-empty array' };
  }

  let totalAllocation = 0;
  for (const asset of assets) {
    if (!asset.symbol || typeof asset.symbol !== 'string') {
      return { valid: false, error: 'Each asset must have a valid symbol' };
    }
    // Handle allocation as number (0-100)
    if (typeof asset.allocation !== 'number' || asset.allocation < 0) {
      return { valid: false, error: 'Each asset must have a valid non-negative allocation' };
    }
    totalAllocation += asset.allocation;
  }

  // Allow small floating point error
  if (Math.abs(totalAllocation - 100) > 0.5) {
     return { valid: false, error: 'Total allocation must be approximately 100%' };
  }

  return { valid: true };
}

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

      if (!Number.isFinite(portfolioId)) {
        return NextResponse.json(
          { error: 'Invalid portfolio ID' },
          { status: 400 }
        );
      }
      
      if (history === 'true') {
        const portfolio = await getPortfolioTargetById(portfolioId, userId.toString());
        if (!portfolio) {
          return NextResponse.json(
            { error: 'Portfolio not found' },
            { status: 404 }
          );
        }
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

    const validation = validateAssets(assets);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
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
    const portfolioId = Number(id);

    if (!Number.isFinite(portfolioId)) {
      return NextResponse.json(
        { error: 'Invalid portfolio ID' },
        { status: 400 }
      );
    }

    if (updates.assets) {
      const v = validateAssets(updates.assets as any[]);
      if (!v.valid) {
        return NextResponse.json(
          { error: v.error },
          { status: 400 }
        );
      }
    }

    const updatedPortfolio = await updatePortfolioTarget(
      portfolioId,
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
