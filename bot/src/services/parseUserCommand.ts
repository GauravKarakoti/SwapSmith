import { parseWithLLM } from './groq-client';
import type {
  ParsedCommand,
  ParseResult as ParseResultType,
  Condition
} from '../types/ParsedCommand';
import logger from './logger';
import { parseDCA } from './nl-dca';
import { detectLimitOrder } from './nl-limit-orders';
import { 
  sanitizeInput, 
  validateAndSanitizeLLMInput,
  VALIDATION_LIMITS,
  ConversationHistorySchema,
  safeParse
} from '../../../shared/utils/validation';

export type { ParsedCommand };
export type ParseResult = ParseResultType;

/* ---------------- REGEX ---------------- */

const REGEX_EXCLUSION =
  /(?:everything|all|entire|max)\s*(?:[A-Z]+\s+)?(?:except|but\s+keep)\s+(\d+(\.\d+)?)\s*([A-Z]+)?/i;

const REGEX_PERCENTAGE =
  /(\d+(\.\d+)?)\s*(?:%|percent)\s*(?:of\s+(?:my\s+)?)?([A-Z]+)?/i;

const REGEX_HALF = /\b(half)\b\s*(?:of\s+(?:my\s+)?)?([A-Z]+)?/i;
const REGEX_QUARTER = /\b(quarter)\b\s*(?:of\s+(?:my\s+)?)?([A-Z]+)?/i;

const REGEX_MAX_ALL = /\b(max|all|everything|entire)\b/i;
const REGEX_ALL_TOKEN = /(max|all|everything|entire)\s+([A-Z]+)/i;

const REGEX_TOKENS = /([A-Z]+)\s+(to|into|for)\s+([A-Z]+)/i;
const REGEX_FROM_TO = /from\s+([A-Z]+)\s+to\s+([A-Z]+)/i;

const REGEX_AMOUNT_TOKEN =
  /\b(\d+(\.\d+)?)\s+(?!to|into|for|from|with|using\b)([A-Z]+)\b/i;

