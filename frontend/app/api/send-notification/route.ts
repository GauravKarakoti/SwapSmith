import { NextRequest, NextResponse } from 'next/server';
import {
  sendWalletReminderEmail,
  sendPriceAlertEmail,
  sendGeneralNotification,
} from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, userEmail, userName, ...data } = body;

    if (!userEmail || !userName) {
      return NextResponse.json(
        { error: 'userEmail and userName are required' },
        { status: 400 }
      );
    }

    let result;

    switch (type) {
      case 'wallet':
        result = await sendWalletReminderEmail(userEmail, userName);
        break;

      case 'price':
        if (!data.cryptoName || !data.price || !data.change) {
          return NextResponse.json(
            { error: 'cryptoName, price, and change are required for price alerts' },
            { status: 400 }
          );
        }
        result = await sendPriceAlertEmail(
          userEmail,
          userName,
          data.cryptoName,
          data.price,
          data.change
        );
        break;

      case 'general':
        if (!data.title || !data.message) {
          return NextResponse.json(
            { error: 'title and message are required for general notifications' },
            { status: 400 }
          );
        }
        result = await sendGeneralNotification(
          userEmail,
          userName,
          data.title,
          data.message,
          data.ctaText,
          data.ctaUrl
        );
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid notification type. Must be wallet, price, or general' },
          { status: 400 }
        );
    }

    if (result.success) {
      return NextResponse.json({ success: true, messageId: result.messageId });
    } else {
      return NextResponse.json(
        { error: result.error || 'Failed to send email' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in send-notification API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
