'use client';

import { useEffect } from 'react';
import { ErrorType, useErrorHandler } from '@/hooks/useErrorHandler';
import { RequestError } from '@/lib/api-client';

export default function GlobalAsyncErrorListeners() {
  const { handleError } = useErrorHandler();

  useEffect(() => {
    const handleWindowError = (event: ErrorEvent) => {
      handleError(event.error || new Error(event.message || 'Unexpected application error'), ErrorType.UNKNOWN_ERROR, {
        operation: 'window_error',
      });
    };

    const handlePromiseRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const type =
        reason instanceof RequestError && (reason.kind === 'timeout' || reason.kind === 'network')
          ? ErrorType.NETWORK_ERROR
          : ErrorType.API_FAILURE;

      handleError(reason, type, {
        operation: 'unhandled_promise_rejection',
      });
    };

    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handlePromiseRejection);

    return () => {
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handlePromiseRejection);
    };
  }, [handleError]);

  return null;
}
