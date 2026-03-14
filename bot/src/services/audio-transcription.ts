/**
 * Secure audio transcription service
 * Uses spawn instead of exec to prevent command injection
 */

import { promises as fs } from 'fs';
import path from 'path';
import { convertAudio, validateAudioFile, cleanupAudioFiles, AudioProcessingOptions } from '../utils/audio-processor';
import logger from './logger';

export interface TranscriptionOptions {
  inputPath: string;
  language?: string;
  model?: string;
}

export interface TranscriptionResult {
  success: boolean;
  text?: string;
  error?: string;
  confidence?: number;
}

/**
 * Securely transcribe audio file
 * Converts to optimal format first, then processes
 */
export async function transcribeAudio(options: TranscriptionOptions): Promise<TranscriptionResult> {
  const { inputPath, language = 'en', model = 'whisper-large-v3' } = options;
  
  let tempFiles: string[] = [];

  try {
    // Validate input file
    const validation = await validateAudioFile(inputPath);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error
      };
    }

    // Create temp directory if it doesn't exist
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.mkdir(tempDir, { recursive: true });

    // Convert to optimal format for transcription (16kHz WAV)
    const tempOutputPath = path.join(tempDir, `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.wav`);
    tempFiles.push(tempOutputPath);

    const conversionOptions: AudioProcessingOptions = {
      inputPath,
      outputPath: tempOutputPath,
      format: 'wav',
      sampleRate: 16000,
      channels: 1
    };

    logger.info('Converting audio for transcription', { inputPath, outputPath: tempOutputPath });

    const conversionResult = await convertAudio(conversionOptions);
    if (!conversionResult.success) {
      return {
        success: false,
        error: `Audio conversion failed: ${conversionResult.error}`
      };
    }

    // Here you would integrate with your transcription service
    // For example, using Groq's Whisper API or OpenAI's Whisper
    const transcriptionResult = await performTranscription(tempOutputPath, language, model);

    logger.info('Audio transcription completed', {
      success: transcriptionResult.success,
      textLength: transcriptionResult.text?.length || 0
    });

    return transcriptionResult;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Audio transcription error', { error: errorMessage });
    
    return {
      success: false,
      error: errorMessage
    };
  } finally {
    // Clean up temporary files
    if (tempFiles.length > 0) {
      await cleanupAudioFiles(tempFiles);
    }
  }
}

/**
 * Perform actual transcription using external service
 * This is a placeholder - integrate with your preferred transcription service
 */
async function performTranscription(audioPath: string, language: string, model: string): Promise<TranscriptionResult> {
  try {
    // Example integration with Groq's Whisper API
    // Replace this with your actual transcription service integration
    
    const audioBuffer = await fs.readFile(audioPath);
    
    // Create a File-like object for the API
    const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
    const audioFile = new File([audioBlob], 'audio.wav', { type: 'audio/wav' });

    // Example API call (replace with your actual service)
    const transcription = await callTranscriptionAPI(audioFile, language, model);

    if (!transcription || !transcription.text || transcription.text.trim().length === 0) {
      return {
        success: false,
        error: 'No speech detected in audio'
      };
    }

    return {
      success: true,
      text: transcription.text,
      confidence: transcription.confidence || 0.8
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Transcription service error';
    logger.error('Transcription API error', { error: errorMessage });
    
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Placeholder for actual transcription API call
 * Replace with your preferred service (Groq, OpenAI, etc.)
 */
async function callTranscriptionAPI(_audioFile: File, _language: string, _model: string): Promise<{ text: string; confidence?: number }> {
  // This is a placeholder implementation
  // Replace with actual API integration
  
  // Example for Groq integration:
  /*
  import { loadSecret } from '../../../shared/utils/secrets-loader';
  
  const apiKey = loadSecret('groq_api_key', 'GROQ_API_KEY');
  const groq = new Groq({ apiKey });
  
  const transcription = await groq.audio.transcriptions.create({
    file: audioFile,
    model: model,
    response_format: 'json',
    language: language,
    temperature: 0.0,
  });
  
  return {
    text: transcription.text,
    confidence: 0.9
  };
  */

  // Placeholder response
  throw new Error('Transcription API not configured. Please integrate with your preferred service.');
}

/**
 * Batch transcribe multiple audio files
 */
export async function transcribeAudioBatch(filePaths: string[], options: Partial<TranscriptionOptions> = {}): Promise<TranscriptionResult[]> {
  const results: TranscriptionResult[] = [];

  for (const filePath of filePaths) {
    try {
      const result = await transcribeAudio({
        inputPath: filePath,
        ...options
      });
      results.push(result);
    } catch (error) {
      results.push({
        success: false,
        error: error instanceof Error ? error.message : 'Batch transcription error'
      });
    }
  }

  return results;
}

/**
 * Get supported audio formats for transcription
 */
export function getSupportedAudioFormats(): string[] {
  return ['wav', 'mp3', 'ogg', 'webm', 'm4a', 'flac'];
}

/**
 * Estimate transcription time based on audio duration
 */
export function estimateTranscriptionTime(audioDurationSeconds: number): number {
  // Rough estimate: transcription takes about 10-20% of audio duration
  return Math.max(5, audioDurationSeconds * 0.15); // Minimum 5 seconds
}