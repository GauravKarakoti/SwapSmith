import { NextRequest, NextResponse } from 'next/server';
import { getCronJobsStatus, startAllCronJobs, stopAllCronJobs } from '@/lib/cron-manager';
import logger from '@/lib/logger';

/**
 * GET /api/cron/status - Get status of cron jobs
 */
export async function GET(request: NextRequest) {
  try {
    const status = getCronJobsStatus();
    
    return NextResponse.json({
      success: true,
      status
    });
  } catch (error) {
    logger.error('Error getting cron status', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    return NextResponse.json(
      { success: false, error: 'Failed to get cron status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/status - Start or stop cron jobs
 * Body: { action: 'start' | 'stop' }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    
    if (action !== 'start' && action !== 'stop') {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Must be "start" or "stop"' },
        { status: 400 }
      );
    }
    
    if (action === 'start') {
      startAllCronJobs();
      logger.info('Cron jobs started via API');
      return NextResponse.json({
        success: true,
        message: 'Cron jobs started'
      });
    } else {
      stopAllCronJobs();
      logger.info('Cron jobs stopped via API');
      return NextResponse.json({
        success: true,
        message: 'Cron jobs stopped'
      });
    }
  } catch (error) {
    logger.error('Error controlling cron jobs', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    return NextResponse.json(
      { success: false, error: 'Failed to control cron jobs' },
      { status: 500 }
    );
  }
}
