import { useState, useRef, useCallback, useEffect } from 'react';

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

export interface AudioRecorderConfig {
  sampleRate?: number;
  numberOfAudioChannels?: number;
}

export interface UseAudioRecorderReturn {
  isRecording: boolean;
  isSupported: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  error: string | null;
  browserInfo: {
    browser: string;
    supportedMimeTypes: string[];
    recommendedMimeType: string;
    isFallback: boolean;
  };
}

// Helper to write string to DataView
function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// Helper to encode Float32 samples to 16-bit PCM
function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, (s < 0 ? s * 0x8000 : s * 0x7FFF), true);
  }
}

// WAV Encoder
function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* RIFF chunk length */
  view.setUint32(4, 36 + samples.length * 2, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, 1, true);
  /* channel count */
  view.setUint16(22, 1, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * 2, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, 2, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, samples.length * 2, true);

  floatTo16BitPCM(view, 44, samples);

  return new Blob([view], { type: 'audio/wav' });
}

// Fallback Recorder using Web Audio API
class WebAudioRecorder {
  private context: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private input: MediaStreamAudioSourceNode | null = null;
  private chunks: Float32Array[] = [];
  private stream: MediaStream;
  private sampleRate: number;

  constructor(stream: MediaStream, config: AudioRecorderConfig) {
    this.stream = stream;
    this.sampleRate = config.sampleRate || 16000;
  }

  start() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.context = new AudioContextClass({ sampleRate: this.sampleRate });
    this.input = this.context.createMediaStreamSource(this.stream);
    
    // bufferSize 4096 is a good balance between latency and performance
    this.processor = this.context.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      const channelData = e.inputBuffer.getChannelData(0);
      // Clone the data since the buffer is reused
      this.chunks.push(new Float32Array(channelData));
    };

    this.input.connect(this.processor);
    this.processor.connect(this.context.destination);
  }

  async stop(): Promise<Blob> {
    if (this.processor && this.input && this.context) {
       this.input.disconnect();
       this.processor.disconnect();
       if (this.context.state !== 'closed') {
         await this.context.close();
       }
    }

    // Determine total length
    const totalLength = this.chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Float32Array(totalLength);
    
    // Flatten chunks
    let offset = 0;
    for (const chunk of this.chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return encodeWAV(result, this.context?.sampleRate || this.sampleRate);
  }
}

// Cross-browser audio recording wrapper
class AudioRecorderPolyfill {
  private mediaRecorder: MediaRecorder | null = null;
  private webAudioRecorder: WebAudioRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private mimeType: string = '';
  private browser: string = 'unknown';
  private useFallback: boolean = false;

  constructor() {
    this.detectBrowser();
  }

