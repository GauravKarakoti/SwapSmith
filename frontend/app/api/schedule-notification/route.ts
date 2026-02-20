import { NextRequest, NextResponse } from 'next/server';
import { scheduleNotification, stopScheduledNotification } from '@/lib/notification-scheduler';
import { adminAuth } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    // Verify Authorization Header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error) {
      console.error('Token verification failed:', error);
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    const authenticatedUserId = decodedToken.uid;
    const body = await req.json();
    const { action, userId, userEmail, userName, type, frequency, cronExpression } = body;

    // Ensure the requested userId matches the authenticated user
    if (userId && userId !== authenticatedUserId) {
      return NextResponse.json({ error: 'Forbidden: User ID mismatch' }, { status: 403 });
    }

    // Force use of authenticated ID if userId was not provided or for safety
    const safeUserId = authenticatedUserId;

    if (action === 'schedule') {
      if (!safeUserId || !userEmail || !userName || !type || !frequency) {
        return NextResponse.json(
          { error: 'userId, userEmail, userName, type, and frequency are required' },
          { status: 400 }
        );
      }

      const result = scheduleNotification({
        userId: safeUserId,
        userEmail,
        userName,
        type,
        frequency,
        cronExpression,
      });

      return NextResponse.json(result);
    } else if (action === 'stop') {
      if (!safeUserId || !type) {
        return NextResponse.json(
          { error: 'userId and type are required' },
          { status: 400 }
        );
      }

      const result = stopScheduledNotification(safeUserId, type);
      return NextResponse.json(result);
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Must be schedule or stop' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error in schedule-notification API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
