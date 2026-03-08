/**
 * Type definitions for logging system
 * Provides complete type safety for error handling and logging operations
 */

/**
 * Telegram context from Telegraf library
 */
export interface TelegrafContext {
  from?: {
    id?: number;
    username?: string;
  };
  chat?: {
    id?: number;
  };
  message?: {
    message_id?: number;
  };
  [key: string]: any;
}

/**
 * HTTP error response from external APIs
 */
export interface HttpErrorResponse {
  status?: number;
  message: string;
  code?: string;
  statusText?: string;
}

/**
 * Error details with structured information
 */
export interface ErrorDetails {
  code?: string;
  statusText?: string;
  message?: string;
  response?: HttpErrorResponse;
  stack?: string;
  config?: {
    method?: string;
    url?: string;
    data?: unknown;
    headers?: Record<string, unknown>;
  };
  [key: string]: unknown;
}

/**
 * Parsed error context from various error types
 */
export interface ParsedErrorDetails {
  errorType: string;
  message: string;
  code?: string;
  statusCode?: number;
  stack?: string;
  details: ErrorDetails;
}

/**
 * Log context containing information about where/when logging occurred
 */
export interface LogContext {
  chatId?: number;
  messageId?: number;
  username?: string;
  userId?: string;
  [key: string]: unknown;
}

/**
 * Structured log entry for file logging
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  errorType?: string;
  userId?: string;
  details: Record<string, unknown>;
  context?: LogContext;
  stack?: string;
  severity?: LogSeverity;
}

/**
 * Error notification details for multi-channel alerts
 */
export interface ErrorNotificationDetails {
  errorType: string;
  details: ErrorDetails;
  userId?: string;
  timestamp: string;
  severity: LogSeverity;
  context?: LogContext;
}

/**
 * Log severity levels
 */
export type LogSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Log levels for Winston logger
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/**
 * Sentry breadcrumb for tracking user actions
 */
export interface SentryBreadcrumb {
  category?: string;
  message?: string;
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  data?: Record<string, unknown>;
  timestamp?: number;
}

/**
 * Error statistics from log files
 */
export interface ErrorStatistics {
  criticalErrors: number;
  totalErrors: number;
  lastError?: string;
}
