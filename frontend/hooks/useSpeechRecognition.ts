import { useState, useEffect, useRef, useCallback } from 'react';
import { detectBrowser, checkVoiceCapabilities, getVoiceErrorMessage } from '@/utils/browser-detection';

export interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  isSupported: boolean;
  startRecording: () => void;
  stopRecording: () => Promise<string | null>;
  error: string | null;
  isFallbackMode: boolean;
  browserInfo: {
    browser: string;
    isUsingFallback: boolean;
  };
}

// Helper to get best MIME type for MediaRecorder
function getBestMimeType(): string {
  const mimeTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/wav'
  ];
  
  for (const mimeType of mimeTypes) {
    try {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    } catch {
      continue;
    }
  }
  return 'audio/webm';
}

// Send audio to Whisper transcription
async function transcribeWithWhisper(audioBlob: Blob): Promise<string> {
  const audioFile = new File([audioBlob], 'voice_command.webm', { type: audioBlob.type || 'audio/webm' });
  const formData = new FormData();
  formData.append('file', audioFile);

  const response = await fetch('/api/transcribe', {
    method: 'POST',
    body: formData
  });

  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error);
  }
  
  return data.text || '';
}

export const useSpeechRecognition = (): UseSpeechRecognitionReturn => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFallbackMode, setIsFallbackMode] = useState(false);
  const [browserInfo, setBrowserInfo] = useState({ browser: 'unknown', isUsingFallback: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  
  // MediaRecorder refs for fallback
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const currentBrowserInfo = detectBrowser();
      const capabilities = checkVoiceCapabilities();

      setBrowserInfo({
        browser: currentBrowserInfo.name || 'unknown',
        isUsingFallback: false
      });

      // Firefox doesn't support Speech Recognition API well
      if (currentBrowserInfo.isFirefox) {
        setIsSupported(false);
        setError("Firefox: Voice input requires audio recording mode. Please use the advanced voice input feature.");
        return;
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!SpeechRecognition || !capabilities.hasSpeechRecognition) {
        setIsSupported(false);
        setError(capabilities.userMessage || "Voice input is not supported in this browser.");
      } else {
        setIsSupported(true);
        
        try {
          const recognition = new SpeechRecognition();
          recognitionRef.current = recognition;

          recognition.continuous = false; // We want single command
          recognition.interimResults = true; // Show results as they come
          recognition.lang = 'en-US';
          recognition.maxAlternatives = 1;

          recognition.onstart = () => {
            setIsListening(true);
            setError(null);
          };

          recognition.onend = () => {
            setIsListening(false);
          };

          recognition.onresult = (event: SpeechRecognitionEvent) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
              } else {
                finalTranscript += event.results[i][0].transcript;
              }
            }
            setTranscript(finalTranscript);
          };

          recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            console.error("Speech recognition error", event.error);
            
            // Don't treat 'no-speech' as a hard error
            if (event.error === 'no-speech') {
              setError("No speech was detected. Please try again.");
              setIsListening(false);
              return;
            }

            // Use enhanced error messaging
            const errorMessage = getVoiceErrorMessage(event.error, currentBrowserInfo);
            setError(errorMessage);
            setIsListening(false);
          };
        } catch (initError) {
          console.error('Failed to initialize Speech Recognition:', initError);
          setIsSupported(false);
          setError(`${currentBrowserInfo.name}: Speech recognition initialization failed. Please try refreshing the page.`);
        }
      }
      setIsListening(false);
    } // Fixed stray semicolon and correct closing brace here

    return () => {
      if (recognitionRef.current) {
          try {
            recognitionRef.current.abort();
          } catch (e) {
            // Ignore cleanup errors
          }
      }

      // Cleanup MediaRecorder if exists
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startMediaRecorder = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mimeType = getBestMimeType();
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        setIsListening(false);
        
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
        
        // Create blob and transcribe
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        
        try {
          const text = await transcribeWithWhisper(audioBlob);
          setTranscript(text);
        } catch (err) {
          const error = err as Error;
          setError(`Transcription failed: ${error.message}`);
        }
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100); // Collect data every 100ms
      setIsListening(true);
      setError(null);
    } catch (err) {
      const error = err as Error;
      if (error.name === 'NotAllowedError') {
        setError('Microphone access denied. Please enable microphone permissions.');
      } else if (error.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone.');
      } else {
        setError(`Failed to start recording: ${error.message}`);
      }
      setIsListening(false);
    }
  }, []);

  const startRecording = useCallback(() => {
    const currentBrowserInfo = detectBrowser();
    
    // Check fallback mode logic
    if (isFallbackMode) {
      startMediaRecorder();
      return;
    }

    if (!isSupported || !recognitionRef.current) {
        const errorMessage = currentBrowserInfo.isFirefox 
          ? "Firefox: Please use the advanced voice input feature for audio recording."
          : "Voice input is not supported in this browser.";
        setError(errorMessage);
        return;
    }
    
    try {
        setTranscript('');
        setError(null);
        recognitionRef.current.start();
      } catch (err) {
        console.warn('Speech recognition already started or failed to start', err);
      }
      // Fixed extra closing brace that was here 
  }, [isSupported, isFallbackMode, startMediaRecorder]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (isFallbackMode && mediaRecorderRef.current) {
      // Stop MediaRecorder and wait for transcription
      return new Promise((resolve) => {
        const mediaRecorder = mediaRecorderRef.current;
        
        if (!mediaRecorder || mediaRecorder.state === 'inactive') {
          resolve(null);
          return;
        }
        
        const onStop = async () => {
          mediaRecorder.removeEventListener('stop', onStop);
          
          // Create blob and transcribe
          const mimeType = getBestMimeType();
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          
          try {
            const text = await transcribeWithWhisper(audioBlob);
            resolve(text);
          } catch (err) {
            const error = err as Error;
            setError(`Transcription failed: ${error.message}`);
            resolve(null);
          }
        };
        
        mediaRecorder.addEventListener('stop', onStop);
        mediaRecorder.stop();
      });
    } else if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      return null; // Transcript comes via onresult
    }
    
    return null;
  }, [isListening, isFallbackMode]);

  return {
    isListening,
    transcript,
    isSupported,
    startRecording,
    stopRecording,
    error,
    isFallbackMode,
    browserInfo
  };
};