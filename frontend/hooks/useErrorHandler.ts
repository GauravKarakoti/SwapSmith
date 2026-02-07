import { useCallback } from 'react';

export enum ErrorType {
  API_FAILURE = 'api_failure',
  NETWORK_ERROR = 'network_error', 
  PARSING_ERROR = 'parsing_error',
  VOICE_ERROR = 'voice_error',
  WALLET_ERROR = 'wallet_error',
  UNKNOWN_ERROR = 'unknown_error'
}

export interface ErrorContext {
  operation?: string;
  retryable?: boolean;
  technical?: string;
}

export interface UseErrorHandlerReturn {
  handleError: (error: unknown, type: ErrorType, context?: ErrorContext) => string;
  getErrorMessage: (error: unknown, type: ErrorType, context?: ErrorContext) => string;
}

export const useErrorHandler = (): UseErrorHandlerReturn => {
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
    
    // Additional error tracking could be added here
    // e.g., send to analytics service, error reporting service
    
    return message;
  }, [getErrorMessage]);

  return {
    handleError,
    getErrorMessage
  };
};