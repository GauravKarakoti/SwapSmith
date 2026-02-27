import { NextRequest, NextResponse } from 'next/server';
import { 
  sharePortfolio, 
  getSharedPortfolioByCode, 
  getPublicPortfolios, 
  getUserPortfolios,
  updatePortfolio,
  deletePortfolio
} from '../../../../../shared/services/social-trading';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shareCode = searchParams.get('shareCode');
    const userId = searchParams.get('userId');
    const publicPortfolios = searchParams.get('public');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (shareCode) {
      const portfolio = await getSharedPortfolioByCode(shareCode);
      if (!portfolio) {
        return NextResponse.json(
          { error: 'Portfolio not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(portfolio);
    }

    if (userId) {
      const portfolios = await getUserPortfolios(parseInt(userId));
      return NextResponse.json(portfolios);
    }

    if (publicPortfolios === 'true') {
      const portfolios = await getPublicPortfolios(limit, offset);
      return NextResponse.json(portfolios);
    }

    return NextResponse.json(
      { error: 'Invalid parameters' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error fetching portfolios:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, title, description, fromAsset, fromChain, portfolio, isPublic, expiresAt } = body;

    if (!userId || !title || !fromAsset || !portfolio) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await sharePortfolio(userId, {
      title,
      description,
      fromAsset,
      fromChain,
      portfolio,
      isPublic,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error sharing portfolio:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { portfolioId, userId, title, description, portfolio, isPublic } = body;

    if (!portfolioId || !userId) {
      return NextResponse.json(
        { error: 'Portfolio ID and User ID are required' },
        { status: 400 }
      );
    }

    const result = await updatePortfolio(portfolioId, userId, {
      title,
      description,
      portfolio,
      isPublic,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating portfolio:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const portfolioId = searchParams.get('portfolioId');
    const userId = searchParams.get('userId');

    if (!portfolioId || !userId) {
      return NextResponse.json(
        { error: 'Portfolio ID and User ID are required' },
        { status: 400 }
      );
    }

    const result = await deletePortfolio(parseInt(portfolioId), parseInt(userId));
    
    if (!result) {
      return NextResponse.json(
        { error: 'Portfolio not found or unauthorized' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting portfolio:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
