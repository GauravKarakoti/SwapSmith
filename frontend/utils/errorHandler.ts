/**
 * Comprehensive Error Handling & Recovery System
 * 
 * Provides:
 * - Centralized error classification and logging
 * - Retry logic with exponential backoff
 * - Error state management
 * - Recovery strategies for different error types
 */

/**
 * Error classification types
 */
export enum ErrorType {
  NETWORK = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT_ERROR',
  VALIDATION = 'VALIDATION_ERROR',
  AUTHENTICATION = 'AUTH_ERROR',
  AUTHORIZATION = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND_ERROR',
  SERVER = 'SERVER_ERROR',
  UNKNOWN = 'UNKNOWN_ERROR',
  PERSISTENCE = 'PERSISTENCE_ERROR',
  QUOTA = 'QUOTA_ERROR',
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Structured error object
 */
export interface StructuredError {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  code?: string | number;
  originalError?: Error;
  timestamp: Date;
  context?: Record<string, unknown>;
  retryable: boolean;
  retryCount?: number;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  jitter?: boolean;
}

/**
 * Default retry config
 */
const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * Classify error type from response status or error object
 */
export function classifyError(error: unknown): { type: ErrorType; severity: ErrorSeverity } {
  if (error instanceof TypeError) {
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return { type: ErrorType.NETWORK, severity: ErrorSeverity.MEDIUM };
    }
  }

  if (error instanceof SyntaxError) {
    return { type: ErrorType.VALIDATION, severity: ErrorSeverity.MEDIUM };
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('timeout') || message.includes('abort')) {
      return { type: ErrorType.TIMEOUT, severity: ErrorSeverity.MEDIUM };
    }

    if (message.includes('quota') || message.includes('rate limit')) {
      return { type: ErrorType.QUOTA, severity: ErrorSeverity.HIGH };
    }

    if (message.includes('unauthorized') || message.includes('invalid token')) {
      return { type: ErrorType.AUTHENTICATION, severity: ErrorSeverity.HIGH };
    }

    if (message.includes('forbidden')) {
      return { type: ErrorType.AUTHORIZATION, severity: ErrorSeverity.HIGH };
    }

    if (message.includes('not found')) {
      return { type: ErrorType.NOT_FOUND, severity: ErrorSeverity.MEDIUM };
    }
  }

  // Check response status if available
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;

    if (err.status === 400 || err.code === 400) {
      return { type: ErrorType.VALIDATION, severity: ErrorSeverity.LOW };
    }

    if (err.status === 401 || err.code === 401) {
      return { type: ErrorType.AUTHENTICATION, severity: ErrorSeverity.HIGH };
    }

    if (err.status === 403 || err.code === 403) {
      return { type: ErrorType.AUTHORIZATION, severity: ErrorSeverity.HIGH };
    }

    if (err.status === 404 || err.code === 404) {
      return { type: ErrorType.NOT_FOUND, severity: ErrorSeverity.MEDIUM };
    }

    if (err.status === 429 || err.code === 429) {
      return { type: ErrorType.QUOTA, severity: ErrorSeverity.HIGH };
    }

    if ((err.status as number) >= 500) {
      return { type: ErrorType.SERVER, severity: ErrorSeverity.CRITICAL };
    }
  }

  return { type: ErrorType.UNKNOWN, severity: ErrorSeverity.MEDIUM };
}

/**
 * Determine if error is retryable
 */
export function isRetryable(error: unknown, errorType?: ErrorType): boolean {
  const type = errorType || classifyError(error).type;

  const retryableTypes = [
    ErrorType.NETWORK,
    ErrorType.TIMEOUT,
    ErrorType.SERVER,
    ErrorType.QUOTA,
  ];

  return retryableTypes.includes(type);
}

/**
 * Create structured error object
 */
export function createStructuredError(
  error: unknown,
  context?: Record<string, unknown>
): StructuredError {
  const { type, severity } = classifyError(error);
  const originalError = error instanceof Error ? error : undefined;
  const message = originalError?.message || JSON.stringify(error);
  const code = extractErrorCode(error);
  const retryable = isRetryable(error, type);

  return {
    type,
    severity,
    message,
    code,
    originalError,
    timestamp: new Date(),
    context,
    retryable,
  };
}

