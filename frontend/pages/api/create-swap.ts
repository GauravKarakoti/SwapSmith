import { NextApiRequest, NextApiResponse } from 'next';
import { createQuote } from '@/utils/sideshift-client';
import { withEnhancedCSRF } from '@/lib/enhanced-csrf';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import logger from '@/lib/logger';

const SIDESHIFT_CLIENT_IP = process.env.SIDESHIFT_CLIENT_IP || "127.0.0.1";

async function createSwapHandler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { fromAsset, toAsset, amount, fromChain, toChain } = req.body;

  // Input validation
  if (!fromAsset || !toAsset || !amount) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  // Validate amount is a positive number
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  // Validate asset names (basic sanitization)
  const assetRegex = /^[A-Z0-9]{2,10}$/;
  if (!assetRegex.test(fromAsset) || !assetRegex.test(toAsset)) {
    return res.status(400).json({ error: 'Invalid asset format' });
  }

  try {
    // Use more robust logic to get the user's IP address.
    const forwarded = req.headers['x-forwarded-for'];
    let userIP = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress;

    // Server-side log to verify the initial IP being detected
    logger.info(`Initial detected user IP: ${userIP}`);

    // ✅ SOLUTION: Handle localhost IP (::1) during development, as some APIs reject it.
    if (userIP === '::1' || userIP === '127.0.0.1') {
      logger.info('Detected localhost IP, providing a public fallback for development.');
      // This is a common practice for local testing against APIs that require a real IP.
      userIP = SIDESHIFT_CLIENT_IP; 
    }

    if (!userIP) {
        // Fallback in case no IP can be determined, though this is rare.
        logger.warn("Could not determine user IP address.");
        return res.status(400).json({ error: 'Could not determine user IP address.' });
    }

    logger.info(`Forwarding request for user IP: ${userIP}`);
    
    const quote = await createQuote(
      fromAsset, 
      fromChain, 
      toAsset, 
      toChain, 
      amount,
      userIP // Pass the validated IP
    );
    
    // Add security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    
    res.status(200).json(quote);
  } catch (error: unknown) {
    // ✅ FIX: Changed `error: any` to a safer type guard.
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    logger.error('API Route Error - Error creating quote:', { error: errorMessage });
    // Send a clear error message back to the frontend
    res.status(500).json({ error: errorMessage });
  }
}

const csrfProtectedHandler = withEnhancedCSRF(createSwapHandler);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1. Check rate limit first
  const isRateLimited = withRateLimit(req, res, {
    ...RATE_LIMITS.swap,
    message: 'Too many swap requests. Please wait before trying again.'
  });

  if (isRateLimited) {
    return;
  }
  
  // 2. Proceed to CSRF and main handler
  return csrfProtectedHandler(req, res);
}