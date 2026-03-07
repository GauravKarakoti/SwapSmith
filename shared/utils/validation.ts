import { z } from 'zod';

/**
 * Input Validation Schemas for SwapSmith
 * Prevents ReDoS, API injection, malformed state corruption, and other security vulnerabilities
 */

// ============================================
// CONSTANTS & CONFIGURATION
// ============================================

export const VALIDATION_LIMITS = {
  USERNAME_MAX: 50,
  USERNAME_MIN: 3,
  EMAIL_MAX: 254,
  PASSWORD_MIN: 8,
  PASSWORD_MAX: 128,
  INPUT_MAX: 1000,
  COMMAND_MAX: 500,
  CONVERSATION_MAX: 50000,
  HISTORY_SIZE_MAX: 100,
  TOKEN_MAX: 8000,
  ARRAY_MAX: 100,
  AMOUNT_MAX: 999999999999,
  AMOUNT_MIN: 0.00000001,
  REGEX_TIMEOUT_MS: 100,
} as const;

// Safe regex patterns (compiled for efficiency)
const SAFE_EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const SAFE_WALLET_REGEX = /^0x[a-fA-F0-9]{40}$/;
const SAFE_TOKEN_SYMBOL_REGEX = /^[A-Z0-9]{1,20}$/;
const SAFE_CHAIN_NAME_REGEX = /^[a-zA-Z0-9\-_]{1,50}$/;

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Sanitizes user input to prevent injection attacks
 * Removes potentially dangerous characters while preserving readability
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>'"]/g, '') // Remove special chars that could cause injection
    .replace(/\x00/g, '')   // Remove null bytes
    .trim()
    .substring(0, VALIDATION_LIMITS.INPUT_MAX);
}

/**
 * Sanitizes LLM prompts to prevent prompt injection
 * Escapes special characters and adds delimiters for clarity
 */
export function sanitizeLLMPrompt(userInput: string): string {
  const sanitized = sanitizeInput(userInput);
  // Add clear delimiters for LLM to understand where user input starts/ends
  return `USER_INPUT_START: "${sanitized}" :END_USER_INPUT`;
}

/**
 * Escapes regex special characters to prevent ReDoS
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validates email addresses using RFC 5322 compliant regex
 */
export function validateEmail(email: string): boolean {
  if (!email || email.length > VALIDATION_LIMITS.EMAIL_MAX) return false;
  return SAFE_EMAIL_REGEX.test(email);
}

/**
 * Validates Ethereum-style wallet addresses
 */
export function validateWalletAddress(address: string | null | undefined): boolean {
  if (!address) return false;
  return SAFE_WALLET_REGEX.test(address);
}

/**
 * Validates token symbols with length restrictions
 */
export function validateTokenSymbol(symbol: string): boolean {
  if (!symbol || symbol.length > 20) return false;
  return SAFE_TOKEN_SYMBOL_REGEX.test(symbol);
}

/**
 * Converts user input amount to safe number
 */
export function sanitizeAmount(amount: string | number | null | undefined): number | null {
  if (amount === null || amount === undefined) return null;
  
  const num = typeof amount === 'string' 
    ? parseFloat(amount.replace(/[^\d.]/g, ''))
    : Number(amount);
    
  if (isNaN(num) || num < VALIDATION_LIMITS.AMOUNT_MIN || num > VALIDATION_LIMITS.AMOUNT_MAX) {
    return null;
  }
  
  return num;
}

/**
 * Validates conversation history size
 */
export function validateConversationSize(messages: unknown[]): boolean {
  if (!Array.isArray(messages)) return false;
  return messages.length <= VALIDATION_LIMITS.HISTORY_SIZE_MAX;
}

// ============================================
// ZOD SCHEMAS - BASIC TYPES
// ============================================

export const TokenSymbolSchema = z
  .string()
  .max(20, 'Token symbol too long')
  .regex(SAFE_TOKEN_SYMBOL_REGEX, 'Invalid token symbol format')
  .transform(t => t.toUpperCase());

