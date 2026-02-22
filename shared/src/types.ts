// From groq-client.ts
export interface ParsedCommand {
  success: boolean;
  intent: "swap" | "checkout" | "portfolio" | "yield_scout" | "yield_deposit" | "yield_migrate" | "dca" | "unknown";

  // Single Swap Fields
  fromAsset: string | null;
  fromChain: string | null;
  toAsset: string | null;
  toChain: string | null;
  amount: number | null;
  amountType?: "exact" | "absolute" | "percentage" | "all" | "exclude" | null;

  excludeAmount?: number;
  excludeToken?: string;
  quoteAmount?: number;

  // Conditional Fields
  conditions?: {
    type: "price_above" | "price_below";
    asset: string;
    value: number;
  };

  // Portfolio Fields (Array of outputs)
  portfolio?: {
    toAsset: string;
    toChain: string;
    percentage: number;
  }[];

  // DCA Fields
  frequency?: "daily" | "weekly" | "monthly" | null;
  dayOfWeek?: string | null;
  dayOfMonth?: string | null;

  // Checkout Fields
  settleAsset: string | null;
  settleNetwork: string | null;
  settleAmount: number | null;
  settleAddress: string | null;

  fromProject: string | null;
  fromYield: number | null;
  toProject: string | null;
  toYield: number | null;

  // Limit Order Fields
  conditionOperator?: 'gt' | 'lt';
  conditionValue?: number;
  conditionAsset?: string;

  confidence: number;
  validationErrors: string[];
  parsedMessage: string;
  requiresConfirmation?: boolean;
  originalInput?: string;
}

// From sideshift-client.ts
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
    depositAddress: string | {
        address: string;
        memo: string;
    };
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
