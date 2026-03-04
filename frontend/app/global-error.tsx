'use client';

import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { Toaster } from 'react-hot-toast';
import ErrorFallback from '@/components/ErrorFallback';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global app error:', error);
    toast.error('A critical error interrupted the app. Please retry.');
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-slate-900 dark:bg-[#050505] dark:text-white">
        <Toaster position="top-center" />
        <ErrorFallback
          title="Application error"
          description="The application crashed while rendering this request. Retry to reload the app shell."
          onRetry={reset}
          retryLabel="Reload app"
        />
      </body>
    </html>
  );
}