/**
 * Extract error code from various error sources
 */
function extractErrorCode(error: unknown): string | number | undefined {
  if (error instanceof Error && 'code' in error) {
    return (error as Record<string, unknown>).code as string | number | undefined;
  }

  if (typeof error === 'object' && error !== null && 'code' in error) {
    return (error as Record<string, unknown>).code as string | number | undefined;
  }

  if (typeof error === 'object' && error !== null && 'status' in error) {
    return (error as Record<string, unknown>).status as string | number | undefined;
  }

  return undefined;
}

/**
 * Calculate exponential backoff delay with optional jitter
 */
export function calculateBackoffDelay(
  retryCount: number,
  config: RetryConfig = {}
): number {
  const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };

  let delay = cfg.initialDelayMs * Math.pow(cfg.backoffMultiplier, retryCount);
  delay = Math.min(delay, cfg.maxDelayMs);

  if (cfg.jitter) {
    // Add random jitter (±20%)
    const jitterAmount = delay * 0.2;
    delay = delay + (Math.random() - 0.5) * 2 * jitterAmount;
  }

  return Math.max(delay, 0);
}

/**
 * Sleep utility for delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  context: string,
  config: RetryConfig = {}
): Promise<T> {
  const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | unknown;
  let retryCount = 0;

  while (retryCount <= cfg.maxRetries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (retryCount < cfg.maxRetries && isRetryable(error)) {
        const delay = calculateBackoffDelay(retryCount, cfg);
        console.warn(
          `[ErrorHandler] ${context} - Attempt ${retryCount + 1} failed, retrying in ${delay}ms`,
          error
        );
        await sleep(delay);
        retryCount++;
      } else {
        break;
      }
    }
  }

  const structuredError = createStructuredError(lastError, { context, retryCount });
  console.error('[ErrorHandler] Max retries exceeded', structuredError);
  throw lastError;
}

/**
 * Error logging service
 */
export const errorLogger = {
  /**
   * Log structured error
   */
  logError(error: StructuredError): void {
    const logLevel = error.severity === ErrorSeverity.CRITICAL ? 'error' : 'warn';
    console[logLevel as 'error' | 'warn'](`[${error.type}]`, {
      message: error.message,
      code: error.code,
      severity: error.severity,
      context: error.context,
      timestamp: error.timestamp.toISOString(),
    });
  },

  /**
   * Log with error classification
   */
  log(error: unknown, context?: Record<string, unknown>): StructuredError {
    const structured = createStructuredError(error, context);
    this.logError(structured);
    return structured;
  },

  /**
   * Track error for analytics
   */
  async trackError(error: StructuredError): Promise<void> {
    try {
      // Send to error tracking service (e.g., Sentry, LogRocket)
      if (typeof window !== 'undefined' && window.navigator.onLine) {
        // Implement based on your error tracking service
        console.debug('[ErrorHandler] Error tracked:', error);
      }
    } catch (trackingError) {
      console.error('Failed to track error:', trackingError);
    }
  },
};

/**
 * React Error Boundary
 */
import React, { ReactNode, ErrorInfo } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, retry: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  key: number;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      key: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    
    // Log structured error
    const structured = createStructuredError(error, {
      componentStack: errorInfo.componentStack,
    });
    errorLogger.logError(structured);

    // Call optional callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  retry = (): void => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      key: prevState.key + 1,
    }));
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.retry);
      }

      // Default error UI
      return (
        <div style={{
          padding: '20px',
          margin: '10px',
          border: '1px solid #f5222d',
          borderRadius: '4px',
          backgroundColor: '#fff2f0',
          color: '#f5222d',
        }}>
          <h2>Something went wrong</h2>
          <details style={{ whiteSpace: 'pre-wrap', marginTop: '10px' }}>
            {this.state.error?.toString()}
            {this.state.errorInfo && (
              <div style={{ marginTop: '10px', fontSize: '12px' }}>
                {this.state.errorInfo.componentStack}
              </div>
            )}
          </details>
          <button
            onClick={this.retry}
            style={{
              marginTop: '10px',
              padding: '8px 16px',
              backgroundColor: '#f5222d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      );
    }

    return <>{this.props.children}</>;
  }
}

export default ErrorBoundary;
