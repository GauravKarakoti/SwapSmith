import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-helpers';
import { 
  getPriceAlerts,
  getActivePriceAlerts,
  createPriceAlert, 
  deletePriceAlert, 
  togglePriceAlert,
  getCachedPrice
} from '@/lib/database';
import logger from '@/lib/logger';

// GET /api/price-alerts - Get all price alerts for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    
    if (!authResult.success || !authResult.firebaseUid) {
      return authResult.error || NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';
    
    const alerts = activeOnly 
      ? await getActivePriceAlerts(authResult.firebaseUid)
      : await getPriceAlerts(authResult.firebaseUid);
    
    // Enrich alerts with current prices
    const alertsWithPrices = await Promise.all(
      alerts.map(async (alert) => {
        const priceData = await getCachedPrice(alert.coin, alert.network);
        return {
          ...alert,
          currentPrice: priceData?.usdPrice ?? null,
          lastUpdated: priceData?.updatedAt ?? null,
        };
      })
    );
    
    return NextResponse.json({ 
      success: true, 
      alerts: alertsWithPrices 
    });
    
  } catch (error) {
    logger.error('Error fetching price alerts', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    return NextResponse.json(
      { success: false, error: 'Failed to fetch price alerts' },
      { status: 500 }
    );
  }
}

// POST /api/price-alerts - Create a new price alert
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    
    if (!authResult.success || !authResult.firebaseUid) {
      return authResult.error || NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { coin, network, name, targetPrice, condition } = body;
    
    // Validation
    if (!coin || !network || !name || !targetPrice || !condition) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    if (condition !== 'gt' && condition !== 'lt') {
      return NextResponse.json(
        { success: false, error: 'Invalid condition. Must be "gt" or "lt"' },
        { status: 400 }
      );
    }
    
    const price = parseFloat(targetPrice);
    if (isNaN(price) || price <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid target price' },
        { status: 400 }
      );
    }
    
    const alert = await createPriceAlert(
      authResult.firebaseUid,
      coin,
      network,
      name,
      targetPrice,
      condition,
      undefined // telegramId is optional
    );
    
    if (!alert) {
      return NextResponse.json(
        { success: false, error: 'Failed to create price alert' },
        { status: 500 }
      );
    }
    
    // Enrich with current price
    const priceData = await getCachedPrice(coin, network);
    
    logger.info('Price alert created', {
      userId: authResult.firebaseUid,
      alertId: alert.id,
      coin,
      targetPrice,
      condition
    });
    
    return NextResponse.json({ 
      success: true, 
      alert: {
        ...alert,
        currentPrice: priceData?.usdPrice ?? null
      }
    });
    
  } catch (error) {
    logger.error('Error creating price alert', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    return NextResponse.json(
      { success: false, error: 'Failed to create price alert' },
      { status: 500 }
    );
  }
}

// DELETE /api/price-alerts - Delete a price alert
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    
    if (!authResult.success || !authResult.firebaseUid) {
      return authResult.error || NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const alertId = searchParams.get('id');
    
    if (!alertId) {
      return NextResponse.json(
        { success: false, error: 'Alert ID is required' },
        { status: 400 }
      );
    }
    
    const success = await deletePriceAlert(parseInt(alertId), authResult.firebaseUid);
    
    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete price alert' },
        { status: 500 }
      );
    }
    
    logger.info('Price alert deleted', {
      userId: authResult.firebaseUid,
      alertId
    });
    
    return NextResponse.json({ 
      success: true 
    });
    
  } catch (error) {
    logger.error('Error deleting price alert', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    return NextResponse.json(
      { success: false, error: 'Failed to delete price alert' },
      { status: 500 }
    );
  }
}

// PATCH /api/price-alerts - Toggle price alert active status
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    
    if (!authResult.success || !authResult.firebaseUid) {
      return authResult.error || NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { alertId, isActive } = body;
    
    if (!alertId || typeof isActive !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Alert ID and isActive status are required' },
        { status: 400 }
      );
    }
    
    const alert = await togglePriceAlert(alertId, authResult.firebaseUid, isActive);
    
    if (!alert) {
      return NextResponse.json(
        { success: false, error: 'Failed to update price alert' },
        { status: 500 }
      );
    }
    
    logger.info('Price alert toggled', {
      userId: authResult.firebaseUid,
      alertId,
      isActive
    });
    
    return NextResponse.json({ 
      success: true, 
      alert 
    });
    
  } catch (error) {
    logger.error('Error toggling price alert', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    return NextResponse.json(
      { success: false, error: 'Failed to update price alert' },
      { status: 500 }
    );
  }
}
