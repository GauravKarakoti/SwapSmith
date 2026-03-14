import logger, { Logger as LoggerHelper } from '../../../shared/lib/logger';
import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import * as Sentry from '@sentry/node';
import fs from 'fs';
import path from 'path';
import type { 
  ErrorNotificationDetails, 
  LogSeverity, 
  ErrorDetails as ErrorDetailsType,
  TelegrafContext 
} from '../types/Logger';

dotenv.config();

const ADMIN_CHAT_ID = process.env['ADMIN_CHAT_ID'];
const SENTRY_DSN = process.env['SENTRY_DSN'];
const ERROR_WEBHOOK_URL = process.env['ERROR_WEBHOOK_URL']; // Slack/Discord webhook
const ERROR_EMAIL = process.env['ERROR_EMAIL']; // Email for critical errors

// Initialize Telegram bot for admin alerts (only if token is available)
const bot = process.env['BOT_TOKEN'] ? new Telegraf(process.env['BOT_TOKEN']!) : null;

// Initialize Sentry if DSN is provided
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env['NODE_ENV'] || 'development',
    tracesSampleRate: 1.0,
  });
  logger.info('Sentry initialized for error tracking');
}

// Error file logging for critical errors
const ERROR_LOG_DIR = path.join(process.cwd(), 'logs');
const CRITICAL_ERROR_FILE = path.join(ERROR_LOG_DIR, 'critical-errors.log');

// Ensure error log directory exists
if (!fs.existsSync(ERROR_LOG_DIR)) {
  fs.mkdirSync(ERROR_LOG_DIR, { recursive: true });
}

// Enhanced error notification system with multiple fallbacks
async function sendErrorNotifications(errorDetails: ErrorNotificationDetails, sendAlert: boolean = true) {
  if (!sendAlert) return;

  const { errorType, details, userId, timestamp, severity } = errorDetails;
  
  // 1. Always log to file for critical errors
  if (severity === 'critical' || severity === 'high') {
    try {
      const logEntry = `[${timestamp}] [${severity.toUpperCase()}] ${errorType}\n` +
        `User: ${userId || 'unknown'}\n` +
        `Details: ${JSON.stringify(details, null, 2)}\n` +
        `${'='.repeat(80)}\n`;
      
      fs.appendFileSync(CRITICAL_ERROR_FILE, logEntry);
    } catch (fileError) {
      logger.error('Failed to write to critical error log file', fileError);
    }
  }

  // 2. Send to Sentry (primary error tracking)
  if (SENTRY_DSN) {
    try {
      Sentry.captureException(details instanceof Error ? details : new Error(JSON.stringify(details)), {
        level: severity === 'critical' ? 'fatal' : severity === 'high' ? 'error' : 'warning',
        extra: {
          errorType,
          userId: userId || 'unknown',
          details,
          severity,
        },
        tags: {
          errorType,
          severity,
        },
      });
    } catch (sentryError) {
      logger.error('Failed to send error to Sentry', sentryError);
    }
  }

  // 3. Send Telegram alert to admin (if configured)
  if (ADMIN_CHAT_ID && bot) {
    try {
      const severityEmoji = {
        low: '🟡',
        medium: '🟠', 
        high: '🔴',
        critical: '🚨'
      };
      
      const msg = `${severityEmoji[severity]} *${severity.toUpperCase()} Error Alert*\n\n` +
        `*Type:* ${errorType}\n` +
        `*User:* ${userId || 'unknown'}\n` +
        `*Time:* ${timestamp}\n` +
        `*Details:* \`${JSON.stringify(details, null, 2).substring(0, 500)}${JSON.stringify(details, null, 2).length > 500 ? '...' : ''}\``;
      
      await bot.telegram.sendMessage(ADMIN_CHAT_ID, msg, { parse_mode: 'Markdown' });
    } catch (alertError) {
      logger.error('Failed to send Telegram admin alert', alertError);
    }
  }

  // 4. Send to webhook (Slack/Discord) for team notifications
  if (ERROR_WEBHOOK_URL && (severity === 'critical' || severity === 'high')) {
    try {
      const webhookPayload = {
        text: `🚨 ${severity.toUpperCase()} Error in SwapSmith Bot`,
        attachments: [{
          color: severity === 'critical' ? 'danger' : 'warning',
          fields: [
            { title: 'Error Type', value: errorType, short: true },
            { title: 'User ID', value: userId || 'unknown', short: true },
            { title: 'Timestamp', value: timestamp, short: true },
            { title: 'Severity', value: severity.toUpperCase(), short: true },
            { title: 'Details', value: JSON.stringify(details, null, 2).substring(0, 1000), short: false }
          ]
        }]
      };

      const response = await fetch(ERROR_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload)
      });

      if (!response.ok) {
        throw new Error(`Webhook failed with status ${response.status}`);
      }
    } catch (webhookError) {
      logger.error('Failed to send webhook notification', webhookError);
    }
  }

  // 5. Email notification for critical errors (if configured)
  if (ERROR_EMAIL && severity === 'critical') {
    try {
      // This would require an email service like SendGrid, SES, etc.
      // For now, we'll log that an email should be sent
      logger.warn(`CRITICAL ERROR - Email notification should be sent to ${ERROR_EMAIL}`, {
        errorType,
        userId,
        details: JSON.stringify(details, null, 2)
      });
    } catch (emailError) {
      logger.error('Failed to send email notification', emailError);
    }
  }

  // 6. Console alert for development
  if (process.env['NODE_ENV'] === 'development') {
    console.error(`\n🚨 ${severity.toUpperCase()} ERROR ALERT 🚨`);
    console.error(`Type: ${errorType}`);
    console.error(`User: ${userId || 'unknown'}`);
    console.error(`Time: ${timestamp}`);
    console.error(`Details:`, details);
    console.error('='.repeat(50));
  }
}

