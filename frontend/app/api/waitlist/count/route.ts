import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Waitlist from '@/models/Waitlist';

export async function GET() {
  try {
    // Connect to database
    await connectDB();

    // Get count of all waitlist entries
    const count = await Waitlist.countDocuments();

    return NextResponse.json(
      {
        success: true,
        count,
      },
      { 
        status: 200,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('Waitlist count API error:', error);

    return NextResponse.json(
      { 
        error: 'Failed to fetch waitlist count',
        count: 0,
      },
      { status: 500 }
    );
  }
}

// Enable edge runtime for faster response (optional)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
