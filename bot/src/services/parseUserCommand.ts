import { parseWithLLM, ParsedCommand } from './groq-client';
import logger from './logger';

export { ParsedCommand };

export type ParseResult =
  | ParsedCommand
  | {
    success: false;
    validationErrors: string[];
    intent?: string;
    confidence?: number;
    parsedMessage?: string;
    requiresConfirmation?: boolean;
    originalInput?: string;
    [key: string]: any;
  };

/* ───────────────────────── REGEX ───────────────────────── */
const REGEX_TOKENS = /([A-Z]+)\s+(to|into|for)\s+([A-Z]+)/i;
const REGEX_FROM_TO = /from\s+([A-Z]+)\s+to\s+([A-Z]+)/i;
const REGEX_AMOUNT_TOKEN =
  /\b(\d+(\.\d+)?)\s+(?!to|into|for|from|with|using\b)([A-Z]+)\b/i;
const REGEX_MULTI_SOURCE =
  /(?:^|\s)([A-Z]{2,10}|(?:\d+(?:\.\d+)?\s+[A-Z]{2,10}))\s+(?:and|&)\s+([A-Z]{2,10}|(?:\d+(?:\.\d+)?\s+[A-Z]{2,10}))\s+(?:to|into|for)/i;

const REGEX_SWAP_STAKE =
  /(?:swap\s+and\s+stake|zap\s+(?:into|to)|stake\s+(?:my|after|then)|and\s+stake|stake\s+in)/i;

const REGEX_STAKE_PROTOCOL =
  /(?:to|on|in|into|using)\s+(aave|compound|yearn|lido|morpho|euler|spark|uniswap|curve|convex)/i;

/* ───────────────────────── MAIN PARSER ───────────────────────── */

export async function parseUserCommand(
  userInput: string,
  conversationHistory: any[] = [],
  inputType: 'text' | 'voice' = 'text'
): Promise<ParseResult> {
  let input = userInput
    .trim()
    .replace(/^(hey|hi|hello|please|kindly|can you)\s+/i, '')
    .replace(/\s+(please|kindly|immediately|now|right now)$/i, '')
    .replace(/\blike\b/gi, '')
    .trim();

  /* ───────────── SWAP + STAKE / ZAP ───────────── */

  if (REGEX_SWAP_STAKE.test(input)) {
    const protocolMatch = input.match(REGEX_STAKE_PROTOCOL);
    const stakeProtocol = protocolMatch?.[1]?.toLowerCase() ?? null;

    let amount: number | null = null;
    let fromAsset: string | null = null;
    let toAsset: string | null = null;

    const amtMatch = input.match(/\b(\d+(\.\d+)?)\b/);
    if (amtMatch) amount = parseFloat(amtMatch[1]);

    const fromToMatch = input.match(/([A-Z]{2,10})\s+(?:to|into)\s+([A-Z]{2,10})/i);
    if (fromToMatch) {
      fromAsset = fromToMatch[1].toUpperCase();
      toAsset = fromToMatch[2].toUpperCase();
    }

    if (!fromAsset) {
      const singleAsset = input.match(/\b([A-Z]{2,10})\b/);
      if (singleAsset) fromAsset = singleAsset[1].toUpperCase();
    }

    if (!toAsset) toAsset = 'USDC';

    return {
      success: true,
      intent: 'swap_and_stake',
      fromAsset,
      fromChain: null,
      toAsset,
      toChain: null,
      amount,
      amountType: amount ? 'exact' : null,
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
      toProject: stakeProtocol,
      toYield: null,
      conditionOperator: undefined,
      conditionValue: undefined,
      conditionAsset: undefined,
      targetPrice: undefined,
      condition: undefined,
      confidence: 80,
      validationErrors: [],
      parsedMessage: `Parsed: Swap ${amount ?? '?'} ${fromAsset ?? '?'} → ${toAsset} and stake`,
      requiresConfirmation: true,
      originalInput: userInput
    };
  }

  /* ───────────── STANDARD SWAP ───────────── */

  const isLimitOrDca = /\b(if|when|target|below|above|dca|every|daily|weekly|monthly)\b/i.test(input);
  const isSwapRelated = !isLimitOrDca && /\b(swap|convert|send|transfer|buy|sell|move|exchange)\b/i.test(input);

  if (isSwapRelated) {
    let intent: ParsedCommand['intent'] = 'swap';
    let amountType: ParsedCommand['amountType'] = null;
    let amount: number | null = null;
    let fromAsset: string | null = null;
    let toAsset: string | null = null;
    let confidence = 10;

    if (REGEX_MULTI_SOURCE.test(input)) {
      return {
        success: false,
        intent: 'swap',
        validationErrors: ['Multiple source assets not supported'],
        confidence: 0,
        parsedMessage: 'Multiple source assets detected',
        requiresConfirmation: false,
        originalInput: userInput
      };
    }

    const fromToMatch = input.match(REGEX_FROM_TO) || input.match(REGEX_TOKENS);
    if (fromToMatch) {
      fromAsset = fromToMatch[1].toUpperCase();
      toAsset = fromToMatch[3]?.toUpperCase();
      confidence += 40;
    }

    const amtMatch = input.match(REGEX_AMOUNT_TOKEN);
    if (amtMatch) {
      amount = parseFloat(amtMatch[1]);
      amountType = 'exact';
      if (!fromAsset) fromAsset = amtMatch[3].toUpperCase();
      confidence += 20;
    }

    if (!toAsset) toAsset = 'USDC';

    return {
      success: true,
      intent,
      fromAsset,
      fromChain: null,
      toAsset,
      toChain: null,
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
      fromProject: null,
      fromYield: null,
      toProject: null,
      toYield: null,
      conditionOperator: undefined,
      conditionValue: undefined,
      conditionAsset: undefined,
      targetPrice: undefined,
      condition: undefined,
      confidence: Math.min(100, confidence),
      validationErrors: [],
      parsedMessage: `Parsed: Swap ${amount ?? '?'} ${fromAsset ?? '?'} → ${toAsset}`,
      requiresConfirmation: false,
      originalInput: userInput
    };
  }

  /* ───────────── FALLBACK TO LLM ───────────── */

  logger.info('Fallback to LLM for:', userInput);

  try {
    const result = await parseWithLLM(userInput, conversationHistory, inputType);
    return { ...result, originalInput: userInput };
  } catch (error) {
    logger.error('LLM Error', error);
    return {
      success: false,
      intent: 'unknown',
      confidence: 0,
      validationErrors: ['Parsing failed'],
      parsedMessage: '',
      requiresConfirmation: false,
      originalInput: userInput
    };
  }
}