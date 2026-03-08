'use client'

import { useState, useCallback } from 'react';

export enum ErrorType {
  API_FAILURE = 'api_failure',
  NETWORK_ERROR = 'network_error', 
  PARSING_ERROR = 'parsing_error',
  VOICE_ERROR = 'voice_error',
  WALLET_ERROR = 'wallet_error',
  UNKNOWN_ERROR = 'unknown_error'
}

export interface ErrorState {
  message: string | null;
  type: ErrorType | null;
  isLoading: boolean;
  isRetrying: boolean;
  retryCount: number;
  context?: ErrorContext;
}

export interface ErrorContext {
  operation?: string;
  retryable?: boolean;
  technical?: string;
}

export interface UseErrorHandlerReturn {
  errorState: ErrorState;
  handleError: (error: unknown, type: ErrorType, context?: ErrorContext) => string;
  getErrorMessage: (error: unknown, type: ErrorType, context?: ErrorContext) => string;
  setLoading: (loading: boolean) => void;
  clearError: () => void;
  executeWithRecovery: <T,>(
    fn: () => Promise<T>,
    operation: string,
    maxRetries?: number
  ) => Promise<T | null>;
  retry: (fn: () => Promise<void>) => Promise<void>;
}

const BACKOFF_MULTIPLIER = 2;
const INITIAL_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;

export const useErrorHandler = (): UseErrorHandlerReturn => {
  const [errorState, setErrorState] = useState<ErrorState>({
    message: null,
    type: null,
    isLoading: false,
    isRetrying: false,
    retryCount: 0,
  });

  const getErrorMessage = useCallback((error: unknown, type: ErrorType, context?: ErrorContext): string => {
    // Log technical details for debugging
    const errorObj = error as Error;
    console.error(`[${type.toUpperCase()}]`, {
      error: errorObj?.message || error,
      context,
      stack: errorObj?.stack
    });

    // Return user-friendly messages based on error type
    switch (type) {
      case ErrorType.API_FAILURE:
        if (errorObj?.message?.includes('SideShift')) {
          return "Unable to get swap quote. Please try again or check if the trading pair is supported.";
        }
        if (errorObj?.message?.includes('Groq') || errorObj?.message?.includes('transcribe')) {
          return "AI service temporarily unavailable. Please try typing your request instead.";
        }
        return `Service temporarily unavailable${context?.retryable ? '. Please try again' : ''}.`;

      case ErrorType.NETWORK_ERROR:
        if (errorObj?.message?.includes('fetch')) {
          return "Network connection issue. Please check your internet connection and try again.";
        }
        return "Connection problem. Please check your network and retry.";

      case ErrorType.PARSING_ERROR:
        if (errorObj?.message?.includes('validation')) {
          return "I couldn't understand your request. Please try rephrasing or check the asset/chain names.";
        }
        return "Unable to process your command. Please try a different format or check for typos.";

      case ErrorType.VOICE_ERROR:
        if (errorObj?.message?.includes('microphone') || errorObj?.message?.includes('getUserMedia')) {
          return "Microphone access denied. Please enable microphone permissions and try again.";
        }
        if (errorObj?.message?.includes('transcription') || errorObj?.message?.includes('Transcription')) {
          return "Couldn't hear you clearly. Please try speaking again or type your message.";
        }
        return "Voice input failed. Please try again or use text input instead.";

      case ErrorType.WALLET_ERROR:
        if (errorObj?.message?.includes('rejected') || errorObj?.message?.includes('denied')) {
          return "Transaction cancelled. Please try again when ready to sign.";
        }
        if (errorObj?.message?.includes('insufficient')) {
          return "Insufficient balance. Please check your wallet balance and try again.";
        }
        return "Wallet connection issue. Please check your wallet and try again.";

      case ErrorType.UNKNOWN_ERROR:
      default:
        return "Something went wrong. Please try again or contact support if the issue persists.";
    }
  }, []);

  const handleError = useCallback((error: unknown, type: ErrorType, context?: ErrorContext): string => {
    const message = getErrorMessage(error, type, context);
    
    // Update error state
    setErrorState(prev => ({
      ...prev,
      message,
      type,
      context,
    }));
    
    return message;
  }, [getErrorMessage]);

  const setLoading = useCallback((loading: boolean) => {
    setErrorState(prev => ({
      ...prev,
      isLoading: loading,
    }));
  }, []);

  const clearError = useCallback(() => {
    setErrorState(prev => ({
      ...prev,
      message: null,
      type: null,
      retryCount: 0,
    }));
  }, []);

  // Calculate backoff delay
  const calculateBackoffDelay = useCallback((retryCount: number): number => {
    let delay = INITIAL_DELAY_MS * Math.pow(BACKOFF_MULTIPLIER, retryCount);
    delay = Math.min(delay, MAX_DELAY_MS);
    // Add jitter (±20%)
    delay = delay * (0.8 + Math.random() * 0.4);
    return delay;
  }, []);

  // Sleep utility
  const sleep = useCallback((ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  }, []);

  // Execute with retry logic
  const executeWithRecovery = useCallback(
    async <T,>(
      fn: () => Promise<T>,
      operation: string,
      maxRetries: number = 2
    ): Promise<T | null> => {
      clearError();
      setLoading(true);
      let lastError: unknown;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const result = await fn();
          setLoading(false);
          return result;
        } catch (error) {
          lastError = error;
          const errorObj = error as Error;
          
          // Determine if retryable
          const isRetryable = 
            errorObj?.message?.includes('network') ||
            errorObj?.message?.includes('timeout') ||
            errorObj?.message?.includes('ECONNREFUSED') ||
            errorObj?.message?.includes('ENOTFOUND');

          if (attempt < maxRetries && isRetryable) {
            const delay = calculateBackoffDelay(attempt);
            console.warn(`[${operation}] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
            await sleep(delay);
            continue;
          }

          break;
        }
      }

      // Failed after all retries
      const errorType = (lastError as Error)?.message?.includes('network')
        ? ErrorType.NETWORK_ERROR
        : ErrorType.API_FAILURE;

      handleError(lastError, errorType, { operation, retryable: true });
      setLoading(false);
      return null;
    },
    [clearError, setLoading, handleError, calculateBackoffDelay, sleep]
  );

  // Retry failed operation
  const retry = useCallback(
    async (fn: () => Promise<void>) => {
      setErrorState(prev => ({
        ...prev,
        isRetrying: true,
        retryCount: prev.retryCount + 1,
      }));

      try {
        await executeWithRecovery(fn, 'retry-operation', 2);
        clearError();
      } catch (error) {
        handleError(error, ErrorType.UNKNOWN_ERROR);
      } finally {
        setErrorState(prev => ({
          ...prev,
          isRetrying: false,
        }));
      }
    },
    [executeWithRecovery, clearError, handleError]
  );

  return {
    errorState,
    handleError,
    getErrorMessage,
    setLoading,
    clearError,
    executeWithRecovery,
    retry,
  };
};