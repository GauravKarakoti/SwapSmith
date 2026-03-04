import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  isSupported: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  error: string | null;
}

export const useSpeechRecognition = (): UseSpeechRecognitionReturn => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(true); // Optimistic initially, checked in useEffect
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!SpeechRecognition) {
        setIsSupported(false);
        setError("Voice input is not supported in this browser.");
      } else {
        setIsSupported(true);
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false; // We want single command
        recognitionRef.current.interimResults = true; // Show results as they come
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onstart = () => {
          setIsListening(true);
          setError(null);
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              // Handle interim results if needed, but for now we focus on final
              // You might want to update a live preview here
              finalTranscript += event.results[i][0].transcript;
            }
          }
          setTranscript(finalTranscript);
        };

        recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error("Speech recognition error", event.error);
          if (event.error === 'no-speech') {
             setError("No speech was detected. Please try again.");
          } else if (event.error === 'audio-capture') {
             setError("No microphone was found. Ensure that a microphone is installed.");
          } else if (event.error === 'not-allowed') {
             setError("Microphone permission denied.");
          } else {
             setError(`Speech recognition error: ${event.error}`);
          }
          setIsListening(false);
        };
      }
    }

    return () => {
        if (recognitionRef.current) {
            recognitionRef.current.abort();
        }
    };
  }, []);

  const startRecording = useCallback(() => {
    if (!isSupported || !recognitionRef.current) {
        setError("Voice input is not supported in this browser.");
        return;
    }
    try {
        setTranscript('');
        recognitionRef.current.start();
    } catch (err) {
        // Handle case where start() is called while already running
        console.warn("Speech recognition already started or failed to start", err);
    }
  }, [isSupported]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  return {
    isListening,
    transcript,
    isSupported,
    startRecording,
    stopRecording,
    error
  };
};
