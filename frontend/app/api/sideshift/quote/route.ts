import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { SIDESHIFT_CONFIG, getApiUrl } from '../../../../../shared/config/sideshift';
import { rateLimitMiddleware, RATE_LIMITS } from '@/lib/rate-limiter';

const API_KEY = process.env.SIDESHIFT_API_KEY; // Server-side only, no NEXT_PUBLIC_
const AFFILIATE_ID = process.env.AFFILIATE_ID;
const FALLBACK_IP = process.env.SIDESHIFT_CLIENT_IP || '127.0.0.1';

/**
 * POST /api/sideshift/quote
 * Server-side proxy for creating SideShift quotes
 * Keeps API key secure on the server
 */
export async function POST(req: NextRequest) {
  // SECURITY: Rate limit to prevent DoS and API quota exhaustion
  const rateLimitResponse = rateLimitMiddleware(req, {
    ...RATE_LIMITS.swap,
    message: 'Too many quote requests. Please try again later.'
  });
  
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const body = await req.json();
    const { depositCoin, depositNetwork, settleCoin, settleNetwork, depositAmount } = body;

    // Validate required fields
    if (!depositCoin || !depositNetwork || !settleCoin || !settleNetwork || !depositAmount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Safely extract the primary user IP from headers
    const forwardedFor = req.headers.get('x-forwarded-for');
    const userIP = forwardedFor?.split(',')[0]?.trim() || 
                   req.headers.get('x-real-ip') || 
                   FALLBACK_IP;

    // Make request to SideShift API with server-side API key
    const response = await axios.post(
      getApiUrl('quotes'),
      {
        depositCoin,
        depositNetwork,
        settleCoin,
        settleNetwork,
        depositAmount: depositAmount.toString(),
        affiliateId: AFFILIATE_ID,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-sideshift-secret': API_KEY,
          'x-user-ip': userIP,
        },
      }
    );

    return NextResponse.json(response.data);
  } catch (error: unknown) {
    const err = error as { response?: { data?: { error?: { message?: string } }; status?: number }; message?: string };
    console.error('[SideShift Quote API Error]', err.response?.data || err.message);
    return NextResponse.json(
      { error: err.response?.data?.error?.message || 'Failed to create quote' },
      { status: err.response?.status || 500 }
    );
  }
}