'use client';

import { useEffect } from 'react';
import toast from 'react-hot-toast';
import ErrorFallback from '@/components/ErrorFallback';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Route segment error:', error);
    toast.error('This page failed to load properly. Please try again.');
  }, [error]);

  return (
    <ErrorFallback
      description="This route hit an unexpected error while rendering or loading data."
      onRetry={reset}
    />
  );
}
