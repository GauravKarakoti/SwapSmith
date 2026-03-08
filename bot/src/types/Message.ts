/**
 * Type definitions for message handling and conversation history
 */

/**
 * Represents a single message in conversation history
 */
export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Groq API message format
 */
export interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Groq chat completion request
 */
export interface GroqChatCompletionRequest {
  messages: GroqMessage[];
  model: string;
  response_format?: {
    type: 'json_object' | 'text';
  };
  temperature: number;
  max_tokens: number;
}

/**
 * Groq chat completion response
 */
export interface GroqChatCompletionResponse {
  choices: Array<{
    message: GroqMessage;
    index: number;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  id: string;
  created: number;
  model: string;
}

/**
 * Groq API error response
 */
export interface GroqError {
  status?: number;
  message: string;
  error?: {
    message: string;
    type: string;
    code: string;
  };
}

/**
 * Audio transcription request parameters
 */
export interface TranscriptionRequest {
  file: NodeJS.ReadableStream;
  model: string;
  response_format: 'json' | 'text' | 'verbose_json';
}

/**
 * Audio transcription response
 */
export interface TranscriptionResponse {
  text: string;
  language?: string;
  duration?: number;
}

/**
 * Conversation context for message history
 */
export interface ConversationContext {
  userId: number;
  messages: ConversationMessage[];
  lastMessageTime: Date;
  inputType: 'text' | 'voice';
}

/**
 * Extended conversation message with metadata
 */
export interface ExtendedMessage extends ConversationMessage {
  timestamp: Date;
  userId?: number;
  metadata?: {
    language?: string;
    confidence?: number;
    originalInput?: string;
  };
}
