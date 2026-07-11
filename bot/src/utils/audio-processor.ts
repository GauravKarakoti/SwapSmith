import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import logger from '../services/logger';

export interface AudioProcessingOptions {
  inputPath: string;
  outputPath: string;
  format?: 'wav' | 'mp3' | 'ogg' | 'webm';
  sampleRate?: number;
  channels?: number;
  bitrate?: string;
}

export interface AudioProcessingResult {
  success: boolean;
  outputPath?: string;
  error?: string;
  duration?: number;
}

export async function convertAudio(options: AudioProcessingOptions): Promise<AudioProcessingResult> {
  const { inputPath, outputPath, format = 'mp3', sampleRate = 16000, channels = 1, bitrate = '128k' } = options;

  try {
    await fs.access(inputPath);

    const sanitizedInputPath = path.resolve(inputPath);
    const sanitizedOutputPath = path.resolve(outputPath);
    const allowedDir = path.resolve(process.cwd(), 'temp');

    if (!sanitizedInputPath.startsWith(allowedDir) || !sanitizedOutputPath.startsWith(allowedDir)) {
      throw new Error('File paths must be within allowed directory bounds.');
    }

    const ffmpegArgs = [
      '-i', sanitizedInputPath,
      '-acodec', getAudioCodec(format),
      '-ar', sampleRate.toString(),
      '-ac', channels.toString(),
      '-b:a', bitrate,
      '-y', 
      sanitizedOutputPath
    ];

    logger.info('Starting audio conversion', { input: sanitizedInputPath, format });

    const result = await spawnProcess('ffmpeg', ffmpegArgs);

    if (result.success) {
      await fs.access(sanitizedOutputPath);
      const duration = await getAudioDuration(sanitizedOutputPath);

      logger.info('Audio conversion completed successfully', { outputPath: sanitizedOutputPath, duration });
      return { success: true, outputPath: sanitizedOutputPath, duration };
    } else {
      logger.error('Audio conversion failed', { error: result.error });
      return { success: false, error: result.error };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Audio processing error', { error: errorMessage });
    return { success: false, error: errorMessage };
  }
}

function getAudioCodec(format: string): string {
  switch (format) {
    case 'mp3': return 'libmp3lame';
    case 'ogg': return 'libvorbis';
    case 'webm': return 'libopus';
    case 'wav': default: return 'pcm_s16le';
  }
}

function spawnProcess(command: string, args: string[]): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stderr = '';

    proc.stderr.on('data', (data) => { stderr += data.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve({ success: true });
      else resolve({ success: false, error: `Process exited with code ${code}: ${stderr}` });
    });
    proc.on('error', (error) => resolve({ success: false, error: `Process error: ${error.message}` }));

    setTimeout(() => {
      if (!proc.killed) {
        proc.kill();
        resolve({ success: false, error: 'Process timeout' });
      }
    }, 30000);
  });
}

async function getAudioDuration(filePath: string): Promise<number> {
  try {
    const args = ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', filePath];
    const result = await new Promise<string>((resolve, reject) => {
      const proc = spawn('ffprobe', args, { stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => { stdout += data.toString(); });
      proc.stderr.on('data', (data) => { stderr += data.toString(); });
      proc.on('close', (code) => code === 0 ? resolve(stdout.trim()) : reject(new Error(`ffprobe failed: ${stderr}`)));
      proc.on('error', reject);
    });
    return parseFloat(result) || 0;
  } catch (error) {
    logger.warn('Failed to get audio duration', { error });
    return 0;
  }
}

export async function cleanupAudioFiles(filePaths: string[]): Promise<void> {
  for (const filePath of filePaths) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      logger.warn('Failed to cleanup audio file', { filePath, error });
    }
  }
}

/**
 * Validate audio file format and size
 */
export async function validateAudioFile(filePath: string, maxSizeMB: number = 25): Promise<{ valid: boolean; error?: string }> {
  try {
    const stats = await fs.stat(filePath);
    const sizeMB = stats.size / (1024 * 1024);

    if (sizeMB > maxSizeMB) {
      return {
        valid: false,
        error: `File size ${sizeMB.toFixed(2)}MB exceeds maximum ${maxSizeMB}MB`
      };
    }

    // Check if file is a valid audio format using ffprobe
    const args = [
      '-v', 'quiet',
      '-show_entries', 'stream=codec_type',
      '-of', 'csv=p=0',
      filePath
    ];

    const result = await new Promise<string>((resolve, reject) => {
      const process = spawn('ffprobe', args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error('Invalid audio file'));
        }
      });

      process.on('error', (error) => {
        reject(error);
      });
    });

    if (!result.includes('audio')) {
      return {
        valid: false,
        error: 'File does not contain valid audio stream'
      };
    }

    return { valid: true };

  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'File validation failed'
    };
  }
}