export const ChainNameSchema = z
  .string()
  .max(50, 'Chain name too long')
  .regex(SAFE_CHAIN_NAME_REGEX, 'Invalid chain name format')
  .transform(c => c.toLowerCase());

export const AmountSchema = z
  .union([z.string(), z.number()])
  .transform(a => sanitizeAmount(a))
  .refine(
    a => a !== null,
    'Invalid amount: must be a valid number between ' + 
    VALIDATION_LIMITS.AMOUNT_MIN + ' and ' + VALIDATION_LIMITS.AMOUNT_MAX
  );

export const WalletAddressSchema = z
  .string()
  .regex(SAFE_WALLET_REGEX, 'Invalid wallet address format')
  .transform(a => a.toLowerCase());

export const EmailSchema = z
  .string()
  .max(VALIDATION_LIMITS.EMAIL_MAX, 'Email too long')
  .refine(validateEmail, 'Invalid email format');

export const UsernameSchema = z
  .string()
  .min(VALIDATION_LIMITS.USERNAME_MIN, 'Username too short')
  .max(VALIDATION_LIMITS.USERNAME_MAX, 'Username too long')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain alphanumeric characters, hyphens, and underscores');

export const PasswordSchema = z
  .string()
  .min(VALIDATION_LIMITS.PASSWORD_MIN, 'Password too short')
  .max(VALIDATION_LIMITS.PASSWORD_MAX, 'Password too long');

// ============================================
// ZOD SCHEMAS - SWAP COMMAND
// ============================================

export const SwapCommandSchema = z.object({
  success: z.boolean().default(true),
  intent: z.enum([
    'swap',
    'checkout',
    'portfolio',
    'yield_scout',
    'yield_deposit',
    'yield_migrate',
    'dca',
    'limit_order',
    'swap_and_stake',
    'unknown'
  ]).default('unknown'),
  
  // Swap fields
  fromAsset: TokenSymbolSchema.nullable().default(null),
  fromChain: ChainNameSchema.nullable().default(null),
  toAsset: TokenSymbolSchema.nullable().default(null),
  toChain: ChainNameSchema.nullable().default(null),
  amount: AmountSchema.nullable().default(null),
  amountType: z.enum(['exact', 'absolute', 'percentage', 'all', 'exclude']).nullable().default(null),
  excludeAmount: z.number().positive().optional(),
  excludeToken: TokenSymbolSchema.optional(),
  quoteAmount: z.number().positive().optional(),
  
  // Conditional fields
  conditions: z.object({
    type: z.enum(['price_above', 'price_below', 'balance_threshold', 'time_based', 'market_condition']),
    asset: TokenSymbolSchema,
    value: z.number().positive(),
    operator: z.enum(['gt', 'lt', 'gte', 'lte', 'eq']).optional(),
    timeframe: z.enum(['1m', '5m', '1h', '1d']).optional(),
    secondary_conditions: z.array(z.object({
      type: z.string(),
      asset: TokenSymbolSchema,
      value: z.number(),
      operator: z.string(),
      logic: z.enum(['AND', 'OR'])
    })).optional(),
    fallback_action: z.object({
      intent: z.string(),
      fromAsset: TokenSymbolSchema,
      toAsset: TokenSymbolSchema,
      amount: z.number(),
    }).optional()
  }).optional(),
  
  // Portfolio fields
  portfolio: z.array(z.object({
    toAsset: TokenSymbolSchema,
    toChain: ChainNameSchema,
    percentage: z.number().min(0).max(100)
  })).optional(),
  driftThreshold: z.number().optional(),
  autoRebalance: z.boolean().optional(),
  portfolioName: z.string().max(100).optional(),
  
  // DCA fields
  frequency: z.enum(['daily', 'weekly', 'monthly']).nullable().optional(),
  dayOfWeek: z.string().max(20).nullable().optional(),
  dayOfMonth: z.string().max(20).nullable().optional(),
  totalAmount: z.number().positive().optional(),
  numPurchases: z.number().positive().int().optional(),
  
  // Checkout fields
  settleAsset: TokenSymbolSchema.nullable().optional(),
  settleNetwork: ChainNameSchema.nullable().optional(),
  settleAmount: AmountSchema.nullable().optional(),
  settleAddress: WalletAddressSchema.optional(),
  
  // Yield fields
  fromProject: z.string().max(100).nullable().optional(),
  fromYield: z.number().optional(),
  toProject: z.string().max(100).nullable().optional(),
  toYield: z.number().optional(),
  
  // Stake fields
  estimatedApy: z.number().optional(),
  stakeProtocol: z.string().max(100).optional(),
  stakePool: z.string().max(100).optional(),
  
  // Legacy conditional fields
  conditionOperator: z.enum(['gt', 'lt']).optional(),
  conditionValue: z.number().optional(),
  conditionAsset: TokenSymbolSchema.optional(),
  targetPrice: z.number().optional(),
  
  // Metadata
  confidence: z.number().min(0).max(100).default(50),
  validationErrors: z.array(z.string()).default([]),
  requiresConfirmation: z.boolean().default(false),
  parsedMessage: z.string().max(VALIDATION_LIMITS.COMMAND_MAX).optional(),
  originalInput: z.string().max(VALIDATION_LIMITS.INPUT_MAX).optional(),
  nextActions: z.array(z.string()).optional(),
  fallbackAction: z.string().optional(),
  alternativeInterpretations: z.array(z.string()).optional(),
  suggestedClarifications: z.array(z.string()).optional(),
});

