import winston from 'winston';
import path from 'path';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for console output
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Add colors to winston
winston.addColors(colors);

// Create the format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info: any) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Create the format for file output (without colors)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.printf(
    (info: any) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Determine if we're in a server-side context (Node.js)
const isNodeJS = typeof window === 'undefined' && typeof process !== 'undefined';

// Create the logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format: fileFormat,
  transports: [
    // Always log to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// Add file transports only in Node.js environment (server-side)
if (isNodeJS) {
  try {
    // Add file transports for persistent logging
    logger.add(new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      format: fileFormat
    }));
    
    logger.add(new winston.transports.File({ 
      filename: 'logs/all.log',
      format: fileFormat
    }));
  } catch (err) {
    // If logs directory doesn't exist, just use console
    console.warn('Logger: Could not initialize file transports. Logging to console only.');
  }
}

// Helper function to log with metadata
export function logWithMetadata(
  level: 'error' | 'warn' | 'info' | 'http' | 'debug',
  message: string,
  metadata?: Record<string, any>
) {
  if (metadata) {
    logger.log(level, `${message} ${JSON.stringify(metadata)}`);
  } else {
    logger.log(level, message);
  }
}

// Export the logger with convenient methods
export const Logger = {
  error: (message: string, meta?: Record<string, any>) => logWithMetadata('error', message, meta),
  warn: (message: string, meta?: Record<string, any>) => logWithMetadata('warn', message, meta),
  info: (message: string, meta?: Record<string, any>) => logWithMetadata('info', message, meta),
  http: (message: string, meta?: Record<string, any>) => logWithMetadata('http', message, meta),
  debug: (message: string, meta?: Record<string, any>) => logWithMetadata('debug', message, meta),
};

export default logger;
