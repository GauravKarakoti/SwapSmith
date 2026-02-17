import { NextRequest, NextResponse } from 'next/server';
import { getUserCourseProgress } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const courses = await getUserCourseProgress(parseInt(userId));

    return NextResponse.json(courses);
  } catch (error) {
    console.error('Error fetching course progress:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
