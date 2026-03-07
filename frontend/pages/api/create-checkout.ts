import { NextApiRequest, NextApiResponse } from 'next';
import { createCheckout } from '@/utils/sideshift-client';
import { csrfGuard } from '@/lib/csrf';

/**
 * Extract real user IP from request headers
 * Handles various proxy configurations (Vercel, Cloudflare, etc.)
 */
function extractUserIP(req: NextApiRequest): string | undefined {
  // Try various headers in order of preference
  const headers = [
    'x-real-ip',           // Nginx proxy
    'x-forwarded-for',     // Standard proxy header
    'cf-connecting-ip',    // Cloudflare
    'x-vercel-forwarded-for', // Vercel
  ];

  for (const header of headers) {
    const value = req.headers[header];
    if (value) {
      // x-forwarded-for can be a comma-separated list, take the first one
      const ip = typeof value === 'string' ? value.split(',')[0].trim() : value[0];
      
      // Validate it's not a local/private IP
      if (ip && !isLocalIP(ip)) {
        return ip;
      }
    }
  }

  // Fallback to socket remote address
  const socketIP = req.socket.remoteAddress;
  if (socketIP && !isLocalIP(socketIP)) {
    return socketIP;
  }

  // If all else fails, use environment variable or undefined
  return process.env.SIDESHIFT_CLIENT_IP || undefined;
}

/**
 * Check if IP is local/private
 */
function isLocalIP(ip: string): boolean {
  return (
    ip === '::1' ||
    ip === '127.0.0.1' ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    ip.startsWith('172.16.') ||
    ip.startsWith('::ffff:127.') ||
    ip === 'localhost'
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  
  // CSRF Protection - Critical for financial operations
  if (!csrfGuard(req, res)) {
    return;
  }
  
  const { settleAsset, settleNetwork, settleAmount, settleAddress } = req.body;
  
  if (!settleAddress) {
    return res.status(400).json({ error: 'Settle address is required' });
  }

  try {
    // Extract real user IP for geo-compliance checks
    const userIP = extractUserIP(req);

    // Pass settleAddress and real user IP to the function
    const result = await createCheckout(settleAsset, settleNetwork, settleAmount, settleAddress, userIP);
    res.status(200).json(result);
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
}