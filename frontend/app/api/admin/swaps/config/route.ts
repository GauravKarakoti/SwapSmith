import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import {
  getAdminByFirebaseUid,
  getPlatformSwapConfig,
  updatePlatformSwapConfig,
} from '@/lib/admin-service';

async function authenticate(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.substring(7));
    return await getAdminByFirebaseUid(decoded.uid);
  } catch {
    return null;
  }
}

/**
 * GET /api/admin/swaps/config
 * Returns platform swap config (emergency stop state + masked API key).
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await authenticate(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const config = await getPlatformSwapConfig();
    // Mask the API key – return only last 4 chars visible
    const maskedKey = config.sideshiftApiKey
      ? `${'*'.repeat(Math.max(0, config.sideshiftApiKey.length - 4))}${config.sideshiftApiKey.slice(-4)}`
      : '';

    return NextResponse.json({
      success: true,
      config: { ...config, sideshiftApiKey: maskedKey },
    });
  } catch (err) {
    console.error('[Admin Swaps Config GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/swaps/config
 * Body: { swapExecutionEnabled?: boolean, sideshiftApiKey?: string }
 * Only super_admin can toggle swap execution.
 */
export async function PATCH(req: NextRequest) {
  try {
    const admin = await authenticate(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json()) as {
      swapExecutionEnabled?: boolean;
      sideshiftApiKey?: string;
    };

    // Only super_admin can toggle the emergency stop
    if (
      typeof body.swapExecutionEnabled === 'boolean' &&
      admin.role !== 'super_admin'
    ) {
      return NextResponse.json(
        { error: 'Only super_admin can toggle swap execution.' },
        { status: 403 },
      );
    }

    // Validate payload
    const patch: { swapExecutionEnabled?: boolean; sideshiftApiKey?: string } = {};
    if (typeof body.swapExecutionEnabled === 'boolean') {
      patch.swapExecutionEnabled = body.swapExecutionEnabled;
    }
    if (typeof body.sideshiftApiKey === 'string') {
      patch.sideshiftApiKey = body.sideshiftApiKey;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
    }

    const updated = await updatePlatformSwapConfig(patch, admin.email);

    // Log the change (console – integrate with audit log as needed)
    console.log(`[Admin Config] ${admin.email} updated swap config:`, JSON.stringify(patch));

    const maskedKey = updated.sideshiftApiKey
      ? `${'*'.repeat(Math.max(0, updated.sideshiftApiKey.length - 4))}${updated.sideshiftApiKey.slice(-4)}`
      : '';

    return NextResponse.json({
      success: true,
      config: { ...updated, sideshiftApiKey: maskedKey },
    });
  } catch (err) {
    console.error('[Admin Swaps Config PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
