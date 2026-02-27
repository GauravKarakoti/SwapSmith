import Groq from "groq-sdk";
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';

// Global singleton declaration for server-side Groq client
declare global {
    var _groqClientServer: Groq | undefined;
}

function getGroqClient(): Groq {
    if (!global._groqClientServer) {
        global._groqClientServer = new Groq({
            apiKey: process.env.GROQ_API_KEY,
        });
    }
    return global._groqClientServer;
}

export async function transcribeAudio(audioBuffer: Buffer, fileName: string): Promise<string> {
    const tempDir = os.tmpdir();
    const inputPath = path.join(tempDir, `input-${Date.now()}-${fileName}`);
    const outputPath = path.join(tempDir, `output-${Date.now()}.wav`);

    try {
        const groq = getGroqClient();

        // Save uploaded buffer to temp path
        await fs.promises.writeFile(inputPath, audioBuffer);

        // Transcode to WAV 16kHz Mono using ffmpeg
        // -ar 16000: Set audio sampling rate to 16kHz
        // -ac 1: Set audio channels to 1 (mono)
        // -c:a pcm_s16le: Set codec to PCM signed 16-bit little endian (standard for many speech APIs)
        await new Promise<void>((resolve, reject) => {
            exec(`ffmpeg -i "${inputPath}" -ar 16000 -ac 1 -c:a pcm_s16le "${outputPath}" -y`, (error) => {
                if (error) {
                    console.error("FFmpeg Error:", error);
                    reject(new Error("Failed to transcode audio. Make sure ffmpeg is installed on the server."));
                } else {
                    resolve();
                }
            });
        });

        const transcription = await groq.audio.transcriptions.create({
            file: fs.createReadStream(outputPath),
            model: "whisper-large-v3",
            response_format: "json",
        });

        return transcription.text;
    } catch (error) {
        console.error("Transcription Error:", error);
        throw error;
    } finally {
        // Cleanup temp files
        try {
            if (fs.existsSync(inputPath)) await fs.promises.unlink(inputPath);
            if (fs.existsSync(outputPath)) await fs.promises.unlink(outputPath);
        } catch (e) {
            console.warn("Cleanup failed:", e);
        }
    }
}
