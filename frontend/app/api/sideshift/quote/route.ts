import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { SIDESHIFT_CONFIG } from '../../../../../shared/config/sideshift';

const API_KEY = process.env.SIDESHIFT_API_KEY; // Server-side only, no NEXT_PUBLIC_
const AFFILIATE_ID = process.env.AFFILIATE_ID;

/**
 * POST /api/sideshift/quote
 * Server-side proxy for creating SideShift quotes
 * Keeps API key secure on the server
 */
export async function POST(req: NextRequest) {
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

    // Get user IP from headers
    const userIP = req.headers.get('x-forwarded-for') || 
                   req.headers.get('x-real-ip') || 
                   '127.0.0.1';

    // Make request to SideShift API with server-side API key
    const response = await axios.post(
      `${SIDESHIFT_CONFIG.BASE_URL}/quotes`,
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
  } catch (error: any) {
    console.error('[SideShift Quote API Error]', error.response?.data || error.message);
    return NextResponse.json(
      { error: error.response?.data?.error?.message || 'Failed to create quote' },
      { status: error.response?.status || 500 }
    );
  }
}
