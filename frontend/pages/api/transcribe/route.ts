import { NextRequest, NextResponse } from 'next/server';
import { transcribeAudio } from '@/utils/groq-client';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('audio/')) {
      return NextResponse.json({ error: 'Invalid file type. Please upload audio.' }, { status: 400 });
    }

    const text = await transcribeAudio(file);
    return NextResponse.json({ text });
  } catch (error: any) {
    console.error('Transcription API Error:', error);
    return NextResponse.json({ error: error.message || 'Transcription failed' }, { status: 500 });
  }
}