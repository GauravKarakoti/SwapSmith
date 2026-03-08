import { NextRequest, NextResponse } from 'next/server';
import { updateCourseProgress, addRewardActivity } from '@/lib/database';
import { verifyAuth } from '@/lib/auth-helpers';

export async function POST(request: NextRequest) {
  try {
    // Verify Firebase authentication token
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return authResult.error!;
    }

    const userId = authResult.userId!.toString();

    const { courseId, courseTitle, moduleId, totalModules } = await request.json();

    if (!courseId || !courseTitle || !moduleId || !totalModules) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const progress = await updateCourseProgress(
      parseInt(userId),
      courseId,
      courseTitle,
      moduleId,
      totalModules
    );

    if (!progress) {
      return NextResponse.json(
        { error: 'Failed to update progress' },
        { status: 500 }
      );
    }

    // Award points for module completion
    const isNewModule = progress.completedModules.length === 1 || 
      progress.completedModules[progress.completedModules.length - 1] === moduleId;
    
    let totalPointsAwarded = 0;
    let totalTokensAwarded = 0;
    
    if (isNewModule) {
      await addRewardActivity(
        parseInt(userId),
        'module_complete',
        25,
        '0.5',
        { courseId, moduleId, courseTitle }
      );
      totalPointsAwarded += 25;
      totalTokensAwarded += 0.5;
    }

    // Award bonus for course completion
    if (progress.isCompleted && progress.completedModules.length === totalModules) {
      await addRewardActivity(
        parseInt(userId),
        'course_complete',
        100,
        '5',
        { courseId, courseTitle }
      );
      totalPointsAwarded += 100;
      totalTokensAwarded += 5;
    }

    return NextResponse.json({ 
      success: true, 
      progress,
      pointsAwarded: totalPointsAwarded,
      tokensAwarded: totalTokensAwarded
    });
  } catch (error) {
    console.error('Error updating course progress:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
