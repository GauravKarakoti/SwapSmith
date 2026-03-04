'use client';

import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorFallbackProps {
  title?: string;
  description: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export default function ErrorFallback({
  title = 'Something went wrong',
  description,
  onRetry,
  retryLabel = 'Try again',
}: ErrorFallbackProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl rounded-3xl border border-red-500/20 bg-white/90 p-8 shadow-2xl shadow-red-500/10 backdrop-blur dark:bg-[#0f1115]/95">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
          <AlertTriangle className="h-7 w-7" />
        </div>

        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
          {title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {description}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-400"
            >
              <RefreshCw className="h-4 w-4" />
              {retryLabel}
            </button>
          )}

          <Link
            href="/"
            className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-white/10 dark:text-slate-200 dark:hover:border-white/20 dark:hover:text-white"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
