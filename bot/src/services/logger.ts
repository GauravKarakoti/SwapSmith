import winston from 'winston';
import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import * as Sentry from '@sentry/node';

dotenv.config();

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const SENTRY_DSN = process.env.SENTRY_DSN;
const bot = new Telegraf(process.env.BOT_TOKEN!);

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info: any) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  levels,
  format,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/all.log' }),
  ],
});

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
  if (sendAlert && ADMIN_CHAT_ID) {
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

export default logger;
