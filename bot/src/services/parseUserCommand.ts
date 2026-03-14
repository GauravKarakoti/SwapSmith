import { parseWithLLM } from './groq-client';
import type {
  ParsedCommand,
  ParseResult as ParseResultType
} from '../types/ParsedCommand';
import logger from './logger';
import {
  validateAndSanitizeLLMInput,
  VALIDATION_LIMITS,
  ConversationHistorySchema,
  safeParse
} from '../../../shared/utils/validation';

export type { ParsedCommand };
export type ParseResult = ParseResultType;

const REGEX_TOKENS = /([A-Z]+)\s+(to|into|for)\s+([A-Z]+)/i;
const REGEX_FROM_TO = /from\s+([A-Z]+)\s+to\s+([A-Z]+)/i;

const REGEX_AMOUNT_TOKEN =
/\b(\d+(.\d+)?)\s+(?!to|into|for|from|with|using\b)([A-Z]+)\b/i;

/* Stake / Zap */

const REGEX_SWAP_STAKE =
/(?:swap\s+and\s+stake|zap\s+(?:into|to)|stake\s+(?:my|after|then)|swap\s+(?:to|into)\s+(?:stake|yield))/i;

const REGEX_STAKE_COMMAND = /\b(stake|staking)\b/i;

const REGEX_LIQUID_STAKING_PROVIDER =
/\b(lido|rocket\s*pool|rocketpool|stakewise|marinade|benqi|ankr)\b/i;

const REGEX_STAKE_AMOUNT =
/(?:stake|staking)\s+(?:my\s+)?(?:all\s+)?(?:(\d+(?:.\d+)?[kmb]?)\s+)?([A-Z]{2,10})/i;

const REGEX_STAKE_ALL =
/\b(?:stake|staking)\s+(?:all|everything|my\s+entire|my\s+whole)\s+([A-Z]{2,10})/i;

const REGEX_STAKE_PERCENTAGE =
/(?:stake|staking)\s+(\d+(?:.\d+)?)%\s+(?:of\s+)?(?:my\s+)?([A-Z]{2,10})/i;

/* ---------------- HELPERS ---------------- */

const parseScaledNumber = (raw: string): number => {
  const cleaned = raw.replace(/[$,\s]/g, '').toLowerCase();
  const numPart = cleaned.replace(/[kmb]/g, '');
  const base = parseFloat(numPart);

  if (isNaN(base)) return NaN;

  if (cleaned.includes('k')) return base * 1000;
  if (cleaned.includes('m')) return base * 1000000;
  if (cleaned.includes('b')) return base * 1000000000;

  return base;
};

const preprocessInput = (input: string): string => {
  return input
  .toLowerCase()
  .replace(/[-–—]/g, ' to ')
  .replace(/→|->/g, ' to ')
  .trim();
};

/* ---------------- BUILD RESULT ---------------- */

const buildSwapResult = (
  userInput: string,
  {
    intent,
    fromAsset,
    toAsset,
    amount,
    amountType,
    excludeAmount,
    excludeToken,
    quoteAmount,
    conditions,
    confidence
  }: Partial<ParsedCommand> & { intent: ParsedCommand['intent']; confidence: number }
): ParsedCommand => ({
  success: true,
  intent,
  fromAsset: fromAsset ?? null,
  fromChain: null,
  toAsset: toAsset ?? 'USDC',
  toChain: null,
  amount: amount ?? null,
  amountType: amountType ?? null,
  excludeAmount,
  excludeToken,
  quoteAmount,
  conditions,
  portfolio: undefined,
  frequency: null,
  dayOfWeek: null,
  dayOfMonth: null,
  settleAsset: null,
  settleNetwork: null,
  settleAmount: null,
  settleAddress: null,
  fromProject: null,
  fromYield: null,
  toProject: null,
  toYield: null,
  conditionOperator: undefined,
  conditionValue: undefined,
  conditionAsset: undefined,
  targetPrice: undefined,
  condition: undefined,
  confidence,
  validationErrors: [],
  parsedMessage: `Parsed: Swap ${amount ?? '?'} ${fromAsset ?? '?'} → ${toAsset ?? 'USDC'}`,
  requiresConfirmation: false,
  originalInput: userInput
});

/* ---------------- MAIN PARSER ---------------- */

