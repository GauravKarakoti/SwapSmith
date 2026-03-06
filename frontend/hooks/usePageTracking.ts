'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * usePageTracking
 * Sends a fire-and-forget POST to /api/track on every route change.
 * Safe to use in any page or layout component.
 *
 * @param userId  Optional authenticated user ID to associate with the visit.
 */
export function usePageTracking(userId?: string | null) {
  const pathname    = usePathname();
  const sessionRef  = useRef<string>('');

  // Generate / reuse a per-session ID stored in sessionStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const existing = sessionStorage.getItem('_ss_sid');
    if (existing) {
      sessionRef.current = existing;
    } else {
      const sid = Math.random().toString(36).substring(2) + Date.now().toString(36);
      sessionStorage.setItem('_ss_sid', sid);
      sessionRef.current = sid;
    }
  }, []);

  useEffect(() => {
    if (!pathname) return;

    const body = JSON.stringify({
      page:      pathname,
      userId:    userId ?? null,
      sessionId: sessionRef.current || null,
    });

    // Use `sendBeacon` when available (survives page unload), fall back to fetch
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
      } else {
        fetch('/api/track', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => { /* swallow */ });
      }
    } catch {
      /* swallow all errors – tracking must never break the app */
    }
  }, [pathname, userId]);
}
