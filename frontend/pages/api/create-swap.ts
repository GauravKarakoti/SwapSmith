import type { NextApiRequest, NextApiResponse } from 'next';
import { createQuote } from '@/utils/sideshift-client';
import { csrfGuard } from '@/lib/csrf';
import logger from '@/lib/logger';

const SIDESHIFT_CLIENT_IP = process.env.SIDESHIFT_CLIENT_IP || '127.0.0.1';

type CreateSwapBody = {
  fromAsset?: unknown;
  toAsset?: unknown;
  amount?: unknown;
  fromChain?: unknown;
  toChain?: unknown;
};

const ASSET_REGEX = /^[A-Za-z0-9]{2,10}$/;
const CHAIN_REGEX = /^[A-Za-z0-9_-]{2,20}$/;

function validateCreateSwapBody(body: CreateSwapBody) {
  const errors: string[] = [];

  const fromAsset = typeof body.fromAsset === 'string' ? body.fromAsset.trim() : '';
  const toAsset = typeof body.toAsset === 'string' ? body.toAsset.trim() : '';
  const fromChain = typeof body.fromChain === 'string' ? body.fromChain.trim() : '';
  const toChain = typeof body.toChain === 'string' ? body.toChain.trim() : '';

  const amountRaw = body.amount;
  const amountNum =
    typeof amountRaw === 'number'
      ? amountRaw
      : typeof amountRaw === 'string'
        ? Number(amountRaw)
        : NaN;

  if (!fromAsset || !ASSET_REGEX.test(fromAsset)) {
    errors.push('fromAsset must be 2-10 alphanumeric characters.');
  }
  if (!toAsset || !ASSET_REGEX.test(toAsset)) {
    errors.push('toAsset must be 2-10 alphanumeric characters.');
  }

  if (fromChain && !CHAIN_REGEX.test(fromChain)) {
    errors.push('fromChain has an invalid format.');
  }
  if (toChain && !CHAIN_REGEX.test(toChain)) {
    errors.push('toChain has an invalid format.');
  }

  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    errors.push('amount must be a positive number.');
  } else if (amountNum > 1_000_000_000) {
    errors.push('amount is too large.');
  }

  return {
    valid: errors.length === 0,
    errors,
    value: {
      fromAsset,
      toAsset,
      fromChain,
      toChain,
      amount: amountNum,
    },
  };
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!csrfGuard(req, res)) {
    return;
  }

  const validation = validateCreateSwapBody(req.body as CreateSwapBody);
  if (!validation.valid) {
    return res.status(400).json({
      error: 'Invalid parameters',
      validationErrors: validation.errors,
    });
  }

  const { fromAsset, toAsset, fromChain, toChain, amount } = validation.value;

  try {
    const forwarded = req.headers['x-forwarded-for'];
    let userIP =
      typeof forwarded === 'string'
        ? forwarded.split(',')[0]?.trim()
        : req.socket.remoteAddress || undefined;

    logger.info('Initial detected user IP for create-swap', { userIP });

    if (userIP === '::1' || userIP === '127.0.0.1') {
      logger.info('Detected localhost IP, providing a public fallback for development.');
      userIP = SIDESHIFT_CLIENT_IP;
    }

    if (!userIP) {
      logger.warn('Could not determine user IP address for create-swap.');
      return res.status(400).json({ error: 'Could not determine user IP address.' });
    }

    logger.info('Forwarding create-swap request to SideShift', {
      userIP,
      fromAsset,
      toAsset,
      fromChain,
      toChain,
    });

    const quote = await createQuote(
      fromAsset,
      fromChain || 'ethereum',
      toAsset,
      toChain || 'ethereum',
      amount,
      userIP,
    );

    return res.status(200).json(quote);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    logger.error('API Route Error - Error creating quote', { error: errorMessage });

    return res.status(502).json({
      error: 'Failed to create quote. Please try again later.',
    });
  }
}
