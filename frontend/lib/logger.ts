/**
 * Logger utility for frontend API routes
 * Provides structured logging with consistent formatting
 * In production, this should integrate with a centralized logging service
 */

// Log levels enum for type safety
export enum LogLevel {
  error = 0,
  warn = 1,
  info = 2,
  debug = 3,
}

// Current log level - can be controlled via environment
const currentLevel = process.env.NEXT_PUBLIC_LOG_LEVEL 
  ? LogLevel[process.env.NEXT_PUBLIC_LOG_LEVEL as keyof typeof LogLevel]
  : LogLevel.info;

/**
 * Format log message with timestamp and metadata
 */
function formatMessage(level: string, message: string, metadata?: object): string {
  const timestamp = new Date().toISOString();
  
  let metadataStr = '';
  if (metadata) {
    try {
      metadataStr = ` ${JSON.stringify(metadata, (_, v) => typeof v === 'bigint' ? v.toString() : v)}`;
    } catch {
      metadataStr = ' [Metadata serialization failed]';
    }
  }

  return `${timestamp} [${level.toUpperCase()}]: ${message}${metadataStr}`;
}

/**
 * Logger instance with methods for each log level
 */
export const logger = {
  error: (message: string, metadata?: object) => {
    if (currentLevel >= LogLevel.error) {
      console.error(formatMessage('error', message, metadata));
    }
  },
  
  warn: (message: string, metadata?: object) => {
    if (currentLevel >= LogLevel.warn) {
      console.warn(formatMessage('warn', message, metadata));
    }
  },
  
  info: (message: string, metadata?: object) => {
    if (currentLevel >= LogLevel.info) {
      console.log(formatMessage('info', message, metadata));
    }
  },
  
  debug: (message: string, metadata?: object) => {
    if (currentLevel >= LogLevel.debug) {
      console.debug(formatMessage('debug', message, metadata));
    }
  },
};

// Default export for convenience
export default logger;
