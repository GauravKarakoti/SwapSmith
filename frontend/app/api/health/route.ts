import { NextRequest, NextResponse } from 'next/server';
import { loadSecret } from '../../../../shared/utils/secrets-loader';

/**
 * Health Check API Route
 * 
 * Provides health status for Docker health checks and monitoring
 * GET /api/health - Returns application health status
 */

export async function GET(request: NextRequest) {
  try {
    // Basic health checks
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      checks: {
        memory: getMemoryUsage(),
        database: await checkDatabaseConnection(),
        secrets: checkSecretsAvailability(),
      }
    };

    // Determine overall health
    const isHealthy = Object.values(healthStatus.checks).every(check => check.status === 'ok');
    
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
    console.error('[Health Check] Error:', error);
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
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
      error: 'Failed to get memory usage'
    };
  }
}

/**
 * Check database connection
 */
async function checkDatabaseConnection() {
  try {
    // Simple database connection check
    if (!process.env.DATABASE_URL) {
      return {
        status: 'warning',
        message: 'Database URL not configured'
      };
    }
    
    // In a real implementation, you would test the actual connection
    // For now, just check if the URL is present
    return {
      status: 'ok',
      message: 'Database URL configured'
    };
  } catch (error) {
    return {
      status: 'error',
      error: 'Database connection failed'
    };
  }
}

/**
 * Check if required secrets are available
 */
function checkSecretsAvailability() {
  try {
    const requiredSecrets = [
      { name: 'groq_api_key', env: 'GROQ_API_KEY' },
      { name: 'sideshift_api_key', env: 'NEXT_PUBLIC_SIDESHIFT_API_KEY' }
    ];
    
    const missingSecrets = [];
    
    for (const secret of requiredSecrets) {
      try {
        loadSecret(secret.name, secret.env, false);
      } catch (error) {
        missingSecrets.push(secret.name);
      }
    }
    
    if (missingSecrets.length > 0) {
      return {
        status: 'warning',
        message: `Missing secrets: ${missingSecrets.join(', ')}`
      };
    }
    
    return {
      status: 'ok',
      message: 'All required secrets available'
    };
  } catch (error) {
    return {
      status: 'error',
      error: 'Failed to check secrets'
    };
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { 
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}