import { NextResponse } from 'next/server';
import axios from 'axios';
import { SIDESHIFT_CONFIG } from '../../../../../shared/config/sideshift';

export const dynamic = 'force-dynamic'; // Disable caching if needed, though coins change rarely

/**
 * GET /api/sideshift/coins
 * Server-side proxy for fetching available coins from SideShift
 * Used to avoid exposing client directly to SideShift API
 */
export async function GET() {
  try {
    const response = await axios.get(`${SIDESHIFT_CONFIG.BASE_URL}/coins`);
    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('SideShift Coins API Error:', error.message);
    return NextResponse.json(
      { error: 'Failed to fetch coins from SideShift' },
      { status: 500 }
    );
  }
}
