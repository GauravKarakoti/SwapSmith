/**
 * Type definitions for parsed commands from natural language input
 */

/**
 * Amount type specification
 */
export type AmountType = 'exact' | 'absolute' | 'percentage' | 'all' | null;

/**
 * Supported command intents
 */
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
  | 'stake'
  | 'unknown';

/**
 * Frequency type for recurring orders
 */
export type Frequency = 'daily' | 'weekly' | 'monthly' | string | null;

/**
 * Day of week for DCA orders
 */
export type DayOfWeek = 
  | 'monday' 
  | 'tuesday' 
  | 'wednesday' 
  | 'thursday' 
  | 'friday' 
  | 'saturday' 
  | 'sunday' 
  | string 
  | null;

/**
 * Staking protocol identifier
 */
export type StakingProtocol = 
  | 'aave' 
  | 'compound' 
  | 'yearn' 
  | 'lido' 
  | 'morpho' 
  | 'spark' 
  | 'euler' 
  | 'rocket_pool' 
  | string 
  | null;

/**
 * Comparison operators for conditions
 */
export type ComparisonOperator = 'gt' | 'lt' | 'gte' | 'lte' | 'eq';

/**
 * Condition type for triggering orders
 */
export type ConditionType = 
  | 'price_above' 
  | 'price_below' 
  | 'balance_threshold' 
  | 'time_based' 
  | 'market_condition';

/**
 * Logical operator for combining conditions
 */
export type LogicalOperator = 'AND' | 'OR';

/**
 * Timeframe for market conditions
 */
export type Timeframe = '1m' | '5m' | '1h' | '1d';

/**
 * Price condition direction
 */
export type ConditionDirection = 'above' | 'below';

/**
 * Secondary condition in a complex trading rule
 */
export interface SecondaryCondition {
  type: string;
  asset: string;
  value: number;
  operator: ComparisonOperator;
  logic: LogicalOperator;
  timeframe?: Timeframe;
}

/**
 * Fallback action for conditional orders
 */
export interface FallbackAction {
  intent: CommandIntent;
  fromAsset?: string;
  toAsset?: string;
  amount?: number;
  amountType?: AmountType;
  conditions?: Condition;
  rawText?: string;
  needsParsing?: boolean;
}

/**
 * Primary condition for triggering an order
 */
export interface Condition {
  type: ConditionType;
  asset: string;
  value: number;
  operator?: ComparisonOperator;
  timeframe?: Timeframe;
  secondary_conditions?: SecondaryCondition[];
  fallback_action?: FallbackAction;
}

/**
 * Portfolio allocation configuration
 */
export interface PortfolioAllocation {
  toAsset: string;
  toChain: string;
  percentage: number;
  priority?: number;
}

/**
 * Next action in a multi-step command
 */
export interface NextAction {
  rawText: string;
  needsParsing: boolean;
  intent?: CommandIntent;
  fromAsset?: string;
  toAsset?: string;
  amount?: number;
  amountType?: AmountType;
}

/**
 * Complete parsed command with all supported fields
 */
export interface ParsedCommand {
  // Core command info
  success: boolean;
  intent: CommandIntent;
  confidence: number;
  
  // Single swap fields
  fromAsset: string | null;
  fromChain: string | null;
  toAsset: string | null;
  toChain: string | null;
  amount: number | null;
  amountType?: AmountType;
  
  // Exclude fields (for "all except X" operations)
  excludeAmount?: number;
  excludeToken?: string;
  quoteAmount?: number;
  
  // Conditional trading
  conditions?: Condition;
  conditionOperator?: ComparisonOperator;
  conditionValue?: number;
  conditionAsset?: string;
  targetPrice?: number;
  condition?: ConditionDirection;
  
  // Portfolio fields
  portfolio?: PortfolioAllocation[];
  driftThreshold?: number;
  autoRebalance?: boolean;
  portfolioName?: string;
  
  // DCA fields
  frequency?: Frequency;
  dayOfWeek?: DayOfWeek;
  dayOfMonth?: string | null;
  totalAmount?: number;
  numPurchases?: number;
  
  // Checkout/payment fields
  settleAsset: string | null;
  settleNetwork: string | null;
  settleAmount: number | null;
  settleAddress: string | null;
  
  // Yield/staking fields
  fromProject: string | null;
  fromYield: number | null;
  toProject: string | null;
  toYield: number | null;
  estimatedApy?: number | null;
  stakeProtocol?: StakingProtocol;
  stakePool?: string | null;
  
  // Multi-step and advanced
  nextActions?: NextAction[];
  fallbackAction?: FallbackAction;
  alternativeInterpretations?: string[];
  suggestedClarifications?: string[];
  
  // Validation and metadata
  validationErrors: string[];
  parsedMessage: string;
  requiresConfirmation?: boolean;
  originalInput?: string;
}

/**
 * Partial ParsedCommand for building results
 */
export type PartialParsedCommand = Partial<ParsedCommand>;

/**
 * Parse result can be a successful ParsedCommand or a detailed error response
 */
export type ParseResult = 
  | ParsedCommand 
  | {
      success: false;
      validationErrors: string[];
      intent?: CommandIntent;
      confidence?: number;
      parsedMessage?: string;
      requiresConfirmation?: boolean;
      originalInput?: string;
      [key: string]: unknown;
    };
