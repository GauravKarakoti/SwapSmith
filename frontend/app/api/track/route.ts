import { NextRequest, NextResponse } from 'next/server';
import { logPageVisit } from '@/lib/stats-service';

/**
 * POST /api/track
 * Lightweight endpoint to record a page visit.
 * Called from client-side `usePageTracking` hook.
 * Body: { page: string; userId?: string; sessionId?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { page, userId, sessionId } = body as {
      page?: string;
      userId?: string;
      sessionId?: string;
    };

    if (!page || typeof page !== 'string') {
      return NextResponse.json({ ok: false, error: 'page is required' }, { status: 400 });
    }

    const userAgent = req.headers.get('user-agent');
    const referer   = req.headers.get('referer');

    // Fire-and-forget: we don't await the logging so it never slows down the response
    logPageVisit({
      page,
      userId:    userId    ?? null,
      sessionId: sessionId ?? null,
      userAgent: userAgent ?? null,
      referer:   referer   ?? null,
    }).catch(() => { /* swallow */ });

    return NextResponse.json({ ok: true });
  } catch {
    // Never surface errors to the client from a tracking endpoint
    return NextResponse.json({ ok: false });
  }
}
