export type CommandIntent =
  | 'swap'
  | 'checkout'
  | 'portfolio'
  | 'yield_scout'
  | 'yield_deposit'
  | 'yield_migrate'
  | 'dca'
  | 'limit_order'
  | 'swap_and_stake'
  | 'unknown';

export type CommandAmountType =
  | 'exact'
  | 'absolute'
  | 'percentage'
  | 'all'
  | 'exclude'
  | null;

export type CommandFrequency = 'daily' | 'weekly' | 'monthly' | string | null;

export interface PortfolioAllocation {
  toAsset: string;
  toChain: string;
  percentage: number;
}

export interface CommandCondition {
  type: 'price_above' | 'price_below';
  asset: string;
  value: number;
}

export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ConversationState {
  parsedCommand: ParsedCommand;
  messages?: ConversationMessage[];
}

export interface ParsedCommand {
  success: boolean;
  intent: CommandIntent;
  fromAsset: string | null;
  fromChain: string | null;
  toAsset: string | null;
  toChain: string | null;
  amount: number | null;
  amountType?: CommandAmountType;
  excludeAmount?: number;
  excludeToken?: string;
  quoteAmount?: number;
  conditions?: CommandCondition;
  portfolio?: PortfolioAllocation[];
  driftThreshold?: number;
  autoRebalance?: boolean;
  portfolioName?: string;
  frequency?: CommandFrequency;
  dayOfWeek?: number | string | null;
  dayOfMonth?: number | string | null;
  totalAmount?: number;
  numPurchases?: number;
  settleAsset: string | null;
  settleNetwork: string | null;
  settleAmount: number | null;
  settleAddress: string | null;
  fromProject?: string | null;
  fromYield?: number | null;
  toProject?: string | null;
  toYield?: number | null;
  conditionOperator?: 'gt' | 'lt';
  conditionValue?: number;
  conditionAsset?: string;
  targetPrice?: number;
  condition?: 'above' | 'below';
  confidence: number;
  validationErrors: string[];
  parsedMessage: string;
  requiresConfirmation?: boolean;
  originalInput?: string;
}

export interface ParseFailureResult {
  success: false;
  validationErrors: string[];
  intent?: CommandIntent;
  confidence?: number;
  parsedMessage?: string;
  requiresConfirmation?: boolean;
  originalInput?: string;
}