export async function handleError(
  errorType: string,
  details: ErrorDetailsType,
  ctx?: TelegrafContext,
  sendAlert: boolean = true,
  severity: LogSeverity = 'medium'
) {
  const userId = ctx?.from?.id?.toString() || 'unknown';
  const timestamp = new Date().toISOString();

  // Always log to Winston with structured data
  logger.error(`[${errorType}]`, {
    details,
    userId,
    timestamp,
    severity,
    errorType,
  });

  // Enhanced error details object
  const errorDetails: ErrorNotificationDetails = {
    errorType,
    details,
    userId,
    timestamp,
    severity,
    context: ctx ? {
      chatId: ctx.chat?.id,
      messageId: ctx.message?.message_id,
      username: ctx.from?.username,
    } : undefined
  };

  // Send notifications through multiple channels
  await sendErrorNotifications(errorDetails, sendAlert);

  // Return error details for potential further processing
  return errorDetails;
}

// Utility function for different error severities
export const logCriticalError = (errorType: string, details: ErrorDetailsType, ctx?: TelegrafContext) => 
  handleError(errorType, details, ctx, true, 'critical');

export const logHighError = (errorType: string, details: ErrorDetailsType, ctx?: TelegrafContext) => 
  handleError(errorType, details, ctx, true, 'high');

export const logMediumError = (errorType: string, details: ErrorDetailsType, ctx?: TelegrafContext) => 
  handleError(errorType, details, ctx, true, 'medium');

export const logLowError = (errorType: string, details: ErrorDetailsType, ctx?: TelegrafContext) => 
  handleError(errorType, details, ctx, true, 'low');

// Function to get error statistics
export function getErrorStats(): { criticalErrors: number; totalErrors: number; lastError?: string } {
  try {
    if (!fs.existsSync(CRITICAL_ERROR_FILE)) {
      return { criticalErrors: 0, totalErrors: 0 };
    }

    const logContent = fs.readFileSync(CRITICAL_ERROR_FILE, 'utf8');
    const lines = logContent.split('\n').filter(line => line.trim());
    const criticalErrors = lines.filter(line => line.includes('[CRITICAL]')).length;
    const totalErrors = lines.filter(line => line.includes('] [')).length;
    
    // Get last error timestamp
    const lastErrorLine = lines.reverse().find(line => line.includes('] ['));
    const lastError = lastErrorLine ? lastErrorLine.split(']')[0]?.replace('[', '') : undefined;

    return { criticalErrors, totalErrors, lastError };
  } catch (error) {
    logger.error('Failed to get error statistics', error);
    return { criticalErrors: 0, totalErrors: 0 };
  }
}

// Export Sentry for manual error capture if needed
export { Sentry };

// Export the Logger helper for convenience
export { LoggerHelper };

export default logger;
