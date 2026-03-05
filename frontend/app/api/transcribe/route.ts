import { NextRequest, NextResponse } from 'next/server';
import { transcribeAudio } from '@/utils/groq-client';
import { withEnhancedCSRF } from '@/lib/enhanced-csrf';
import { applyAPISecurityHeaders } from '@/lib/security-headers';

export const runtime = 'nodejs';

async function transcribeHandler(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      const response = NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
      return applyAPISecurityHeaders(response);
    }

    // Validate file type
    if (!file.type.startsWith('audio/')) {
      const response = NextResponse.json({ error: 'Invalid file type. Please upload audio.' }, { status: 400 });
      return applyAPISecurityHeaders(response);
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      const response = NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 });
      return applyAPISecurityHeaders(response);
    }

    const text = await transcribeAudio(file);
    const response = NextResponse.json({ text });
    return applyAPISecurityHeaders(response);
  } catch (error: unknown) {
    console.error('Transcription API Error:', error);
    const errorObj = error as Error;
    const response = NextResponse.json({ error: errorObj.message || 'Transcription failed' }, { status: 500 });
    return applyAPISecurityHeaders(response);
  }
}

// Apply CSRF protection
export async function POST(req: NextRequest) {
  // CSRF protection is handled by middleware
  return transcribeHandler(req);
}