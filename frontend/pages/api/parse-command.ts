import { NextApiRequest, NextApiResponse } from 'next';
import { parseUserCommand } from '@/utils/groq-client';
import { csrfGuard } from '@/lib/csrf';
import logger from '@/lib/logger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CSRF Protection
  if (!csrfGuard(req, res)) {
    return;
  }

  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ 
      success: false,
      error: 'Valid message is required',
      validationErrors: ['Message must be a non-empty string']
    });
  }

  // Basic spam/abuse protection
  if (message.length > 500) {
    return res.status(400).json({
      success: false,
      error: 'Message too long',
      validationErrors: ['Message must be under 500 characters']
    });
  }

  try {
    const parsedCommand = await parseUserCommand(message);
    
    // Log for monitoring and improvement
    logger.info('Command parsed:', {
      input: message,
      output: parsedCommand,
      timestamp: new Date().toISOString()
    });

    res.status(200).json(parsedCommand);
  } catch (error: unknown) {
    logger.error('Error parsing command:', { error });
    
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