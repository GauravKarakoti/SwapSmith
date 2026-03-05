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

export interface UseVoiceInputReturn {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  isSupported: boolean;
  inputMethod: VoiceInputMethod;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  error: string | null;
  resetTranscript: () => void;
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

  // Refs for Speech Recognition
  const recognitionRef = useRef<any>(null);
  const hasSpeechApi = useRef(false);

  // Refs for MediaRecorder
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Check support on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    hasSpeechApi.current = !!SpeechRecognition;

    // We support voice input if either Speech API or MediaRecorder is available
    const hasMediaRecorder = typeof MediaRecorder !== 'undefined';
    const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

    setIsSupported(hasSpeechApi.current || (hasMediaRecorder && hasGetUserMedia));
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

    recognitionRef.current.onresult = (event: any) => {
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

    recognitionRef.current.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);

      // Don't treat 'no-speech' as a hard error, just stop listening
      if (event.error === 'no-speech') {
        setIsListening(false);
        return;
      }

      let errorMessage = 'Voice input error';
      switch (event.error) {
        case 'audio-capture':
          errorMessage = 'No microphone found. Please check your microphone connection.';
          break;
        case 'not-allowed':
          errorMessage = 'Microphone permission denied. Please allow microphone access.';
          break;
        case 'network':
          errorMessage = 'Network error. Falling back to alternative method...';
          break;
        case 'aborted':
          // User aborted, no need for error message
          setIsListening(false);
          return;
        default:
          errorMessage = `Voice input error: ${event.error}`;
      }

      setError(errorMessage);
      config.onError?.(errorMessage);
      setIsListening(false);
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

  // Start MediaRecorder fallback
  const startMediaRecorder = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      streamRef.current = stream;
      audioChunksRef.current = [];

      const mimeType = getBestMimeType();
      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};

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
      };

      // Start recording
      mediaRecorderRef.current.start(100); // Collect data every 100ms

      return true;
    } catch (err) {
      console.error('Failed to start MediaRecorder:', err);
      const errorMessage = err instanceof Error ? err.message : 'Could not access microphone';
      setError(errorMessage);
      config.onError?.(errorMessage);
      return false;
    }
  }, [config, getBestMimeType]);

  // Start recording - tries Speech API first, falls back to MediaRecorder
  const startRecording = useCallback(async () => {
    setError(null);

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
    startRecording,
    stopRecording,
    error,
    resetTranscript
  };
};

export default useVoiceInput;
