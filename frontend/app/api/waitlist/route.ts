import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Waitlist from '@/models/Waitlist';
import { waitlistBodySchema, validateInput } from '@/lib/api-validation';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = validateInput(waitlistBodySchema, body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { email } = validation.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Connect to database
    await connectDB();

    // Check if email already exists
    const existingEmail = await Waitlist.findOne({ email: normalizedEmail });

    if (existingEmail) {
      return NextResponse.json(
        { error: 'This email is already on the waitlist' },
        { status: 409 }
      );
    }

    // Create new waitlist entry
    const newEntry = await Waitlist.create({
      email: normalizedEmail,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Successfully joined the waitlist!',
        data: {
          email: newEntry.email,
          createdAt: newEntry.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error('Waitlist API error:', error);

    // Handle duplicate key error from MongoDB
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      return NextResponse.json(
        { error: 'This email is already on the waitlist' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Something went wrong. Please try again later.' },
      { status: 500 }
    );
  }
}
