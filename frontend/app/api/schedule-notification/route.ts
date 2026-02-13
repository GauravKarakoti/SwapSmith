import { NextRequest, NextResponse } from 'next/server';
import { scheduleNotification, stopScheduledNotification } from '@/lib/notification-scheduler';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, userId, userEmail, userName, type, frequency, cronExpression } = body;

    if (action === 'schedule') {
      if (!userId || !userEmail || !userName || !type || !frequency) {
        return NextResponse.json(
          { error: 'userId, userEmail, userName, type, and frequency are required' },
          { status: 400 }
        );
      }

      const result = scheduleNotification({
        userId,
        userEmail,
        userName,
        type,
        frequency,
        cronExpression,
      });

      return NextResponse.json(result);
    } else if (action === 'stop') {
      if (!userId || !type) {
        return NextResponse.json(
          { error: 'userId and type are required' },
          { status: 400 }
        );
      }

      const result = stopScheduledNotification(userId, type);
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
