import { NextApiRequest, NextApiResponse } from 'next';
import { parseUserCommand } from '@/utils/groq-client';
import { withEnhancedCSRF } from '@/lib/enhanced-csrf';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import logger from '@/lib/logger';

async function parseCommandHandler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ 
      success: false,
      error: 'Valid message is required',
      validationErrors: ['Message must be a non-empty string']
    });
  }

  // Enhanced input validation
  const trimmedMessage = message.trim();
  if (trimmedMessage.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Message cannot be empty',
      validationErrors: ['Message must contain non-whitespace characters']
    });
  }

  // Basic spam/abuse protection
  if (trimmedMessage.length > 500) {
    return res.status(400).json({
      success: false,
      error: 'Message too long',
      validationErrors: ['Message must be under 500 characters']
    });
  }

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /data:text\/html/i,
    /vbscript:/i
  ];

  if (suspiciousPatterns.some(pattern => pattern.test(trimmedMessage))) {
    logger.warn('Suspicious input detected:', { message: trimmedMessage, ip: req.ip });
    return res.status(400).json({
      success: false,
      error: 'Invalid input detected',
      validationErrors: ['Message contains invalid content']
    });
  }

  try {
    const parsedCommand = await parseUserCommand(trimmedMessage);
    
    // Log for monitoring and improvement
    logger.info('Command parsed:', {
      input: trimmedMessage,
      output: parsedCommand,
      timestamp: new Date().toISOString(),
      ip: req.ip
    });

    // Add security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

    res.status(200).json(parsedCommand);
  } catch (error: unknown) {
    logger.error('Error parsing command:', { error, ip: req.ip });
    
    // Differentiate between Groq API errors and other errors
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const isGroqError = errorMessage.includes('GROQ') || errorMessage.includes('API');
    
    res.status(isGroqError ? 503 : 500).json({ 
      success: false,
      error: isGroqError ? 'Service temporarily unavailable' : 'Failed to parse command',
      validationErrors: [errorMessage]
    });
  }
}

// Apply comprehensive security: Rate limiting + Enhanced CSRF
export default withRateLimit(
  withEnhancedCSRF(parseCommandHandler),
  { ...RATE_LIMITS.strict, message: 'Too many command parsing requests. Please wait before trying again.' }
);