import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { SIDESHIFT_CONFIG, getApiUrl, getCheckoutUrl } from '../../../../../shared/config/sideshift';

const API_KEY = process.env.SIDESHIFT_API_KEY; // Server-side only, no NEXT_PUBLIC_
const AFFILIATE_ID = process.env.AFFILIATE_ID;

/**
 * POST /api/sideshift/checkout
 * Server-side proxy for creating SideShift checkouts
 * Keeps API key secure on the server
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { settleCoin, settleNetwork, settleAmount, settleAddress } = body;

    // Validate required fields
    if (!settleCoin || !settleNetwork || !settleAmount || !settleAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get user IP from headers
    const userIP = req.headers.get('x-forwarded-for') || 
                   req.headers.get('x-real-ip') || 
                   '127.0.0.1';

    // Make request to SideShift API with server-side API key
    const response = await axios.post(
      getApiUrl('checkout'),
      {
        settleCoin,
        settleNetwork,
        settleAmount: settleAmount.toString(),
        affiliateId: AFFILIATE_ID,
        settleAddress,
        successUrl: SIDESHIFT_CONFIG.SUCCESS_URL,
        cancelUrl: SIDESHIFT_CONFIG.CANCEL_URL,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-sideshift-secret': API_KEY,
          'x-user-ip': userIP,
        },
      }
    );

    return NextResponse.json({
      id: response.data.id,
      url: getCheckoutUrl(response.data.id),
      settleAmount: response.data.settleAmount,
      settleCoin: response.data.settleCoin,
    });
  } catch (error: unknown) {
    const err = error as { response?: { data?: { error?: { message?: string } }; status?: number }; message?: string };
    console.error('[SideShift Checkout API Error]', err.response?.data || err.message);
    return NextResponse.json(
      { error: err.response?.data?.error?.message || 'Failed to create checkout' },
      { status: err.response?.status || 500 }
    );
  }
}
