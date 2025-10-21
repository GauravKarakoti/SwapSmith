import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const SIDESHIFT_BASE_URL = "https://sideshift.ai/api/v2";
const AFFILIATE_ID = process.env.NEXT_PUBLIC_AFFILIATE_ID;
const API_KEY = process.env.NEXT_PUBLIC_SIDESHIFT_API_KEY;

export interface SideShiftPair {
  depositCoin: string;
  settleCoin: string;
  depositNetwork: string;
  settleNetwork: string;
  min: string;
  max: string;
  rate: string;
  hasMemo: boolean;
}

// Interface for the new /checkout request
export interface SideShiftCheckout {
  settleCoin: string;
  settleNetwork: string;
  settleAmount: string;
  settleAddress: string;
  affiliateId: string;
  successUrl: string;
  cancelUrl: string;
  settleMemo?: string;
}

// Interface for the new /checkout response
export interface SideShiftCheckoutResponse {
  id: string;
  settleCoin: string;
  settleNetwork: string;
  settleAddress: string;
  settleAmount: string;
  affiliateId: string;
  successUrl: string;
  cancelUrl: string;
  createdAt: string;
  updatedAt: string;
  error?: { code: string; message: string; };
}


export async function getPairs(): Promise<SideShiftPair[]> {
  try {
    const response = await axios.get<SideShiftPair[]>(
      `${SIDESHIFT_BASE_URL}/pairs`,
      {
        headers: { 
          'x-sideshift-secret': API_KEY,
          'x-user-ip': '0.0.0.0'
        },
      }
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.error?.message || 'Failed to fetch trading pairs');
    }
    throw new Error("Failed to fetch trading pairs");
  }
}

/**
 * Creates a new SideShift Pay checkout
 * https://pay.sideshift.ai/
 */
export async function createCheckout(
  settleCoin: string,
  settleNetwork: string,
  settleAmount: string,
  settleAddress: string,
  userIp: string, // The end-user's IP
  settleMemo?: string
): Promise<SideShiftCheckoutResponse> {
  try {
    // For the bot, we can use placeholder URLs.
    // In a real web-app, these would be your success/cancel pages.
    const botUrl = "https://t.me/SwapSmithBot"; // Placeholder

    const response = await axios.post<SideShiftCheckoutResponse>(
      `${SIDESHIFT_BASE_URL}/checkout`,
      {
        settleCoin,
        settleNetwork,
        settleAmount,
        settleAddress,
        settleMemo,
        affiliateId: AFFILIATE_ID,
        successUrl: `${botUrl}?status=success&id=${Date.now()}`,
        cancelUrl: `${botUrl}?status=cancel`
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-sideshift-secret': API_KEY,
          'x-user-ip': userIp 
        }
      }
    );

    if (response.data.error) {
      throw new Error(response.data.error.message);
    }

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.error?.message || `Failed to create checkout`);
    }
    throw new Error(`Failed to create checkout`);
  }
}