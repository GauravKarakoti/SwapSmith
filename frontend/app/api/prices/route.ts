import { NextRequest, NextResponse } from 'next/server';
import { getCachedPrice, getAllCachedPrices } from '@/lib/database';

/**
 * GET /api/prices - Get all cached prices or specific coin price
 * 
 * Prices are automatically refreshed every 6 hours by the cron job.
 * This endpoint only serves from the database cache.
 */
export async function GET(request: NextRequest) {
  try {
    // Validate DATABASE_URL exists
    if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL is not configured');
      return NextResponse.json(
        { error: 'Database configuration error' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const coin = searchParams.get('coin');
    const network = searchParams.get('network');

    // If specific coin requested, serve from cache
    if (coin && network) {
      const cached = await getCachedPrice(coin, network, true);
      
      if (cached) {
        const isStale = new Date(cached.expiresAt) < new Date();
        return NextResponse.json({
          coin: cached.coin,
          network: cached.network,
          name: cached.name,
          usdPrice: cached.usdPrice,
          btcPrice: cached.btcPrice,
          available: cached.available === 'true',
          cached: true,
          isStale,
          expiresAt: cached.expiresAt,
          updatedAt: cached.updatedAt,
        }, {
          headers: {
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
          }
        });
      }

      // Not found in cache
      return NextResponse.json({
        error: `Price for ${coin}/${network} not found in cache`,
        hint: 'Prices are refreshed automatically every 6 hours. Please try again later or check all prices.'
      }, {
        status: 404,
      });
    }

    // Get all cached prices from database
    const cachedPrices = await getAllCachedPrices();
    const pricesWithStaleInfo = cachedPrices
      .filter(p => p.usdPrice !== null && p.usdPrice !== undefined && p.usdPrice !== '')
      .map(p => ({
        coin: p.coin,
        network: p.network,
        name: p.name,
        usdPrice: p.usdPrice,
        btcPrice: p.btcPrice,
        available: p.available === 'true',
        isStale: new Date(p.expiresAt) < new Date(),
        updatedAt: p.updatedAt,
      }));

    console.log(`[Prices API] Serving ${pricesWithStaleInfo.length} cached prices from database`);

    return NextResponse.json({
      prices: pricesWithStaleInfo,
      cached: true,
      count: pricesWithStaleInfo.length,
      message: 'Prices are automatically refreshed every 6 hours',
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      }
    });

  } catch (error) {
    console.error('[Prices API] Error fetching prices from database:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prices from database' },
      { status: 500 }
    );
  }
}

