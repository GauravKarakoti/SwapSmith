import { NextApiRequest, NextApiResponse } from 'next';
import { createQuote } from '@/utils/sideshift-client';

const SIDESHIFT_CLIENT_IP = process.env.SIDESHIFT_CLIENT_IP || "127.0.0.1";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { fromAsset, toAsset, amount, fromChain, toChain } = req.body;

  if (!fromAsset || !toAsset || !amount) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    // Use more robust logic to get the user's IP address.
    const forwarded = req.headers['x-forwarded-for'];
    let userIP = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress;

    // Server-side log to verify the initial IP being detected
    console.log(`Initial detected user IP: ${userIP}`);

    // ✅ SOLUTION: Handle localhost IP (::1) during development, as some APIs reject it.
    if (userIP === '::1' || userIP === '127.0.0.1') {
      console.log('Detected localhost IP, providing a public fallback for development.');
      // This is a common practice for local testing against APIs that require a real IP.
      userIP = SIDESHIFT_CLIENT_IP; 
    }

    if (!userIP) {
        // Fallback in case no IP can be determined, though this is rare.
        console.warn("Could not determine user IP address.");
        return res.status(400).json({ error: 'Could not determine user IP address.' });
    }

    console.log(`Forwarding request for user IP: ${userIP}`);
    
    const quote = await createQuote(
      fromAsset, 
      fromChain, 
      toAsset, 
      toChain, 
      amount,
      userIP // Pass the validated IP
    );
    
    res.status(200).json(quote);
  } catch (error: unknown) {
    // ✅ FIX: Changed `error: any` to a safer type guard.
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('API Route Error - Error creating quote:', errorMessage);
    // Send a clear error message back to the frontend
    res.status(500).json({ error: errorMessage });
  }
}