export async function parseUserCommand(
  userInput: string,
  conversationHistory: Array<Record<string, string>> = [],
  inputType: 'text' | 'voice' = 'text'
): Promise<ParseResult> {
  // ============================================
  // INPUT VALIDATION & SANITIZATION
  // ============================================
  
  // Validate user input with LLM sanitization
  const { valid, sanitized, errors } = validateAndSanitizeLLMInput(userInput);
  
  if (!valid) {
    return {
      success: false,
      validationErrors: errors,
      confidence: 0,
      parsedMessage: 'Invalid input format',
      requiresConfirmation: false,
      originalInput: userInput
    };
  }

  // Validate conversation history
  const historyValidation = safeParse(ConversationHistorySchema, conversationHistory);
  if (!historyValidation.success) {
    conversationHistory = []; // Reset to empty if invalid
    logger.warn('Invalid conversation history format, resetting', { errors: historyValidation.errors });
  }

  // Graceful handling if someone passes a boolean for legacy fallbackToLLM
  if (typeof conversationHistory === 'boolean') {
    conversationHistory = [];
  }

  const userInputLength = sanitized.length;
  if (userInputLength === 0) {
    return {
      success: false,
      validationErrors: ['Input cannot be empty'],
      confidence: 0,
      parsedMessage: 'No input provided',
      requiresConfirmation: false,
      originalInput: userInput
    };
  }

  // Enforce input length limits to prevent ReDoS
  if (userInputLength > VALIDATION_LIMITS.COMMAND_MAX) {
    return {
      success: false,
      validationErrors: [`Input exceeds maximum length of ${VALIDATION_LIMITS.COMMAND_MAX} characters`],
      confidence: 0,
      parsedMessage: 'Input too long',
      requiresConfirmation: false,
      originalInput: userInput
    };
  }

  const originalInput = userInput;
  const preprocessedInput = preprocessInput(sanitized);
  
  // Enhanced ambiguity detection with better error handling
  const hasAmbiguousOr = REGEX_AMBIGUOUS_OR.test(preprocessedInput);
  const hasMultipleDestinations = REGEX_MULTIPLE_DESTINATIONS.test(preprocessedInput);
  const hasConditionals = REGEX_CONDITIONAL.test(preprocessedInput);
  
  if (hasAmbiguousOr || hasMultipleDestinations) {
    const destinations = preprocessedInput.match(REGEX_MULTIPLE_DESTINATIONS);
    const detectedAssets = destinations ? [destinations[1], destinations[2]] : [];
    
    // Try to extract amount and source asset for better context
    const amountMatch = preprocessedInput.match(REGEX_AMOUNT_TOKEN);
    const fromAssetMatch = preprocessedInput.match(/(?:swap|convert|sell)\s+(?:my\s+)?(?:(\d+(?:\.\d+)?[kmb]?)\s+)?([A-Z]{2,10})/i);
    
    const amount = amountMatch ? parseScaledNumber(amountMatch[1]) : null;
    const fromAsset = fromAssetMatch?.[2] || amountMatch?.[2];
    
    return {
      success: false,
      intent: 'swap',
      fromAsset,
      amount,
      amountType: amount ? 'exact' : null,
      toAsset: null,
      validationErrors: destinations 
        ? [`Multiple destination assets detected: ${detectedAssets.join(', ')}. Please specify one.`]
        : ['Command contains ambiguous language. Please be more specific.'],
      confidence: 20,
      parsedMessage: `Ambiguous command: ${amount || '?'} ${fromAsset || '?'} → [${detectedAssets.join(' or ') || 'unclear destination'}]`,
      requiresConfirmation: true,
      originalInput,
      alternativeInterpretations: detectedAssets.length > 0 ? detectedAssets.map(asset => 
        `Swap ${amount || 'all'} ${fromAsset || 'assets'} to ${asset}`
      ) : [
        "Clarify the destination asset",
        "Specify exact amounts and assets"
      ],
      suggestedClarifications: detectedAssets.length > 0 ? [
        `Which asset would you prefer: ${detectedAssets.join(' or ')}?`,
        "Would you like to split between multiple assets instead?"
      ] : [
        "Please specify which asset you want to swap to",
        "What is your intended destination asset?"
      ]
    };
  }
}
const REGEX_CONDITION =
  /(?:if|when)\s+(?:the\s+)?(?:price|rate|market|value)?\s*(?:of\s+)?([A-Z]+)?\s*(?:is|goes|drops|rises|falls)?\s*(above|below|greater|less|more|under|>|<)\s*(?:than)?\s*(\$?[\d,]+(\.\d+)?\s*[kKmM]?)/i;

const REGEX_QUOTE =
  /(?:([A-Z]+)\s+)?(?:worth|value|valued\s+at)\s*(?:of)?\s*(\$)?(\d+(\.\d+)?)\s*([A-Z]+)?/i;

const REGEX_MULTI_SOURCE =
  /(?:^|\s)([A-Z]{2,10}|(?:\d+(?:\.\d+)?\s+[A-Z]{2,10}))\s+(?:and|&)\s+([A-Z]{2,10}|(?:\d+(?:\.\d+)?\s+[A-Z]{2,10}))\s+(?:to|into|for)/i;

/* Stake / Zap */

const REGEX_SWAP_STAKE =
  /(?:swap\s+and\s+stake|zap\s+(?:into|to)|stake\s+(?:my|after|then)|swap\s+(?:to|into)\s+(?:stake|yield))/i;

const REGEX_STAKE_INTENT = /\b(stake|staking|staked)\b/i;

const REGEX_STAKE_KEYWORD =
  /(?:stake|staking)\s+(?:my\s+)?(\d+(?:\.\d+)?)?\s*([A-Z]{2,5})/i;

/* ---------------- UTILS ---------------- */

function normalizeNumber(val: string): number {
  val = val.toLowerCase().replace(/[\$,]/g, '');

  if (val.endsWith('k')) return parseFloat(val) * 1000;
  if (val.endsWith('m')) return parseFloat(val) * 1000000;

  return parseFloat(val);
}

/* ---------------- MAIN PARSER ---------------- */

