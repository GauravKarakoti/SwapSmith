import type { NextApiRequest, NextApiResponse } from 'next';
import { parseUserCommand } from '@/utils/groq-client';
import { csrfGuard } from '@/lib/csrf';
import logger from '@/lib/logger';

type RateEntry = { count: number; firstRequestAt: number };
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const rateLimitStore = new Map<string, RateEntry>();

function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip =
    (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : undefined) ||
    req.socket.remoteAddress ||
    'unknown';
  return ip;
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const existing = rateLimitStore.get(ip);

  if (!existing) {
    rateLimitStore.set(ip, { count: 1, firstRequestAt: now });
    return false;
  }

  if (now - existing.firstRequestAt > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(ip, { count: 1, firstRequestAt: now });
    return false;
  }

  existing.count += 1;
  rateLimitStore.set(ip, existing);
  return existing.count > RATE_LIMIT_MAX_REQUESTS;
}

function containsSuspiciousContent(message: string): string | null {
  const lowered = message.toLowerCase();
  if (lowered.includes('<script') || lowered.includes('</script')) {
    return 'Message contains potentially dangerous script content.';
  }
  if (message.length > 500) {
    return 'Message must be under 500 characters.';
  }
  return null;
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '512kb',
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CSRF Protection
  if (!csrfGuard(req, res)) {
    return;
  }

  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests. Please slow down.',
      validationErrors: ['Rate limit exceeded. Try again in a minute.'],
    });
  }

  const { message } = req.body as { message?: unknown };

  if (typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ 
      success: false,
      error: 'Valid message is required',
      validationErrors: ['Message must be a non-empty string']
    });
  }

  const suspiciousReason = containsSuspiciousContent(message);
  if (suspiciousReason) {
    return res.status(400).json({
      success: false,
      error: 'Invalid message content',
      validationErrors: [suspiciousReason]
    });
  }

  try {
    const parsedCommand = await parseUserCommand(message);
    
    // Log for monitoring and improvement – truncate user input to avoid log pollution
    logger.info('Command parsed', {
      inputPreview: message.slice(0, 200),
      timestamp: new Date().toISOString(),
    });

    return res.status(200).json(parsedCommand);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';

    logger.error('Error parsing command', { error: errorMessage, ip });

    const isGroqError =
      errorMessage.toLowerCase().includes('groq') ||
      errorMessage.toLowerCase().includes('api');

    return res.status(isGroqError ? 503 : 500).json({
      success: false,
      error: isGroqError ? 'Service temporarily unavailable' : 'Failed to parse command',
      validationErrors: ['Your request could not be processed safely. Please try again.'],
    });
  }
}