  private detectBrowser(): void {
    if (typeof navigator === 'undefined') return;
    const userAgent = navigator.userAgent;
    
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
      this.browser = 'chrome';
    } else if (userAgent.includes('Firefox')) {
      this.browser = 'firefox';
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      this.browser = 'safari';
    } else if (userAgent.includes('Edg')) {
      this.browser = 'edge';
    }
  }

  private getBestMimeType(): string {
    const mimeTypesByBrowser = {
      chrome: [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/wav'
      ],
      firefox: [
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/webm',
        'audio/wav'
      ],
      safari: [
        'audio/mp4',
        'audio/wav',
        'audio/webm'
      ],
      edge: [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/wav'
      ]
    };

    const browserMimeTypes = mimeTypesByBrowser[this.browser as keyof typeof mimeTypesByBrowser] || mimeTypesByBrowser.chrome;

    for (const mimeType of browserMimeTypes) {
      try {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(mimeType)) {
          return mimeType;
        }
      } catch {
        continue;
      }
    }

    return '';
  }

  private getOptimalConstraints(config: AudioRecorderConfig): MediaStreamConstraints {
    const baseConstraints: MediaStreamConstraints = {
      audio: {
        sampleRate: config.sampleRate || 16000,
        channelCount: config.numberOfAudioChannels || 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    };

    if (this.browser === 'safari') {
      const audioConstraints = baseConstraints.audio as MediaTrackConstraints;
      baseConstraints.audio = {
        ...audioConstraints,
        sampleRate: 44100
      };
    }

    return baseConstraints;
  }

  async startRecording(config: AudioRecorderConfig = {}): Promise<void> {
    try {
      this.useFallback = typeof window.MediaRecorder === 'undefined';
      const constraints = this.getOptimalConstraints(config);
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (this.useFallback) {
        // Use Web Audio API Fallback
        this.webAudioRecorder = new WebAudioRecorder(this.stream, config);
        this.webAudioRecorder.start();
      } else {
        // Use Native MediaRecorder
        this.mimeType = this.getBestMimeType();
        const options: MediaRecorderOptions = {};
        if (this.mimeType) {
          options.mimeType = this.mimeType;
        }

        // Bitrate tweaks
        if (['safari', 'firefox', 'chrome', 'edge'].includes(this.browser)) {
          options.audioBitsPerSecond = 128000;
        }

        try {
          this.mediaRecorder = new MediaRecorder(this.stream, options);
        } catch (e) {
          // If native MediaRecorder fails creation despite check, fallback
          console.warn("MediaRecorder failed to initialize, switching to fallback", e);
          this.useFallback = true;
          this.webAudioRecorder = new WebAudioRecorder(this.stream, config);
          this.webAudioRecorder.start();
          return;
        }

        this.audioChunks = [];
        this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
          if (event.data.size > 0) {
            this.audioChunks.push(event.data);
          }
        };

        const timeSlice = this.browser === 'safari' ? 100 : 1000;
        this.mediaRecorder.start(timeSlice);
      }
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }

  async stopRecording(): Promise<Blob | null> {
    if (this.useFallback) {
      if (!this.webAudioRecorder) return null;
      const blob = await this.webAudioRecorder.stop();
      this.cleanup();
      return blob;
    } else {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        return null;
      }

      return new Promise((resolve) => {
        this.mediaRecorder!.onstop = () => {
          const finalMimeType = this.mimeType || 'audio/webm';
          const audioBlob = new Blob(this.audioChunks, { type: finalMimeType });
          this.cleanup();
          resolve(audioBlob);
        };
        this.mediaRecorder!.stop();
      });
    }
  }

  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.webAudioRecorder = null;
    this.audioChunks = [];
  }

  isSupported(): boolean {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      return false;
    }
    // Supported if MediaRecorder exists OR AudioContext exists
    return !!(
      (typeof window !== 'undefined' && window.MediaRecorder) || 
      (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext))
    );
  }

  getBrowserInfo() {
    const supportedMimeTypes = typeof MediaRecorder !== 'undefined' ? [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/wav',
      'audio/ogg;codecs=opus',
      'audio/ogg'
    ].filter(mimeType => {
      try {
        return MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(mimeType);
      } catch {
        return false;
      }
    }) : ['audio/wav']; // Fallback supports WAV

    return {
      browser: this.browser,
      supportedMimeTypes,
      recommendedMimeType: this.getBestMimeType(),
      isFallback: typeof window !== 'undefined' && !window.MediaRecorder
    };
  }
}

export const useAudioRecorder = (config: AudioRecorderConfig = {}): UseAudioRecorderReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [browserInfo, setBrowserInfo] = useState<{
    browser: string;
    supportedMimeTypes: string[];
    recommendedMimeType: string;
    isFallback: boolean;
  }>({
    browser: 'unknown',
    supportedMimeTypes: [],
    recommendedMimeType: '',
    isFallback: false
  });
  const [isSupported, setIsSupported] = useState(false);
  const polyfillRef = useRef<AudioRecorderPolyfill | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      polyfillRef.current = new AudioRecorderPolyfill();
      setBrowserInfo(polyfillRef.current.getBrowserInfo());
      setIsSupported(polyfillRef.current.isSupported());
    }
  }, []);

  const startRecording = useCallback(async (): Promise<void> => {
    if (!isSupported || !polyfillRef.current) {
      setError('Audio recording is not supported in this browser');
      return;
    }

    if (isRecording) {
      return;
    }

    try {
      setError(null);
      await polyfillRef.current.startRecording(config);
      setIsRecording(true);
      // Update browser info in case fallback was triggered during start
      setBrowserInfo(polyfillRef.current.getBrowserInfo());
    } catch (err: unknown) {
      console.error('Failed to start recording:', err);
      
      const error = err as Error;
      if (error.name === 'NotAllowedError') {
        setError('Microphone access denied. Please enable microphone permissions and try again.');
      } else if (error.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone and try again.');
      } else if (error.name === 'NotSupportedError') {
        setError('Audio recording is not supported in this browser.');
      } else {
        setError(`Failed to start recording: ${error.message || 'Unknown error'}`);
      }
      setIsRecording(false);
    }
  }, [isSupported, isRecording, config]);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    if (!isRecording || !polyfillRef.current) {
      return null;
    }

    try {
      const audioBlob = await polyfillRef.current.stopRecording();
      setIsRecording(false);
      return audioBlob;
    } catch (err: unknown) {
      console.error('Failed to stop recording:', err);
      const error = err as Error;
      setError(`Failed to stop recording: ${error.message || 'Unknown error'}`);
      setIsRecording(false);
      return null;
    }
  }, [isRecording]);

  return {
    isRecording,
    isSupported,
    startRecording,
    stopRecording,
    error,
    browserInfo
  };
};