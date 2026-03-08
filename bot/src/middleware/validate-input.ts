/**
 * Input Validation Middleware for Bot
 * Validates and sanitizes incoming requests
 * Prevents ReDoS, injection attacks, and malformed data
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import {
  ParseCommandRequestSchema,
  SaveChatHistorySchema,
  sanitizeInput,
  VALIDATION_LIMITS,
  safeParse,
} from '../../../shared/utils/validation';
import logger from '../services/logger';

/**
 * Middleware factory for validating request body against a Zod schema
 */
export function validateRequest(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validationResult = safeParse(schema, req.body);

      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validationResult.errors,
        });
      }

      // Replace body with validated data
      (req as any).validatedBody = validationResult.data;
      next();
    } catch (error) {
      logger.error('Validation middleware error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal validation error',
      });
    }
  };
}

/**
 * Middleware to validate parse command requests
 */
export function validateParseCommandRequest() {
  return validateRequest(ParseCommandRequestSchema);
}

/**
 * Middleware to validate chat history requests
 */
export function validateSaveChatHistory() {
  return validateRequest(SaveChatHistorySchema);
}

/**
 * Middleware to sanitize all string inputs in request body
 * Applied before validation
 */
export function sanitizeRequestBody(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObjectStrings(req.body);
    }
    next();
  } catch (error) {
    logger.error('Input sanitization error:', error);
    return res.status(400).json({
      success: false,
      error: 'Invalid input format',
    });
  }
}

/**
 * Recursively sanitizes all string values in an object
 */
function sanitizeObjectStrings(obj: any): any {
  if (typeof obj === 'string') {
    return sanitizeInput(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObjectStrings(item));
  }

  if (obj !== null && typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        sanitized[key] = sanitizeObjectStrings(obj[key]);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Middleware to enforce input size limits
 */
export function enforceInputLimits(req: Request, res: Response, next: NextFunction) {
  try {
    const contentLength = parseInt(req.get('content-length') || '0', 10);

    // Enforce maximum payload size (defaults to 10KB)
    if (contentLength > VALIDATION_LIMITS.INPUT_MAX * 10) {
      return res.status(413).json({
        success: false,
        error: 'Payload too large',
      });
    }

    next();
  } catch (error) {
    logger.error('Input limit enforcement error:', error);
    return res.status(400).json({
      success: false,
      error: 'Invalid request',
    });
  }
}

/**
 * Middleware to rate limit specific endpoints
 */
export function rateLimit(
  maxRequests: number,
  windowMs: number
) {
  const requests: Map<string, number[]> = new Map();

  return (req: Request, res: Response, next: NextFunction) => {
    const clientId = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get request timestamps for this client
    let clientRequests = requests.get(clientId) || [];
    clientRequests = clientRequests.filter(timestamp => timestamp > windowStart);

    if (clientRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((clientRequests[0] + windowMs - now) / 1000),
      });
    }

    clientRequests.push(now);
    requests.set(clientId, clientRequests);

    // Cleanup old entries periodically
    if (requests.size > 1000) {
      for (const [key, timestamps] of requests.entries()) {
        const validTimestamps = timestamps.filter(t => t > windowStart);
        if (validTimestamps.length === 0) {
          requests.delete(key);
        } else {
          requests.set(key, validTimestamps);
        }
      }
    }

    next();
  };
}

/**
 * Middleware to validate message content for LLM processing
 */
export function validateLLMInput(req: Request, res: Response, next: NextFunction) {
  try {
    const userInput = req.body?.userInput;

    if (!userInput || typeof userInput !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'userInput is required and must be a string',
      });
    }

    if (userInput.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'userInput cannot be empty',
      });
    }

    if (userInput.length > VALIDATION_LIMITS.COMMAND_MAX) {
      return res.status(400).json({
        success: false,
        error: `userInput exceeds maximum length of ${VALIDATION_LIMITS.COMMAND_MAX}`,
      });
    }

    // Check for suspicious patterns that might indicate attacks
    if (hasSuspiciousPatterns(userInput)) {
      logger.warn('Suspicious input pattern detected', { userInput: userInput.substring(0, 100) });
      return res.status(400).json({
        success: false,
        error: 'Invalid input format',
      });
    }

    next();
  } catch (error) {
    logger.error('LLM input validation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal validation error',
    });
  }
}

/**
 * Checks for suspicious patterns that might indicate attacks
 */
function hasSuspiciousPatterns(input: string): boolean {
  // Check for potential prompt injection
  if (
    /((system|admin|root|sudo)\s*:)/i.test(input) ||
    /ignore.*instruction/i.test(input) ||
    /forget.*instruction/i.test(input) ||
    /override.*instruction/i.test(input) ||
    /you are now.*:/i.test(input)
  ) {
    return true;
  }

  // Check for excessive special characters (potential DoS)
  const specialCharCount = (input.match(/[!@#$%^&*()_+=[\]{};:'",.<>?/\\|`~-]/g) || []).length;
  if (specialCharCount > input.length / 2) {
    return true;
  }

  // Check for excessive whitespace (potential DoS)
  const whitespaceCount = (input.match(/\s/g) || []).length;
  if (whitespaceCount > input.length / 2) {
    return true;
  }

  // Check for repeated characters (potential ReDoS string)
  if (/(.)\1{100,}/.test(input)) {
    return true;
  }

  return false;
}

/**
 * Middleware to validate conversation history size
 */
export function validateConversationSize(req: Request, res: Response, next: NextFunction) {
  try {
    const messageHistory = req.body?.messageHistory;

    if (messageHistory && Array.isArray(messageHistory)) {
      if (messageHistory.length > VALIDATION_LIMITS.HISTORY_SIZE_MAX) {
        return res.status(400).json({
          success: false,
          error: `Message history exceeds maximum size of ${VALIDATION_LIMITS.HISTORY_SIZE_MAX}`,
        });
      }
    }

    next();
  } catch (error) {
    logger.error('Conversation size validation error:', error);
    return res.status(400).json({
      success: false,
      error: 'Invalid message history format',
    });
  }
}

/**
 * Comprehensive validation chain for parse-command endpoint
 */
export function validateParseCommand() {
  return [
    enforceInputLimits,
    sanitizeRequestBody,
    validateLLMInput,
    validateConversationSize,
    validateParseCommandRequest(),
  ];
}

/**
 * Comprehensive validation chain for save-chat endpoint
 */
export function validateSaveChat() {
  return [
    enforceInputLimits,
    sanitizeRequestBody,
    validateSaveChatHistory(),
  ];
}

export { sanitizeInput } from '../../../shared/utils/validation';
