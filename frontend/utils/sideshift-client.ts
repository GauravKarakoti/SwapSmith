import axios from 'axios';

const SIDESHIFT_BASE_URL = "https://sideshift.ai/api/v2";
const AFFILIATE_ID = process.env.NEXT_PUBLIC_AFFILIATE_ID;
const API_KEY = process.env.NEXT_PUBLIC_SIDESHIFT_API_KEY;

export interface SideShiftQuote {
  id?: string; 
  depositCoin: string;
  depositNetwork: string;
  settleCoin: string;
  settleNetwork: string;
  depositAmount: string;
  settleAmount: string;
  rate: string;
  affiliateId: string;
  error?: { code: string; message: string; };
  memo?: string;
  expiry?: string; 
}

export interface SideShiftCheckoutResponse {
  id: string;
  url: string;
  settleAmount: string;
  settleCoin: string;
}

export async function createQuote(
  fromAsset: string, 
  fromNetwork: string, 
  toAsset: string, 
  toNetwork: string, 
  amount: number,
  userIP: string
): Promise<SideShiftQuote> {
  try {
    const response = await axios.post(
      `${SIDESHIFT_BASE_URL}/quotes`,
      {
        depositCoin: fromAsset,
        depositNetwork: fromNetwork,
        settleCoin: toAsset,
        settleNetwork: toNetwork,
        depositAmount: amount.toString(),
        affiliateId: AFFILIATE_ID,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-sideshift-secret': API_KEY,
          'x-user-ip': userIP
        }
      }
    );
    return { ...response.data, id: response.data.id };
  } catch (error: unknown) {
    const err = error as any;
    throw new Error(err.response?.data?.error?.message || 'Failed to create quote');
  }
}

export async function createCheckout(
  settleCoin: string,
  settleNetwork: string,
  settleAmount: number,
  settleAddress: string,
  userIP: string
): Promise<SideShiftCheckoutResponse> {
  try {
    const response = await axios.post(
      `${SIDESHIFT_BASE_URL}/checkout`,
      {
        settleCoin,
        settleNetwork,
        settleAmount: settleAmount.toString(),
        affiliateId: AFFILIATE_ID,
        settleAddress: settleAddress,
        successUrl: 'https://sideshift.ai/success', // Added required field
        cancelUrl: 'https://sideshift.ai/cancel',   // Added required field
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-sideshift-secret': API_KEY,
          'x-user-ip': userIP,
        },
      }
    );
    
    return {
        id: response.data.id,
        url: `https://pay.sideshift.ai/checkout/${response.data.id}`,
        settleAmount: response.data.settleAmount,
        settleCoin: response.data.settleCoin
    };
  } catch (error: unknown) {
    const err = error as any;
    throw new Error(err.response?.data?.error?.message || 'Failed to create checkout');
  }
}