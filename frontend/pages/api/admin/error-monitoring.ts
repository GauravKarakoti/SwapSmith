import { NextApiRequest, NextApiResponse } from 'next';
import { withEnhancedCSRF } from '@/lib/enhanced-csrf';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import fs from 'fs';
import path from 'path';

// Error monitoring endpoint for admin dashboard
async function errorMonitoringHandler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Path to bot's error log file
    const errorLogPath = path.join(process.cwd(), '..', 'bot', 'logs', 'critical-errors.log');
    
    let errorStats = {
      criticalErrors: 0,
      totalErrors: 0,
      lastError: null as string | null,
      recentErrors: [] as any[],
      errorsByType: {} as Record<string, number>,
      errorsByHour: {} as Record<string, number>
    };

    // Read error log file if it exists
    if (fs.existsSync(errorLogPath)) {
      const logContent = fs.readFileSync(errorLogPath, 'utf8');
      const lines = logContent.split('\n').filter(line => line.trim());
      
      // Parse error entries
      const errors = [];
      let currentError: any = null;
      
      for (const line of lines) {
        if (line.startsWith('[')) {
          // New error entry
          const timestampMatch = line.match(/^\[([^\]]+)\]/);
          const severityMatch = line.match(/\[([A-Z]+)\]/);
          const typeMatch = line.match(/\]\s+(.+)$/);
          
          if (timestampMatch && severityMatch && typeMatch) {
            if (currentError) {
              errors.push(currentError);
            }
            
            currentError = {
              timestamp: timestampMatch[1],
              severity: severityMatch[1],
              type: typeMatch[1],
              details: ''
            };
          }
        } else if (currentError && line.startsWith('Details:')) {
          currentError.details = line.substring(8).trim();
        }
      }
      
      if (currentError) {
        errors.push(currentError);
      }

      // Calculate statistics
      errorStats.totalErrors = errors.length;
      errorStats.criticalErrors = errors.filter(e => e.severity === 'CRITICAL').length;
      errorStats.lastError = errors.length > 0 ? errors[errors.length - 1].timestamp : null;
      errorStats.recentErrors = errors.slice(-10).reverse(); // Last 10 errors, most recent first

      // Group by error type
      errors.forEach(error => {
        errorStats.errorsByType[error.type] = (errorStats.errorsByType[error.type] || 0) + 1;
      });

      // Group by hour (last 24 hours)
      const now = new Date();
      for (let i = 0; i < 24; i++) {
        const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
        const hourKey = hour.toISOString().substring(0, 13); // YYYY-MM-DDTHH
        errorStats.errorsByHour[hourKey] = 0;
      }

      errors.forEach(error => {
        const errorHour = error.timestamp.substring(0, 13);
        if (errorStats.errorsByHour.hasOwnProperty(errorHour)) {
          errorStats.errorsByHour[errorHour]++;
        }
      });
    }

    // Add system health indicators
    const healthStatus = {
      logFileExists: fs.existsSync(errorLogPath),
      logFileSize: fs.existsSync(errorLogPath) ? fs.statSync(errorLogPath).size : 0,
      lastChecked: new Date().toISOString(),
      sentryConfigured: !!process.env.SENTRY_DSN,
      webhookConfigured: !!process.env.ERROR_WEBHOOK_URL,
      emailConfigured: !!process.env.ERROR_EMAIL,
      adminChatConfigured: !!process.env.ADMIN_CHAT_ID
    };

    const response = {
      success: true,
      errorStats,
      healthStatus,
      recommendations: generateRecommendations(errorStats, healthStatus)
    };

    return res.status(200).json(response);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error monitoring API error:', errorMessage);
    
    return res.status(500).json({ 
      success: false,
      error: 'Failed to fetch error monitoring data',
      details: errorMessage 
    });
  }
}

function generateRecommendations(errorStats: any, healthStatus: any): string[] {
  const recommendations = [];

  if (errorStats.criticalErrors > 5) {
    recommendations.push('🚨 High number of critical errors detected. Immediate investigation required.');
  }

  if (errorStats.totalErrors > 50) {
    recommendations.push('⚠️ High error volume. Consider reviewing error patterns and implementing fixes.');
  }

  if (!healthStatus.sentryConfigured) {
    recommendations.push('📊 Configure Sentry DSN for better error tracking and monitoring.');
  }

  if (!healthStatus.webhookConfigured) {
    recommendations.push('🔔 Set up ERROR_WEBHOOK_URL for team notifications via Slack/Discord.');
  }

  if (!healthStatus.emailConfigured) {
    recommendations.push('📧 Configure ERROR_EMAIL for critical error notifications.');
  }

  if (!healthStatus.adminChatConfigured) {
    recommendations.push('💬 Set up ADMIN_CHAT_ID for Telegram error alerts.');
  }

  if (healthStatus.logFileSize > 10 * 1024 * 1024) { // 10MB
    recommendations.push('🗂️ Error log file is large. Consider implementing log rotation.');
  }

  // Check for error patterns
  const topErrorType = Object.entries(errorStats.errorsByType)
    .sort(([,a], [,b]) => (b as number) - (a as number))[0];
  
  if (topErrorType && (topErrorType[1] as number) > 10) {
    recommendations.push(`🔍 "${topErrorType[0]}" errors are frequent (${topErrorType[1]} occurrences). Focus on fixing this error type.`);
  }

  if (recommendations.length === 0) {
    recommendations.push('✅ Error monitoring looks healthy. Keep monitoring for any changes.');
  }

  return recommendations;
}

const csrfProtectedHandler = withEnhancedCSRF(errorMonitoringHandler);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1. Check rate limit first
  const isRateLimited = withRateLimit(req, res, { 
    ...RATE_LIMITS.default, 
    message: 'Too many error monitoring requests' 
  });
  
  // If limit is exceeded, withRateLimit already sent the 429 response
  if (isRateLimited) {
    return;
  }
  
  // 2. Proceed to CSRF and main handler
  return csrfProtectedHandler(req, res);
}