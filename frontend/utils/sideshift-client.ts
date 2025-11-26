import axios from 'axios';

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

export interface SideShiftQuote {
  id?: string; // Add quote ID for tracking
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
  expiry?: string; // Add expiry if available
}

export async function getPairs(): Promise<SideShiftPair[]> {
  try {
    const response = await axios.get<SideShiftPair[]>(
      `${SIDESHIFT_BASE_URL}/pairs`,
      {
        headers: { 
          'x-sideshift-secret': API_KEY,
          'x-user-ip': '0.0.0.0' // Will be set dynamically from API route
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

export async function createQuote(
  fromAsset: string, 
  fromNetwork: string, 
  toAsset: string, 
  toNetwork: string, 
  amount: number,
  userIP: string
): Promise<SideShiftQuote> {
  try {
    const response = await axios.post<SideShiftQuote & { id?: string }>(
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

    if (response.data.error) {
      throw new Error(response.data.error.message);
    }

    // Include the quote ID in the response
    return {
      ...response.data,
      id: response.data.id // This will be used for tracking
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.error?.message || `Failed to create quote for ${fromAsset} to ${toAsset}`);
    }
    throw new Error(`Failed to create quote for ${fromAsset} to ${toAsset}`);
  }
}