export type SwapCommand = z.infer<typeof SwapCommandSchema>;

// ============================================
// ZOD SCHEMAS - API RESPONSES
// ============================================

export const SideShiftQuoteResponseSchema = z.object({
  id: z.string().max(100),
  status: z.enum(['open', 'pending', 'received', 'complete', 'error']),
  depositType: z.string().max(20),
  depositNetwork: z.string().max(50),
  depositAddress: z.string().max(200),
  depositAmount: z.string().regex(/^\d+(\.\d+)?$/), // Allow only decimal numbers
  depositCoin: TokenSymbolSchema,
  settleType: z.string().max(20),
  settleNetwork: z.string().max(50),
  settleAddress: z.string().max(200),
  settleAmount: z.string().regex(/^\d+(\.\d+)?$/).nullable(),
  settleCoin: TokenSymbolSchema,
  rate: z.string().regex(/^\d+(\.\d+)?$/).nullable(),
  expiry: z.number().int().positive().optional(),
  expiryDate: z.string().datetime().optional(),
  memo: z.string().max(1000).optional(),
  error: z.string().max(500).optional(),
});

export type SideShiftQuoteResponse = z.infer<typeof SideShiftQuoteResponseSchema>;

export const YieldProjectResponseSchema = z.object({
  id: z.string().max(100),
  name: z.string().max(200),
  description: z.string().max(5000).optional(),
  apy: z.number().min(0).max(100000), // Some yields can be very high
  tvl: z.number().positive().optional(),
  risk: z.enum(['low', 'medium', 'high']).optional(),
  project: z.string().max(100).optional(),
  pool: z.string().max(100).optional(),
  chain: ChainNameSchema.optional(),
  token: TokenSymbolSchema.optional(),
});

export type YieldProjectResponse = z.infer<typeof YieldProjectResponseSchema>;

export const UserPreferencesSchema = z.object({
  slippageTolerance: z.number().min(0).max(100).default(0.5),
  gasPreference: z.enum(['low', 'standard', 'high']).default('standard'),
  autoExecute: z.boolean().default(false),
  notificationsEnabled: z.boolean().default(true),
  preferredChains: z.array(ChainNameSchema).default([]),
  favoriteTokens: z.array(TokenSymbolSchema).default([]),
  defaultNetwork: ChainNameSchema.optional(),
  riskTolerance: z.enum(['conservative', 'moderate', 'aggressive']).default('moderate'),
  language: z.string().length(2).default('en'),
});

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

