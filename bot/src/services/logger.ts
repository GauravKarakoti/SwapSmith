import winston from 'winston';
import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';

dotenv.config();

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const bot = new Telegraf(process.env.BOT_TOKEN!);

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Add colors to winston
winston.addColors(colors);

// Define the format for logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info: any) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Define transports
const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
    ),
  }),
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
  }),
  new winston.transports.File({ filename: 'logs/all.log' }),
];

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  levels,
  format,
  transports,
});

// Unified error handling function
export async function handleError(
  errorType: string,
  details: any,
  ctx?: any, // Optional Telegraf context for user info
  sendAlert: boolean = true
) {
  // Log the error using Winston
  logger.error(`[${errorType}]`, {
    details,
    userId: ctx?.from?.id || 'unknown',
    timestamp: new Date().toISOString(),
  });

  // Optionally send Telegram alert
  if (sendAlert && ADMIN_CHAT_ID) {
    try {
      const msg = `⚠️ *Error Alert*\n\n*Type:* ${errorType}\n*User:* ${ctx?.from?.id || 'unknown'}\n*Details:* ${JSON.stringify(details, null, 2)}`;
      await bot.telegram.sendMessage(ADMIN_CHAT_ID, msg, { parse_mode: 'Markdown' });
    } catch (alertError) {
      logger.error('Failed to send admin alert', alertError);
    }
  }
}

export default logger;