export async function parseUserCommand(
  userInput: string,
  conversationHistory: Array<Record<string, string>> = [],
  inputType: 'text' | 'voice' = 'text'
): Promise<ParseResult> {

  const { valid, sanitized, errors } = validateAndSanitizeLLMInput(userInput);

  if (!valid) {
    return {
    success: false,
    validationErrors: errors,
    confidence: 0,
    parsedMessage: 'Invalid input',
    requiresConfirmation: false,
    originalInput: userInput
    };
  }

  const historyValidation = safeParse(ConversationHistorySchema, conversationHistory);
  if (!historyValidation.success) {
    conversationHistory = [];
  }

  if (sanitized.length > VALIDATION_LIMITS.COMMAND_MAX) {
    return {
    success: false,
    validationErrors: ['Input too long'],
    confidence: 0,
    parsedMessage: 'Input exceeds max length',
    requiresConfirmation: false,
    originalInput: userInput
    };
  }

  const input = preprocessInput(sanitized);

  /* ---------------- STAKE ---------------- */

  if (REGEX_STAKE_COMMAND.test(input) && !REGEX_SWAP_STAKE.test(input)) {
    const providerMatch = input.match(REGEX_LIQUID_STAKING_PROVIDER);

    const stakeProtocol = providerMatch
      ? providerMatch[1]?.toLowerCase()
      : 'lido';

    let amount: number | null = null;
    let amountType: 'exact' | 'percentage' | 'all' | null = null;
    let stakeAsset: string | null = null;

    const allMatch = input.match(REGEX_STAKE_ALL);
    if (allMatch && allMatch[1]) {
      stakeAsset = allMatch[1].toUpperCase();
      amountType = 'all';
    }

    const pctMatch = input.match(REGEX_STAKE_PERCENTAGE);
    if (pctMatch && pctMatch[1] && pctMatch[2]) {
      amount = parseFloat(pctMatch[1]);
      stakeAsset = pctMatch[2].toUpperCase();
      amountType = 'percentage';
    }

    const amtMatch = input.match(REGEX_STAKE_AMOUNT);
    if (amtMatch && amtMatch[2]) {
      if (amtMatch[1]) {
        amount = parseScaledNumber(amtMatch[1]);
        amountType = 'exact';
      }
      stakeAsset = amtMatch[2].toUpperCase();
    }

    if (!stakeAsset) stakeAsset = 'ETH';

    return {
      success: true,
      intent: 'stake',
      fromAsset: stakeAsset,
      fromChain: 'ethereum',
      toAsset: 'stETH',
      toChain: 'ethereum',
      amount,
      amountType,
      excludeAmount: undefined,
      excludeToken: undefined,
      quoteAmount: undefined,
      conditions: undefined,
      portfolio: undefined,
      frequency: null,
      dayOfWeek: null,
      dayOfMonth: null,
      settleAsset: null,
      settleNetwork: null,
      settleAmount: null,
      settleAddress: null,
      fromProject: stakeProtocol,
      fromYield: null,
      toProject: null,
      toYield: null,
      conditionOperator: undefined,
      conditionValue: undefined,
      conditionAsset: undefined,
      targetPrice: undefined,
      condition: undefined,
      confidence: 85,
      validationErrors: [],
      parsedMessage: `Parsed: Stake ${amount ?? 'all'} ${stakeAsset}`,
      requiresConfirmation: true,
      originalInput: userInput
    };
  }

  /* ---------------- SWAP ---------------- */

  const isSwapRelated =
  /\b(swap|convert|send|transfer|buy|sell|move|exchange)\b/i.test(input);

  if (isSwapRelated) {
    const fromToMatch = input.match(REGEX_FROM_TO) || input.match(REGEX_TOKENS);

    let fromAsset: string | null = null;
    let toAsset: string | null = null;

    if (fromToMatch) {
      fromAsset = fromToMatch[1]?.toUpperCase() ?? null;
      toAsset = (fromToMatch[3] ?? fromToMatch[2])?.toUpperCase() ?? null;
    }

    const amtMatch = input.match(REGEX_AMOUNT_TOKEN);

    let amount: number | null = null;
    let amountType: ParsedCommand['amountType'] = null;

    if (amtMatch && amtMatch[1]) {
      amount = parseFloat(amtMatch[1]);
      amountType = 'exact';
      if (!fromAsset && amtMatch[3]) fromAsset = amtMatch[3].toUpperCase();
    }

    return buildSwapResult(userInput, {
      intent: 'swap',
      fromAsset,
      toAsset,
      amount,
      amountType,
      confidence: 80
    });
  }

  /* ---------------- LLM FALLBACK ---------------- */

  logger.info('Fallback to LLM for:', userInput);

  try {
    const result = await parseWithLLM(userInput, conversationHistory as any, inputType);
    return { ...result, originalInput: userInput };
  } catch (error) {
    logger.error('LLM Error', error);
    return {
      success: false,
      intent: 'unknown' as ParsedCommand['intent'],
      confidence: 0,
      validationErrors: ['Parsing failed'],
      parsedMessage: '',
      requiresConfirmation: false,
      originalInput: userInput
    };
  }
}