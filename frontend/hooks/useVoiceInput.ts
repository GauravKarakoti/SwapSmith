import { useState, useEffect, useRef, useCallback } from 'react';

// Extend Window interface for Web Speech API
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SpeechRecognition: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webkitSpeechRecognition: any;
  }
}

export type VoiceInputMethod = 'speech-api' | 'media-recorder' | null;

export interface BrowserCompatibility {
  hasSpeechAPI: boolean;
  hasMediaRecorder: boolean;
  hasGetUserMedia: boolean;
  recommendedMethod: VoiceInputMethod;
  warnings: string[];
}

export interface UseVoiceInputReturn {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  isSupported: boolean;
  inputMethod: VoiceInputMethod;
  compatibility: BrowserCompatibility;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  error: string | null;
  resetTranscript: () => void;
  clearError: () => void;
  retryCount: number;
}

interface VoiceInputConfig {
  onError?: (error: string) => void;
  onTranscriptChange?: (transcript: string) => void;
}

export const useVoiceInput = (config: VoiceInputConfig = {}): UseVoiceInputReturn => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const [inputMethod, setInputMethod] = useState<VoiceInputMethod>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [compatibility, setCompatibility] = useState<BrowserCompatibility>({
    hasSpeechAPI: false,
    hasMediaRecorder: false,
    hasGetUserMedia: false,
    recommendedMethod: null,
    warnings: [],
  });

  // Refs for Speech Recognition
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const hasSpeechApi = useRef(false);

  // Refs for MediaRecorder
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Retry configuration
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000; // 1 second

  // Check support on mount and detect browser compatibility
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const hasSpeech = !!SpeechRecognition;
    hasSpeechApi.current = hasSpeech;

    const hasMediaRec = typeof MediaRecorder !== 'undefined';
    const hasGetMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

    const warnings: string[] = [];
    let recommendedMethod: VoiceInputMethod = null;

    // Determine best method and warnings
    if (hasSpeech) {
      recommendedMethod = 'speech-api';
      // Check for webkit prefix (Safari/older Chrome)
      if (!window.SpeechRecognition && window.webkitSpeechRecognition) {
        warnings.push('Using webkit speech recognition (limited browser support)');
      }
    } else if (hasMediaRec && hasGetMedia) {
      recommendedMethod = 'media-recorder';
      warnings.push('Real-time transcription unavailable. Using audio recording fallback.');
    } else {
      warnings.push('Voice input not supported in this browser. Please use Chrome, Edge, or Safari.');
    }

    // Browser-specific warnings
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('firefox')) {
      warnings.push('Firefox has limited voice support. Chrome or Edge recommended.');
    }
    if (userAgent.includes('mobile') || userAgent.includes('android') || userAgent.includes('iphone')) {
      warnings.push('Mobile voice input may require additional permissions.');
    }

    const compat: BrowserCompatibility = {
      hasSpeechAPI: hasSpeech,
      hasMediaRecorder: hasMediaRec,
      hasGetUserMedia: hasGetMedia,
      recommendedMethod,
      warnings,
    };

    setCompatibility(compat);
    setIsSupported(hasSpeech || (hasMediaRec && hasGetMedia));
  }, []);

  // Initialize Speech Recognition
  const initSpeechRecognition = useCallback(() => {
    if (!hasSpeechApi.current) return false;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-US';

    recognitionRef.current.onstart = () => {
      setIsListening(true);
      setError(null);
      setInputMethod('speech-api');
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = '';
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += transcript;
        } else {
          interimText += transcript;
        }
      }

      if (finalText) {
        setTranscript((prev) => {
          const newTranscript = prev + finalText;
          config.onTranscriptChange?.(newTranscript);
          return newTranscript;
        });
        setInterimTranscript('');
      } else {
        setInterimTranscript(interimText);
      }
    };

    recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);

      // Don't treat 'no-speech' as a hard error, just stop listening
      if (event.error === 'no-speech') {
        setIsListening(false);
        return;
      }

      let errorMessage = 'Voice input error';
      let shouldFallback = false;

      switch (event.error) {
        case 'audio-capture':
          errorMessage = 'No microphone found. Please check your microphone connection.';
          break;
        case 'not-allowed':
          errorMessage = 'Microphone permission denied. Please allow microphone access.';
          break;
        case 'network':
          errorMessage = 'Network error. Trying alternative method...';
          shouldFallback = true;
          break;
        case 'service-not-allowed':
          errorMessage = 'Speech service unavailable. Switching to audio recording...';
          shouldFallback = true;
          break;
        case 'aborted':
          // User aborted, no need for error message
          setIsListening(false);
          return;
        default:
          errorMessage = `Voice input error: ${event.error}`;
          shouldFallback = true;
      }

      setError(errorMessage);
      config.onError?.(errorMessage);
      setIsListening(false);

      // Automatic fallback to MediaRecorder if available
      if (shouldFallback && compatibility.hasMediaRecorder && compatibility.hasGetUserMedia) {
        console.log('Attempting automatic fallback to MediaRecorder...');
        setTimeout(async () => {
          const success = await startMediaRecorder();
          if (success) {
            setError('Switched to audio recording mode');
          }
        }, 500);
      }
    };

    return true;
  }, [config]);

  // Get best MIME type for MediaRecorder
  const getBestMimeType = useCallback((): string => {
    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4',
      'audio/wav'
    ];

    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }

    return '';
  }, []);

  // Start MediaRecorder fallback with audio quality validation
  const startMediaRecorder = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true, // Added for better audio quality
        }
      });

      streamRef.current = stream;
      audioChunksRef.current = [];

      // Validate audio stream
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio tracks available');
      }

      const audioTrack = audioTracks[0];
      const settings = audioTrack.getSettings();
      console.log('Audio track settings:', settings);

      // Warn if audio quality is poor
      if (settings.sampleRate && settings.sampleRate < 8000) {
        console.warn('Low sample rate detected:', settings.sampleRate);
      }

      const mimeType = getBestMimeType();
      if (!mimeType) {
        throw new Error('No supported audio format found');
      }

      const options: MediaRecorderOptions = { mimeType };

      mediaRecorderRef.current = new MediaRecorder(stream, options);

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstart = () => {
        setIsListening(true);
        setError(null);
        setInputMethod('media-recorder');
        setTranscript(''); // Reset transcript for media recorder mode
        setRetryCount(0); // Reset retry count on successful start
      };

      mediaRecorderRef.current.onstop = () => {
        setIsListening(false);
        // Stop all tracks to release the microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.onerror = (event: Event) => {
        console.error('MediaRecorder error:', event);
        const errorMessage = 'Recording error. Please try again.';
        setError(errorMessage);
        config.onError?.(errorMessage);
        setIsListening(false);

        // Retry logic
        if (retryCount < MAX_RETRIES) {
          console.log(`Retrying MediaRecorder (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
          setRetryCount(prev => prev + 1);
          setTimeout(() => {
            startMediaRecorder();
          }, RETRY_DELAY * (retryCount + 1)); // Exponential backoff
        }
      };

      // Start recording
      mediaRecorderRef.current.start(100); // Collect data every 100ms

      return true;
    } catch (err) {
      console.error('Failed to start MediaRecorder:', err);
      let errorMessage = 'Could not access microphone';

      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          errorMessage = 'Microphone permission denied. Please allow access in your browser settings.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          errorMessage = 'No microphone found. Please connect a microphone and try again.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          errorMessage = 'Microphone is already in use by another application.';
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
      config.onError?.(errorMessage);
      return false;
    }
  }, [config, getBestMimeType, retryCount]);

  // Start recording - tries Speech API first, falls back to MediaRecorder
  const startRecording = useCallback(async () => {
    setError(null); // Clear any previous errors
    setRetryCount(0); // Reset retry count on new attempt
    setTranscript(''); // Reset transcript for fresh recording
    setInterimTranscript(''); // Reset interim transcript

    // Try Web Speech API first (for real-time transcription)
    if (hasSpeechApi.current && initSpeechRecognition()) {
      try {
        recognitionRef.current.start();
        return;
      } catch (err) {
        console.warn('SpeechRecognition failed to start, trying MediaRecorder:', err);
        // Fall through to MediaRecorder
      }
    }

    // Fallback to MediaRecorder + Whisper API
    const success = await startMediaRecorder();
    if (!success) {
      const errorMessage = 'Voice input is not supported in this browser.';
      setError(errorMessage);
      setIsSupported(false);
      config.onError?.(errorMessage);
    }
  }, [config, initSpeechRecognition, startMediaRecorder]);

  // Stop recording
  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    if (inputMethod === 'speech-api' && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      // Return null since we already have the transcript via Speech API
      return null;
    }

    if (inputMethod === 'media-recorder' && mediaRecorderRef.current) {
      return new Promise((resolve) => {
        if (!mediaRecorderRef.current) {
          resolve(null);
          return;
        }

        mediaRecorderRef.current.onstop = () => {
          setIsListening(false);

          // Stop all tracks
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
          }

          // Create audio blob
          if (audioChunksRef.current.length > 0) {
            const mimeType = getBestMimeType() || 'audio/webm';
            const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
            resolve(audioBlob);
          } else {
            resolve(null);
          }
        };

        mediaRecorderRef.current.stop();
      });
    }

    setIsListening(false);
    return null;
  }, [inputMethod, getBestMimeType]);

  // Reset transcript
  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  // Clear error state (useful for UI to explicitly dismiss errors)
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore abort errors
        }
      }

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    inputMethod,
    compatibility,
    startRecording,
    stopRecording,
    error,
    resetTranscript,
    clearError,
    retryCount
  };
};

export default useVoiceInput;
