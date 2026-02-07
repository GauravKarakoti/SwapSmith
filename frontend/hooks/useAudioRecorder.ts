import { useState, useRef, useCallback, useEffect } from 'react';

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
  };
}

// Cross-browser audio recording polyfill
class AudioRecorderPolyfill {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private mimeType: string = '';
  private browser: string = 'unknown';

  constructor() {
    this.detectBrowser();
  }

  private detectBrowser(): void {
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
    // Browser-specific MIME type selection with fallbacks
    const mimeTypesByBrowser = {
      chrome: [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/wav'
      ],
      firefox: [
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/webm;codecs=opus',
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
        'audio/mp4',
        'audio/wav'
      ]
    };

    const browserMimeTypes = mimeTypesByBrowser[this.browser as keyof typeof mimeTypesByBrowser] || mimeTypesByBrowser.chrome;

    // Find first supported MIME type
    for (const mimeType of browserMimeTypes) {
      try {
        if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(mimeType)) {
          return mimeType;
        }
      } catch {
        continue;
      }
    }

    // Ultimate fallback - let browser choose
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

    // Browser-specific optimizations
    if (this.browser === 'safari') {
      // Safari-specific optimizations
      const audioConstraints = baseConstraints.audio as MediaTrackConstraints;
      baseConstraints.audio = {
        ...audioConstraints,
        sampleRate: 44100 // Safari prefers higher sample rates
      };
    } else if (this.browser === 'firefox') {
      // Firefox-specific optimizations - keep base constraints
      // Firefox works well with the base configuration
    }

    return baseConstraints;
  }

  async startRecording(config: AudioRecorderConfig = {}): Promise<void> {
    try {
      // Get optimal audio constraints for this browser
      const constraints = this.getOptimalConstraints(config);
      
      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Get best MIME type for this browser
      this.mimeType = this.getBestMimeType();
      
      // Create MediaRecorder with browser-specific options
      const options: MediaRecorderOptions = {};
      if (this.mimeType) {
        options.mimeType = this.mimeType;
      }

      // Browser-specific MediaRecorder options
      if (this.browser === 'safari') {
        options.audioBitsPerSecond = 128000;
      } else if (this.browser === 'firefox') {
        options.audioBitsPerSecond = 128000;
      } else if (this.browser === 'chrome' || this.browser === 'edge') {
        options.audioBitsPerSecond = 128000;
      }

      this.mediaRecorder = new MediaRecorder(this.stream, options);
      this.audioChunks = [];

      // Set up event handlers
      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      // Start recording with appropriate time slice
      const timeSlice = this.browser === 'safari' ? 100 : 1000;
      this.mediaRecorder.start(timeSlice);

    } catch (error) {
      this.cleanup();
      throw error;
    }
  }

  async stopRecording(): Promise<Blob | null> {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      return null;
    }

    return new Promise((resolve) => {
      this.mediaRecorder!.onstop = () => {
        // Create blob with detected MIME type or fallback
        const finalMimeType = this.mimeType || 'audio/webm';
        const audioBlob = new Blob(this.audioChunks, { type: finalMimeType });
        
        this.cleanup();
        resolve(audioBlob);
      };

      this.mediaRecorder!.stop();
    });
  }

  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
  }

  isSupported(): boolean {
    return !!(
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function' &&
      window.MediaRecorder
    );
  }

  getBrowserInfo() {
    const supportedMimeTypes = [
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
    });

    return {
      browser: this.browser,
      supportedMimeTypes,
      recommendedMimeType: this.getBestMimeType()
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
  }>({
    browser: 'unknown',
    supportedMimeTypes: [],
    recommendedMimeType: ''
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