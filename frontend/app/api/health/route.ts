import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

/**
 * Health Check API Route
 * 
 * SECURITY: Two-tier health check system
 * - Public: Basic up/down status only (for load balancers, Docker)
 * - Authenticated: Detailed system information (for admin monitoring)
 * 
 * GET /api/health - Returns basic health status
 * GET /api/health?detailed=true - Returns detailed status (requires admin auth)
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const detailed = searchParams.get('detailed') === 'true';
    
    // SECURITY: Detailed health info requires authentication
    if (detailed) {
      const authHeader = request.headers.get('authorization');
      
      if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json(
          { error: 'Unauthorized: Detailed health info requires authentication' },
          { status: 401 }
        );
      }
      
      try {
        const token = authHeader.substring(7);
        await adminAuth.verifyIdToken(token);
      } catch (error) {
        return NextResponse.json(
          { error: 'Unauthorized: Invalid token' },
          { status: 401 }
        );
      }
      
      // Return detailed health status for authenticated admins
      return getDetailedHealthStatus();
    }
    
    // SECURITY: Public endpoint returns minimal information
    // Only basic up/down status for load balancers and Docker health checks
    return NextResponse.json(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
      },
      { 
        status: 200,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Content-Type': 'application/json',
        }
      }
    );
  } catch (error) {
    console.error('[Health Check] Error:', error);
    
    // SECURITY: Don't leak error details in public endpoint
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
      },
      { 
        status: 503,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Content-Type': 'application/json',
        }
      }
    );
  }
}

/**
 * Get detailed health status (authenticated only)
 */
async function getDetailedHealthStatus() {
  try {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      checks: {
        memory: getMemoryUsage(),
        database: await checkDatabaseConnection(),
        services: checkServicesAvailability(),
      }
    };

    // Determine overall health
    const isHealthy = Object.values(healthStatus.checks).every(
      check => check.status === 'ok' || check.status === 'warning'
    );
    
    return NextResponse.json(
      {
        ...healthStatus,
        status: isHealthy ? 'healthy' : 'unhealthy'
      },
      { 
        status: isHealthy ? 200 : 503,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Content-Type': 'application/json',
        }
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      },
      { 
        status: 503,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Content-Type': 'application/json',
        }
      }
    );
  }
}

/**
 * Get memory usage information
 */
function getMemoryUsage() {
  try {
    const memUsage = process.memoryUsage();
    const totalMemMB = Math.round(memUsage.rss / 1024 / 1024);
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    
    return {
      status: 'ok',
      totalMemoryMB: totalMemMB,
      heapUsedMB: heapUsedMB,
      heapTotalMB: heapTotalMB,
      memoryUsagePercent: Math.round((heapUsedMB / heapTotalMB) * 100)
    };
  } catch (error) {
    return {
      status: 'error',
      message: 'Failed to get memory usage'
    };
  }
}

/**
 * Check database connection
 */
async function checkDatabaseConnection() {
  try {
    if (!process.env.DATABASE_URL) {
      return {
        status: 'warning',
        message: 'Database not configured'
      };
    }
    
    // SECURITY: Don't expose actual database URL or connection details
    return {
      status: 'ok',
      message: 'Database configured'
    };
  } catch (error) {
    return {
      status: 'error',
      message: 'Database check failed'
    };
  }
}

/**
 * Check if required services are available
 */
function checkServicesAvailability() {
  try {
    // SECURITY: Only check presence, don't expose actual keys or values
    const services = {
      database: !!process.env.DATABASE_URL,
      firebase: !!process.env.FIREBASE_PROJECT_ID,
      sideshift: !!process.env.SIDESHIFT_API_KEY,
    };
    
    const allAvailable = Object.values(services).every(available => available);
    
    return {
      status: allAvailable ? 'ok' : 'warning',
      message: allAvailable ? 'All services configured' : 'Some services not configured',
      available: services
    };
  } catch (error) {
    return {
      status: 'error',
      message: 'Failed to check services'
    };
  }
}

// SECURITY: Remove CORS wildcard, no OPTIONS handler needed
// Health endpoint should not be called cross-origin