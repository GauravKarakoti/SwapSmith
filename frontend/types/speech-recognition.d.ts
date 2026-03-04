// Global type declarations for the Web Speech API.
// TypeScript's DOM lib (lib.dom.d.ts) includes SpeechRecognitionResult/Alternative/List
// but does NOT include SpeechRecognition, SpeechRecognitionEvent, or window.SpeechRecognition.

declare global {
  interface SpeechRecognition extends EventTarget {
    start(): void;
    stop(): void;
    abort(): void;
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
    onstart: (() => void) | null;
  }

  interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number;
    readonly results: SpeechRecognitionResultList;
  }

  interface SpeechRecognitionErrorEvent extends Event {
    readonly error: string;
    readonly message: string;
  }

  interface Window {
    webkitAudioContext: typeof AudioContext;
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export {};
