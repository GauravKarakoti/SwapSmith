import axios from 'axios';
import dotenv from 'dotenv';
import { SIDESHIFT_CONFIG } from '../../../shared/config/sideshift';
dotenv.config();
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
  depositAddress: any;
  id: string;
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

// FIXED: Expanded definition to include fields returned by /shifts/fixed
export interface SideShiftOrder {
  id: string;
  createdAt: string;
  depositCoin: string;
  depositNetwork: string;
  depositAddress: string | {
    address: string;
    memo: string;
  };
  depositAmount: string;
  settleCoin: string;
  settleNetwork: string;
  settleAddress: string;
  settleAmount: string;
  rate: string;
  expiresAt?: string;
  status?: string;
}

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
  url: string;
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
  tokenDetails?: Record<string, TokenDetail>;
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
    if (ip) headers['x-user-ip'] = ip;

    const response = await axios.get<SideShiftCoin[]>(
      `${SIDESHIFT_CONFIG.BASE_URL}/coins`,
      { headers }
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.error?.message || 'Failed to fetch coins');
    }
    throw new Error("Failed to fetch coins");
  }
}

export async function getPairs(userIP?: string): Promise<SideShiftPair[]> {
  try {
    const headers: Record<string, string | undefined> = {
      'x-sideshift-secret': API_KEY,
    };
    const ip = userIP || DEFAULT_USER_IP;
    if (ip) headers['x-user-ip'] = ip;

    const response = await axios.get<SideShiftPair[]>(
      `${SIDESHIFT_CONFIG.BASE_URL}/pairs`,
      { headers }
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
      `${SIDESHIFT_CONFIG.BASE_URL}/quotes`,
      {
        depositCoin: fromAsset,
        depositNetwork: fromNetwork,
        settleCoin: toAsset,
        settleNetwork: toNetwork,
        depositAmount: amount.toString(),
        affiliateId: AFFILIATE_ID,
      },
      { headers }
    );

    if (response.data.error) {
      throw new Error(response.data.error.message);
    }

    return {
      ...response.data,
      id: response.data.id || '' // Ensure ID is present
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
      `${SIDESHIFT_CONFIG.BASE_URL}/shifts/fixed`,
      payload,
      { headers }
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.error?.message || 'Failed to create order');
    }
    throw new Error('Failed to create order');
  }
}

export async function getOrderStatus(orderId: string, userIP?: string): Promise<SideShiftOrderStatus> {
  try {
    const headers: Record<string, string | undefined> = {
      'Accept': 'application/json',
      'x-sideshift-secret': API_KEY,
    };
    const ip = userIP || DEFAULT_USER_IP;
    if (ip) headers['x-user-ip'] = ip;

    const response = await axios.get<SideShiftOrderStatus>(
      `${SIDESHIFT_CONFIG.BASE_URL}/shifts/${orderId}`,
      { headers }
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.error?.message || 'Failed to get order status');
    }
    throw new Error('Failed to get order status');
  }
}

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
    successUrl: SIDESHIFT_CONFIG.SUCCESS_URL,
    cancelUrl: SIDESHIFT_CONFIG.CANCEL_URL,
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
      `${SIDESHIFT_CONFIG.BASE_URL}/checkout`,
      payload,
      { headers }
    );

    if (response.data.error) {
      throw new Error(response.data.error.message);
    }

    return {
      ...response.data,
      url: response.data.url || `${SIDESHIFT_CONFIG.CHECKOUT_URL}/${response.data.id}`
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.error?.message || 'Failed to create checkout');
    }
    throw new Error('Failed to create checkout');
  }
}