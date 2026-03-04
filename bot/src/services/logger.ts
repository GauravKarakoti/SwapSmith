import logger, { Logger as LoggerHelper } from '../../../shared/lib/logger';
import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import * as Sentry from '@sentry/node';

dotenv.config();

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const SENTRY_DSN = process.env.SENTRY_DSN;

// Initialize Telegram bot for admin alerts (only if token is available)
const bot = process.env.BOT_TOKEN ? new Telegraf(process.env.BOT_TOKEN!) : null;

// Initialize Sentry if DSN is provided
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 1.0,
  });
  logger.info('Sentry initialized for error tracking');
}

export async function handleError(
  errorType: string,
  details: any,
  ctx?: any,
  sendAlert: boolean = true
) {
  // Always log to Winston
  logger.error(`[${errorType}]`, {
    details,
    userId: ctx?.from?.id || 'unknown',
    timestamp: new Date().toISOString(),
  });

  // Always send to Sentry if DSN is configured - this ensures errors are never swallowed
  if (SENTRY_DSN) {
    try {
      Sentry.captureException(details instanceof Error ? details : new Error(JSON.stringify(details)), {
        extra: {
          errorType,
          userId: ctx?.from?.id || 'unknown',
          details,
        },
      });
    } catch (sentryError) {
      logger.error('Failed to send error to Sentry', sentryError);
    }
  }

  // Optional: Send Telegram alert to admin if configured
  if (sendAlert && ADMIN_CHAT_ID && bot) {
    try {
      const msg = `⚠️ *Error Alert*\n\n*Type:* ${errorType}\n*User:* ${ctx?.from?.id || 'unknown'}\n*Details:* ${JSON.stringify(details, null, 2)}`;
      await bot.telegram.sendMessage(ADMIN_CHAT_ID, msg, { parse_mode: 'Markdown' });
    } catch (alertError) {
      logger.error('Failed to send admin alert', alertError);
    }
  }
}

// Export Sentry for manual error capture if needed
export { Sentry };

// Export the Logger helper for convenience
export { LoggerHelper };

export default logger;
