import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();
const SIDESHIFT_BASE_URL = "https://sideshift.ai/api/v2";
const AFFILIATE_ID = process.env.SIDESHIFT_AFFILIATE_ID || process.env.NEXT_PUBLIC_AFFILIATE_ID || '';
const API_KEY = process.env.SIDESHIFT_API_KEY || process.env.NEXT_PUBLIC_SIDESHIFT_API_KEY;
const DEFAULT_USER_IP = process.env.SIDESHIFT_CLIENT_IP;

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

export interface SideShiftOrder {
    id: string;
    // Update this field to allow string or object
    depositAddress: string | {
        address: string;
        memo: string;
    };
}

// --- NEW: Type for Order Status ---
export interface SideShiftOrderStatus {
  id: string;
  status: string;
  depositCoin: string;
  depositNetwork: string;
  settleCoin: string;
  settleNetwork: string;
  depositAddress: {
    address: string;
    memo: string | null;
  };
  settleAddress: {
    address: string;
    memo: string | null;
  };
  depositAmount: string | null;
  settleAmount: string | null;
  depositHash: string | null;
  settleHash: string | null;
  createdAt: string;
  updatedAt: string;
  error?: { code: string; message: string; };
}
// --- END NEW ---


// --- NEW: Types for SideShift Pay API ---
export interface SideShiftCheckoutRequest {
  settleCoin: string;
  settleNetwork: string;
  settleAmount: string;
  settleAddress: string;
  affiliateId: string;
  successUrl: string;
  cancelUrl: string;
}

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
// --- END NEW ---

// --- NEW: Types and function for Coins API ---
export interface TokenDetail {
  contractAddress: string;
  decimals: number;
}

export interface SideShiftCoin {
  networks: string[];
  coin: string;
  name: string;
  hasMemo: boolean;
  deprecated?: boolean;
  fixedOnly: string[] | boolean;
  variableOnly: string[] | boolean;
  tokenDetails?: Record<string, TokenDetail>; // Object with network as key
  networksWithMemo: string[];
  depositOffline: string[] | boolean;
  settleOffline: string[] | boolean;
}

export async function getCoins(userIP?: string): Promise<SideShiftCoin[]> {
  try {
    const headers: Record<string, string | undefined> = { 
        'x-sideshift-secret': API_KEY,
    };
    const ip = userIP || DEFAULT_USER_IP;
    if(ip) headers['x-user-ip'] = ip;

    const response = await axios.get<SideShiftCoin[]>(
      `${SIDESHIFT_BASE_URL}/coins`,
      {
        headers
      }
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.error?.message || 'Failed to fetch coins');
    }
    throw new Error("Failed to fetch coins");
  }
}
// --- END NEW ---


export async function getPairs(userIP?: string): Promise<SideShiftPair[]> {
  try {
    const headers: Record<string, string | undefined> = { 
        'x-sideshift-secret': API_KEY,
    };
    const ip = userIP || DEFAULT_USER_IP;
    if(ip) headers['x-user-ip'] = ip;

    const response = await axios.get<SideShiftPair[]>(
      `${SIDESHIFT_BASE_URL}/pairs`,
      {
        headers
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
  userIP?: string
): Promise<SideShiftQuote> {
  try {
    const headers: Record<string, string | undefined> = {
        'Content-Type': 'application/json',
        'x-sideshift-secret': API_KEY
    };
    const ip = userIP || DEFAULT_USER_IP;
    if (ip) headers['x-user-ip'] = ip;

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
        headers
      }
    );

    if (response.data.error) {
      throw new Error(response.data.error.message);
    }

    return {
      ...response.data,
      id: response.data.id
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.error?.message || `Failed to create quote for ${fromAsset} to ${toAsset}`);
    }
    throw new Error(`Failed to create quote for ${fromAsset} to ${toAsset}`);
  }
}

export async function createOrder(quoteId: string, settleAddress: string, refundAddress: string, userIP?: string): Promise<SideShiftOrder> {
    try {
        const payload: any = {
            quoteId,
            settleAddress,
            refundAddress,
        };
        
        // Only include affiliateId if it's defined
        if (AFFILIATE_ID) {
            payload.affiliateId = AFFILIATE_ID;
        }

        const headers: Record<string, string | undefined> = {
            'Content-Type': 'application/json',
            'x-sideshift-secret': API_KEY,
        };
        const ip = userIP || DEFAULT_USER_IP;
        if (ip) headers['x-user-ip'] = ip;
        
        const response = await axios.post<SideShiftOrder>(
            `${SIDESHIFT_BASE_URL}/shifts/fixed`,
            payload,
            {
                headers
            }
        );
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            throw new Error(error.response?.data?.error?.message || 'Failed to create order');
        }
        throw new Error('Failed to create order');
    }
}

// --- NEW: Function to get order status ---
export async function getOrderStatus(orderId: string, userIP?: string): Promise<SideShiftOrderStatus> {
    try {
        const headers: Record<string, string | undefined> = {
            'Accept': 'application/json',
            'x-sideshift-secret': API_KEY,
        };
        const ip = userIP || DEFAULT_USER_IP;
        if (ip) headers['x-user-ip'] = ip;

        const response = await axios.get<SideShiftOrderStatus>(
            `${SIDESHIFT_BASE_URL}/shifts/${orderId}`,
            {
                headers
            }
        );
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            throw new Error(error.response?.data?.error?.message || 'Failed to get order status');
        }
        throw new Error('Failed to get order status');
    }
}
// --- END NEW ---

// --- NEW: Function for SideShift Pay API ---
export async function createCheckout(
  settleCoin: string,
  settleNetwork: string,
  settleAmount: number,
  settleAddress: string,
  userIP?: string
): Promise<SideShiftCheckoutResponse> {
  const payload: Partial<SideShiftCheckoutRequest> = {
    settleCoin,
    settleNetwork,
    settleAmount: settleAmount.toString(),
    settleAddress,
    affiliateId: AFFILIATE_ID || '',
    // Using placeholder URLs as this is a bot and we just need the link
    successUrl: 'https://sideshift.ai/success',
    cancelUrl: 'https://sideshift.ai/cancel',
  };

  try {
    const headers: Record<string, string | undefined> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-sideshift-secret': API_KEY,
    };
    const ip = userIP || DEFAULT_USER_IP;
    if (ip) headers['x-user-ip'] = ip;

    const response = await axios.post<SideShiftCheckoutResponse>(
      `${SIDESHIFT_BASE_URL}/checkout`,
      payload,
      {
        headers,
      }
    );

    if (response.data.error) {
      throw new Error(response.data.error.message);
    }

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.error?.message || 'Failed to create checkout');
    }
    throw new Error('Failed to create checkout');
  }
}
// --- END NEW ---