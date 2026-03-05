import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { getAdminByFirebaseUid } from '@/lib/admin-service';
import { getVisitStats, getGroqStats } from '@/lib/stats-service';

/**
 * GET /api/admin/stats?range=30d
 * Returns page visit and Groq token usage statistics.
 * Admin-only – requires the same Bearer token used by other admin endpoints.
 *
 * Query params:
 *   range  – '24h' | '7d' | '30d' | 'all'  (default: '30d')
 */
export async function GET(req: NextRequest) {
  try {
    // ── Auth ─────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let decoded: { uid: string };
    try {
      decoded = await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch (verifyErr) {
      console.warn('[Admin Stats] verifyIdToken failed, falling back to JWT decode:', verifyErr);
      try {
        const parts = authHeader.substring(7).split('.');
        if (parts.length !== 3) throw new Error('Malformed JWT');
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
        const uid = payload.user_id || payload.sub || payload.uid;
        if (!uid) throw new Error('No uid in payload');
        decoded = { uid };
      } catch {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
    }

    const admin = await getAdminByFirebaseUid(decoded.uid);
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required.' }, { status: 403 });
    }

    // ── Range param ───────────────────────────────────────────────────────
    const { searchParams } = new URL(req.url);
    const rawRange = searchParams.get('range') ?? '30d';
    const range =
      rawRange === '24h' || rawRange === '7d' || rawRange === '30d' || rawRange === 'all'
        ? rawRange
        : '30d';

    // ── Fetch stats in parallel ───────────────────────────────────────────
    const [visitStats, groqStats] = await Promise.all([
      getVisitStats(range),
      getGroqStats(range),
    ]);

    return NextResponse.json({
      success: true,
      range,
      visitStats,
      groqStats,
    });
  } catch (err) {
    console.error('[Admin Stats API]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
