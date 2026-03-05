import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { getRateLimitStatus } from '@/lib/rate-limiter';
import { applyAPISecurityHeaders } from '@/lib/security-headers';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function transcribeHandler(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('file') as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // Validate file size (max 25MB for Whisper API)
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (audioFile.size > maxSize) {
      return NextResponse.json(
        { error: 'Audio file too large. Maximum size is 25MB.' },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/wav', 'audio/mpeg'];
    if (!validTypes.some(type => audioFile.type.includes(type.split('/')[1]))) {
      return NextResponse.json(
        { error: 'Invalid audio format. Supported formats: webm, ogg, mp4, wav, mp3' },
        { status: 400 }
      );
    }

    // Convert File to Buffer for Groq API
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Create a File-like object that Groq SDK expects
    const audioBlob = new Blob([buffer], { type: audioFile.type });
    const file = new File([audioBlob], audioFile.name, { type: audioFile.type });

    // Transcribe with Groq Whisper
    const transcription = await groq.audio.transcriptions.create({
      file: file,
      model: 'whisper-large-v3',
      response_format: 'json',
      language: 'en', // Can be made dynamic
      temperature: 0.0, // More deterministic
    });

    if (!transcription.text || transcription.text.trim().length === 0) {
      return NextResponse.json(
        { error: 'No speech detected in audio. Please try again.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      text: transcription.text,
    });

  } catch (error) {
    console.error('Transcription error:', error);

    // Handle specific Groq API errors
    if (error instanceof Error) {
      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          { error: 'Too many requests. Please wait a moment and try again.' },
          { status: 429 }
        );
      }
      if (error.message.includes('invalid')) {
        return NextResponse.json(
          { error: 'Invalid audio format. Please try recording again.' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to transcribe audio. Please try again.' },
      { status: 500 }
    );
  }
}

// Apply rate limiting and CSRF protection
export async function POST(req: NextRequest) {
  const { isLimited } = getRateLimitStatus(req);
  if (isLimited) {
    const response = NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    return applyAPISecurityHeaders(response);
  }

  const response = await transcribeHandler(req);
  return applyAPISecurityHeaders(response);
}

export const config = {
  api: {
    bodyParser: false, // Disable default body parser for file uploads
  },
};