export async function parseUserCommand(
  userInput: string,
  conversationHistory: Array<Record<string, string>> = [],
  inputType: 'text' | 'voice' = 'text'
): Promise<ParseResult> {
  let input = userInput.trim();

  let confidence = 0;
  let validationErrors: string[] = [];

  let amountType: ParsedCommand['amountType'] = null;
  let amount: number | null = null;

  let fromAsset: string | null = null;
  let toAsset: string | null = null;

  let excludeAmount: number | undefined;
  let excludeToken: string | undefined;
  let quoteAmount: number | undefined;

  let intent: ParsedCommand['intent'] = 'swap';

  let conditions: Condition | undefined;
  let conditionOperator: 'gt' | 'lt' | undefined;
  let conditionValue: number | undefined;
  let conditionAsset: string | undefined;

  /* ---- Preprocessing ---- */

  input = input
    .replace(/^(hey|hi|hello|please|kindly|can you)\s+/i, '')
    .replace(/\s+(please|kindly|immediately|now|right now)$/i, '')
    .replace(/\b(like)\b/gi, '')
    .trim();

  /* ---- Direct Stake Intent ---- */

  const isStakeIntent =
    REGEX_STAKE_INTENT.test(input) && !REGEX_SWAP_STAKE.test(input);

  if (isStakeIntent) {
    const stakeMatch = input.match(REGEX_STAKE_KEYWORD);

    if (stakeMatch) {
      if (stakeMatch[1]) amount = parseFloat(stakeMatch[1]);
      if (stakeMatch[2]) fromAsset = stakeMatch[2].toUpperCase();
    }

    if (fromAsset) {
      return {
        success: true,
        intent: 'stake',
        fromAsset,
        fromChain: null,
        toAsset: fromAsset,
        toChain: null,
        amount,
        amountType: amount ? 'exact' : 'all',
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
        fromProject: null,
        fromYield: null,
        toProject: null,
        toYield: null,
        conditionOperator: undefined,
        conditionValue: undefined,
        conditionAsset: undefined,
        targetPrice: undefined,
        condition: undefined,
        confidence: 90,
        validationErrors: [],
        parsedMessage: `Parsed: Stake ${amount ?? 'all'} ${fromAsset}`,
        requiresConfirmation: true,
        originalInput: userInput
      };
    }
  }

  /* ---- Swap Intent ---- */

  const isSwapRelated =
    /\b(swap|convert|send|transfer|buy|sell|move|exchange)\b/i.test(input);

  if (isSwapRelated) {
    /* ---- Multi source ---- */

    if (REGEX_MULTI_SOURCE.test(input)) {
      return {
        success: false,
        intent: 'swap',
        fromAsset: null,
        fromChain: null,
        toAsset: null,
        toChain: null,
        amount: null,
        settleAsset: null,
        settleNetwork: null,
        settleAmount: null,
        settleAddress: null,
        fromProject: null,
        fromYield: null,
        toProject: null,
        toYield: null,
        validationErrors: ['Multiple source assets not supported'],
        confidence: 0,
        parsedMessage: 'Multiple source assets detected',
        requiresConfirmation: false,
        originalInput: userInput
      };
    }

    /* ---- Exclusion ---- */

    const exclusionMatch = input.match(REGEX_EXCLUSION);
    if (exclusionMatch) {
      amountType = 'all';
      excludeAmount = parseFloat(exclusionMatch[1]);

      if (exclusionMatch[3]) {
        excludeToken = exclusionMatch[3].toUpperCase();
        fromAsset = excludeToken;
      }

      confidence += 40;
    }

    /* ---- Percentage ---- */

    const pctMatch = input.match(REGEX_PERCENTAGE);
    if (pctMatch) {
      amountType = 'percentage';
      amount = parseFloat(pctMatch[1]);

      if (pctMatch[3]) fromAsset = pctMatch[3].toUpperCase();

      confidence += 40;
    }

    /* ---- Quote ---- */

    const quoteMatch = input.match(REGEX_QUOTE);
    if (quoteMatch) {
      quoteAmount = parseFloat(quoteMatch[3]);

      if (quoteMatch[1]) fromAsset = quoteMatch[1].toUpperCase();
      if (quoteMatch[5]) toAsset = quoteMatch[5].toUpperCase();

      confidence += 30;
    }

    /* ---- Token pair ---- */

    const fromToMatch = input.match(REGEX_FROM_TO);
    if (fromToMatch) {
      fromAsset = fromToMatch[1].toUpperCase();
      toAsset = fromToMatch[2].toUpperCase();
      confidence += 40;
    }

    const tokenMatch = input.match(REGEX_TOKENS);
    if (tokenMatch && !fromAsset) {
      fromAsset = tokenMatch[1].toUpperCase();
      toAsset = tokenMatch[3].toUpperCase();
      confidence += 30;
    }

    /* ---- Amount ---- */

    const amtTokenMatch = input.match(REGEX_AMOUNT_TOKEN);
    if (amtTokenMatch) {
      amount = parseFloat(amtTokenMatch[1]);
      amountType = 'exact';

      if (!fromAsset) fromAsset = amtTokenMatch[3].toUpperCase();

      confidence += 20;
    }

    /* ---- Limit Condition ---- */

    const conditionMatch = input.match(REGEX_CONDITION);

    if (conditionMatch) {
      intent = 'limit_order';

      conditionValue = normalizeNumber(conditionMatch[3]);

      if (conditionMatch[1]) {
        conditionAsset = conditionMatch[1].toUpperCase();
      }

      const operatorStr = conditionMatch[2].toLowerCase();

      if (
        operatorStr.includes('below') ||
        operatorStr.includes('less') ||
        operatorStr.includes('<')
      ) {
        conditionOperator = 'lt';
      } else {
        conditionOperator = 'gt';
      }

      conditions = {
        type: conditionOperator === 'gt' ? 'price_above' : 'price_below',
        asset: conditionAsset || fromAsset || 'ETH',
        value: conditionValue
      };

      confidence += 30;
    }

    /* ---- If good parse ---- */

    if (confidence >= 30) {
      return {
        success: true,
        intent,
        fromAsset,
        fromChain: null,
        toAsset,
        toChain: null,
        amount,
        amountType,
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
        conditionOperator,
        conditionValue,
        conditionAsset,
        targetPrice: conditionValue,
        condition: conditionOperator === 'gt' ? 'above' : 'below',
        confidence: Math.min(100, confidence + 30),
        validationErrors,
        parsedMessage: `Parsed: ${amount ?? '?'} ${fromAsset ?? '?'} -> ${toAsset ?? '?'}`,
        requiresConfirmation: false,
        originalInput: userInput
      };
    }
  }

  /* ---- LLM Fallback ---- */

  logger.info('Fallback to LLM for:', userInput);

  try {
    const result = await parseWithLLM(
      userInput,
      conversationHistory,
      inputType
    );

    if (
      result.intent === 'portfolio' &&
      Array.isArray(result.portfolio) &&
      result.portfolio.length
    ) {
      const total = result.portfolio.reduce(
        (sum, item) => sum + (item.percentage ?? 0),
        0
      );

      if (total !== 100) {
        return {
          ...result,
          success: false,
          validationErrors: [
            ...(result.validationErrors ?? []),
            `Total allocation is ${total}%, but should be 100%`
          ],
          originalInput: userInput
        };
      }
    }

    if (result.validationErrors?.length) {
      return { ...result, success: false, originalInput: userInput };
    }

    return { ...result, originalInput: userInput };
  } catch (error) {
    logger.error('LLM Error', error);

    return {
      success: false,
      intent: 'unknown',
      confidence: 0,
      validationErrors: ['Parsing failed'],
      parsedMessage: '',
      fromAsset: null,
      fromChain: null,
      toAsset: null,
      toChain: null,
      amount: null,
      settleAsset: null,
      settleNetwork: null,
      settleAmount: null,
      settleAddress: null,
      fromProject: null,
      fromYield: null,
      toProject: null,
      toYield: null,
      requiresConfirmation: false,
      originalInput: userInput
    };
  }
}