// ============================================
// ZOD SCHEMAS - USER AUTHENTICATION
// ============================================

export const RegisterRequestSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  username: UsernameSchema,
  walletAddress: WalletAddressSchema.optional(),
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

// ============================================
// ZOD SCHEMAS - MESSAGE & CONVERSATION
// ============================================

export const MessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']).default('user'),
  content: z.string()
    .max(VALIDATION_LIMITS.COMMAND_MAX, 'Message too long')
    .refine(c => c.trim().length > 0, 'Message cannot be empty'),
  timestamp: z.date().default(() => new Date()),
  type: z.enum(['message', 'intent_confirmation', 'swap_confirmation', 'yield_info', 'checkout_link', 'portfolio_summary']).optional(),
  data: z.record(z.unknown()).optional(),
});

export type Message = z.infer<typeof MessageSchema>;

export const ConversationHistorySchema = z.array(MessageSchema)
  .max(VALIDATION_LIMITS.HISTORY_SIZE_MAX, 'Conversation history too large')
  .refine(msgs => msgs.length > 0, 'Conversation history cannot be empty');

export type ConversationHistory = z.infer<typeof ConversationHistorySchema>;

// ============================================
// ZOD SCHEMAS - REQUESTS & RESPONSES
// ============================================

export const ParseCommandRequestSchema = z.object({
  userInput: z.string()
    .max(VALIDATION_LIMITS.COMMAND_MAX, 'Input too long')
    .refine(s => s.trim().length > 0, 'Input cannot be empty'),
  messageHistory: ConversationHistorySchema.optional(),
  userId: z.string().max(100).optional(),
});

export type ParseCommandRequest = z.infer<typeof ParseCommandRequestSchema>;

export const SaveChatHistorySchema = z.object({
  userId: z.string().max(100),
  walletAddress: WalletAddressSchema.optional(),
  role: z.enum(['user', 'assistant']),
  content: z.string().max(VALIDATION_LIMITS.COMMAND_MAX),
  sessionId: z.string().max(100),
  metadata: z.object({
    type: z.string().optional(),
    data: z.record(z.unknown()).optional(),
    timestamp: z.date().optional(),
  }).optional(),
});

export type SaveChatHistory = z.infer<typeof SaveChatHistorySchema>;

// ============================================
// SAFE PARSING HELPER
// ============================================

/**
 * Safe parser that returns validation errors instead of throwing
 */
export function safeParse<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors = result.error.errors
    .map(err => {
      const path = err.path.join('.');
      return `${path || 'root'}: ${err.message}`;
    });
    
  return { success: false, errors };
}

/**
 * Validates and sanitizes LLM input
 * Used before sending user input to language models
 */
export function validateAndSanitizeLLMInput(input: string): { valid: boolean; sanitized: string; errors: string[] } {
  const errors: string[] = [];
  
  if (!input || input.length === 0) {
    errors.push('Input cannot be empty');
    return { valid: false, sanitized: '', errors };
  }
  
  if (input.length > VALIDATION_LIMITS.INPUT_MAX) {
    errors.push(`Input exceeds maximum length of ${VALIDATION_LIMITS.INPUT_MAX}`);
  }
  
  const sanitized = sanitizeLLMPrompt(input);
  
  return {
    valid: errors.length === 0,
    sanitized,
    errors
  };
}

/**
 * Validates response from API before processing
 * Prevents state corruption from malformed data
 */
export function validateAPIResponse<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  apiName: string
): { valid: boolean; data: T | null; errors: string[] } {
  const result = safeParse(schema, data);
  
  if (!result.success) {
    const errors = result.errors.map(e => `${apiName} - ${e}`);
    return { valid: false, data: null, errors };
  }
  
  return { valid: true, data: result.data, errors: [] };
}
