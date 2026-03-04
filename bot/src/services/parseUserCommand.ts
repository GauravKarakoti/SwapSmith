import { parseWithLLM, ParsedCommand } from './groq-client';
import { detectLimitOrder } from './nl-limit-orders';
import { detectDCA } from './nl-dca';
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

const REGEX_TOKENS = /([A-Z]{2,10})\s+(to|into|for)\s+([A-Z]{2,10})/i;
const REGEX_FROM_TO = /from\s+([A-Z]{2,10})\s+to\s+([A-Z]{2,10})/i;
const REGEX_AMOUNT_TOKEN = /\b(\d+(?:\.\d+)?)\s+([A-Z]{2,10})\b/i;
const REGEX_MULTI_SOURCE =
  /(?:^|\s)([A-Z]{2,10}|(?:\d+(?:\.\d+)?\s+[A-Z]{2,10}))\s+(?:and|&)\s+([A-Z]{2,10}|(?:\d+(?:\.\d+)?\s+[A-Z]{2,10}))\s+(?:to|into|for)/i;

const REGEX_SWAP_STAKE =
  /(?:swap\s+and\s+stake|\bzap\b|stake\s+(?:my|after|then)|and\s+stake|stake\s+in)/i;

const REGEX_STAKE_PROTOCOL =
  /(?:to|on|in|into|using)\s+(aave|compound|yearn|lido|morpho|euler|spark|uniswap|curve|convex)/i;

const parseScaledNumber = (raw: string): number => {
  const cleaned = raw.replace(/[$,\s]/g, '').toLowerCase();
  const suffix = cleaned.slice(-1);
  const base = parseFloat(cleaned);

// New Regex for Swap and Stake / Zap intents
const REGEX_SWAP_STAKE = /(?:swap\s+and\s+stake|zap\s+(?:into|to)|stake\s+(?:my|after|then)|swap\s+(?:to|into)\s+(?:stake|yield))/i;
const REGEX_STAKE_PROTOCOL = /(?:to\s+)?(aave|compound|yearn|lido|morpho|euler|spark)/i;

// New Regex for direct Stake commands (e.g., "Stake 1 ETH with Lido" or "Stake my ETH")
const REGEX_STAKE_COMMAND = /\b(stake)\b/i;
const REGEX_LIQUID_STAKING_PROVIDER = /\b(lido|rocket\s*pool|rocketpool|stakewise|stake\s*wise)\b/i;

function normalizeNumber(val: string): number {
  val = val.toLowerCase().replace(/[\$,]/g, '');

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
    conditionOperator,
    conditionValue,
    conditionAsset,
    confidence,
    requiresConfirmation
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
  conditionOperator,
  conditionValue,
  conditionAsset,
  targetPrice: conditionValue,
  condition: conditionOperator === 'gt' ? 'above' : conditionOperator === 'lt' ? 'below' : undefined,
  confidence,
  validationErrors: [],
  parsedMessage: `Parsed: Swap ${amount ?? '?'} ${fromAsset ?? '?'} → ${toAsset ?? 'USDC'}`,
  requiresConfirmation: requiresConfirmation ?? false,
  originalInput: userInput
});

export async function parseUserCommand(
  userInput: string,
  conversationHistory: any[] = [],
  inputType: 'text' | 'voice' = 'text'
): Promise<ParseResult> {
  let input = userInput
    .trim()
    .replace(/^(hey|hi|hello|please|kindly|can you)\s+/i, '')
    .replace(/[!?.,]+$/g, '')
    .replace(/\s+(please|kindly|immediately|now|right now)$/i, '')
    .replace(/\blike\b/gi, '')
    .trim();

  if (REGEX_SWAP_STAKE.test(input)) {
    const protocolMatch = input.match(REGEX_STAKE_PROTOCOL);
    const stakeProtocol = protocolMatch?.[1]?.toLowerCase() ?? null;

    let amount: number | null = null;
    let fromAsset: string | null = null;
    let toAsset: string | null = null;

    const amtMatch = input.match(/\b(\d+(\.\d+)?)\b/);
    if (amtMatch) amount = parseFloat(amtMatch[1]);

    const fromToMatch = input.match(/([A-Z]{2,10})\s+(?:to|into|for)\s+([A-Z]{2,10})/i);
    if (fromToMatch) {
      fromAsset = fromToMatch[1].toUpperCase();
      toAsset = fromToMatch[2].toUpperCase();
    }

    if (!fromAsset) {
      const singleAsset = input.match(/\b([A-Z]{2,10})\b/);
      if (singleAsset) fromAsset = singleAsset[1].toUpperCase();
    }

    return {
      ...buildSwapResult(userInput, {
        intent: 'swap_and_stake',
        amount,
        amountType: amount ? 'exact' : null,
        fromAsset,
        toAsset,
        confidence: 80,
        requiresConfirmation: true
      }),
      fromProject: stakeProtocol,
      toProject: stakeProtocol,
      toYield: null,
      conditionOperator: undefined,
      conditionValue: undefined,
      conditionAsset: undefined,
      targetPrice: undefined,
      condition: undefined,
      confidence: 80,
      validationErrors: [],
      parsedMessage: `Parsed: Swap ${amount || '?'} ${fromAsset || '?'} to ${toAsset} and stake`,
      requiresConfirmation: true,
      originalInput: userInput
     };
  }

  // Check for direct Stake Intent (e.g., "Stake 1 ETH with Lido" or "Stake my ETH")
  if (REGEX_STAKE_COMMAND.test(input) && !REGEX_SWAP_STAKE.test(input)) {
    const providerMatch = input.match(REGEX_LIQUID_STAKING_PROVIDER);
    const stakeProtocol = providerMatch ? providerMatch[1].toLowerCase().replace(/\s+/g, '_') : 'lido';
    const stakeProvider = providerMatch
      ? providerMatch[1].replace(/\s+/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      : 'Lido';

    let amount: number | null = null;
    let stakeAsset: string | null = null;

    const amtMatch = input.match(/\b(\d+(\.\d+)?)\s*([A-Z]{2,5})?\b/i);
    if (amtMatch) {
      amount = parseFloat(amtMatch[1]);
      if (amtMatch[3]) {
        stakeAsset = amtMatch[3].toUpperCase();
      }
    }

    // Try to find asset after "stake" keyword
    if (!stakeAsset) {
      const assetMatch = input.match(/stake\s+(?:my\s+)?(\d+(\.\d+)?\s+)?([A-Z]{2,5})/i);
      if (assetMatch && assetMatch[3]) {
        stakeAsset = assetMatch[3].toUpperCase();
      }
    }

    // Default to ETH if no asset specified
    if (!stakeAsset) {
      stakeAsset = 'ETH';
    }

    // Estimated APR based on provider
    const stakingApr = stakeProtocol === 'rocket_pool' ? 3.4 :
                       stakeProtocol === 'stakewise' ? 3.3 : 3.5;

    return {
      success: true,
      intent: 'stake',
      fromAsset: stakeAsset,
      fromChain: 'ethereum',
      toAsset: null,
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
      toProject: null,
      toYield: null,
      conditionOperator: undefined,
      conditionValue: undefined,
      conditionAsset: undefined,
      targetPrice: undefined,
      condition: undefined,
      // Staking specific fields
      stakeAsset,
      stakeProtocol,
      stakeChain: 'ethereum',
      stakingApr,
      stakeProvider,
      confidence: 85,
      validationErrors: [],
      parsedMessage: `Parsed: Stake ${amount || '?'} ${stakeAsset} with ${stakeProvider} (${stakingApr}% APR)`,
      requiresConfirmation: true,
      originalInput: userInput
    };
  }

  /* ───────────── STANDARD SWAP ───────────── */

  const isLimitOrDca = /\b(if|when|target|below|above|dca|every|daily|weekly|monthly)\b/i.test(input);
  const isSwapRelated = !isLimitOrDca && /\b(swap|convert|send|transfer|buy|sell|move|exchange)\b/i.test(input);

  if (isSwapRelated) {
    if (/\bor\b/i.test(input)) {
      return {
        success: false,
        intent: 'swap',
        validationErrors: ['Command is ambiguous. Please specify clearly.'],
        confidence: 0,
        parsedMessage: 'Ambiguous destination assets detected',
        requiresConfirmation: true,
        originalInput: userInput
      };
    }

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

    let confidence = 20;
    let intent: ParsedCommand['intent'] = 'swap';
    let amountType: ParsedCommand['amountType'] = null;
    let amount: number | null = null;
    let fromAsset: string | null = null;
    let toAsset: string | null = null;
    let excludeAmount: number | undefined;
    let excludeToken: string | undefined;
    let quoteAmount: number | undefined;

    const fromToMatch = input.match(REGEX_FROM_TO) || input.match(REGEX_TOKENS);
    if (fromToMatch) {
      fromAsset = fromToMatch[1].toUpperCase();
      toAsset = (fromToMatch[3] ?? fromToMatch[2]).toUpperCase();
      confidence += 35;
    }

    const buyWithMatch = input.match(/\bbuy\s+(\d+(?:\.\d+)?)\s+([A-Z]{2,10})\s+with\s+([A-Z]{2,10})\b/i);
    if (buyWithMatch) {
      amount = parseFloat(buyWithMatch[1]);
      amountType = 'exact';
      toAsset = buyWithMatch[2].toUpperCase();
      fromAsset = buyWithMatch[3].toUpperCase();
      confidence += 35;
    }

    const explicitToMatch = input.match(/\b(?:to|into|for)\s+([A-Z]{2,10})\b/i);
    if (!toAsset && explicitToMatch) {
      toAsset = explicitToMatch[1].toUpperCase();
      confidence += 10;
    }

    const percentageMatch = input.match(/(\d+(?:\.\d+)?)\s*(?:%|percent)/i);
    if (percentageMatch) {
      amount = parseFloat(percentageMatch[1]);
      amountType = 'percentage';
      confidence += 20;
    } else if (/\bhalf\b/i.test(input)) {
      amount = 50;
      amountType = 'percentage';
      confidence += 20;
    }

    if (!fromAsset && amountType === 'percentage') {
      const stopWords = ['SWAP', 'CONVERT', 'SEND', 'TRANSFER', 'BUY', 'SELL', 'MOVE', 'EXCHANGE', 'ALL', 'MAX', 'OF', 'MY', 'PERCENT'];

      const ofAsset = input.match(/(?:of\s+(?:my\s+)?)([A-Z]{2,10})\b/i);
      if (ofAsset) {
        const candidate = ofAsset[1].toUpperCase();
        if (!stopWords.includes(candidate)) fromAsset = candidate;
      }

      if (!fromAsset) {
        const afterPercentAsset = input.match(/(?:%|percent|half)\s+(?:of\s+(?:my\s+)?)?([A-Z]{2,10})\b/i);
        if (afterPercentAsset) {
          const candidate = afterPercentAsset[1].toUpperCase();
          if (!stopWords.includes(candidate)) fromAsset = candidate;
        }
      }

      if (!fromAsset) {
        const tokenCandidates = [...input.toUpperCase().matchAll(/\b([A-Z]{2,10})\b/g)].map((m) => m[1]);
        const filtered = tokenCandidates.filter((t) => !stopWords.includes(t));
        if (filtered.length) fromAsset = filtered[filtered.length - 1];
      }
    }

    const worthSourceMatch = input.match(/\b(?:swap|convert|sell|buy|send|transfer|move|exchange)\s+([A-Z]{2,10})\s+worth\b/i);
    if (!fromAsset && worthSourceMatch) {
      fromAsset = worthSourceMatch[1].toUpperCase();
      confidence += 10;
    }

    const allMatch = /\b(all|everything|max|entire\s+balance|full\s+balance)\b/i.test(input);
    if (allMatch) {
      amountType = 'all';
      amount = null;
      confidence += 20;
    }

    const amtMatch = input.match(REGEX_AMOUNT_TOKEN);
    if (amtMatch && amountType !== 'percentage' && amountType !== 'all' && !/\bworth\b/i.test(input)) {
      amount = parseFloat(amtMatch[1]);
      amountType = 'exact';
      if (!fromAsset) fromAsset = amtMatch[2].toUpperCase();
      confidence += 20;
    }

    if (!fromAsset) {
      const verbAsset = input.match(/\b(?:swap|convert|send|transfer|buy|sell|move|exchange)\s+(?:my\s+)?([A-Z]{2,10})\b/i);
      if (verbAsset) {
        const candidate = verbAsset[1].toUpperCase();
        if (!['ALL','EVERYTHING','MAX','ENTIRE','BALANCE','HALF'].includes(candidate)) fromAsset = candidate;
      }
    }

    const exclusionMatch = input.match(/(?:except|but\s+keep)\s+(\d+(?:\.\d+)?)(?:\s*%|\s+([A-Z]{2,10}))?/i);
    if (exclusionMatch) {
      excludeAmount = parseFloat(exclusionMatch[1]);
      excludeToken = exclusionMatch[2]?.toUpperCase() ?? fromAsset ?? undefined;
    }

    const quoteMatch = input.match(/\bworth\s+(\d+(?:\.\d+)?)\s+([A-Z]{2,10})\b/i);
    if (quoteMatch) {
      quoteAmount = parseFloat(quoteMatch[1]);
      if (!toAsset) toAsset = quoteMatch[2].toUpperCase();
      confidence += 10;
    }

    let conditionOperator: 'gt' | 'lt' | undefined;
    let conditionValue: number | undefined;
    let conditionAsset: string | undefined;

    const conditionPattern = /(if|when|only if)[^\dA-Z$]*([A-Z]{2,10}|price)?[^\d$<>]*(?:is\s+)?(?:goes\s+|rises\s+|drops\s+|hits\s+)?(above|below|>|<|greater than|less than)?\s*\$?(\d+(?:\.\d+)?[km]?)/i;
    const conditionMatch = input.match(conditionPattern);
    if (conditionMatch) {
      const rawAsset = conditionMatch[2];
      const rawOperator = conditionMatch[3];
      const rawValue = conditionMatch[4];

      conditionValue = parseScaledNumber(rawValue);
      if (/(above|>|greater)/i.test(rawOperator ?? '')) conditionOperator = 'gt';
      if (/(below|<|less)/i.test(rawOperator ?? '')) conditionOperator = 'lt';

      if (!conditionOperator) {
        if (/(drops?|below)|</i.test(conditionMatch[0])) conditionOperator = 'lt';
        if (/(rises?|above|hits)|>/i.test(conditionMatch[0])) conditionOperator = 'gt';
      }

      conditionAsset = rawAsset && !/price/i.test(rawAsset) ? rawAsset.toUpperCase() : (fromAsset ?? undefined);

      if (conditionOperator && conditionValue && conditionAsset) {
        confidence += 25;

        const shouldBeLimitOrder = /\bwhen\b/i.test(input) || (/\b(convert|buy)\b/i.test(input) && /\bif\b/i.test(input)) || (/\bswap\b/i.test(input) && /\bwhen\s+price\b/i.test(input)) || (/\bsell\b/i.test(input) && /\b(hits|if|when)\b/i.test(input));
        const sellWithExplicitPairAndConditionAsset = /\bsell\b/i.test(input) && /\b(?:to|into|for)\s+[A-Z]{2,10}\b/i.test(input) && /\bwhen\s+[A-Z]{2,10}\b/i.test(input);
        if (shouldBeLimitOrder && !sellWithExplicitPairAndConditionAsset) {
          intent = 'limit_order';
        }
      }
    }

    if (!fromAsset && amountType === 'all') {
      const allAssetMatch = input.match(/\b(?:all|max)\s+([A-Z]{2,10})\b/i);
      if (allAssetMatch) fromAsset = allAssetMatch[1].toUpperCase();
    }

    if (!fromAsset && !toAsset && !amount && amountType !== 'all') {
      logger.info('Fallback to LLM for:', userInput);
      try {
        const result = await parseWithLLM(userInput, conversationHistory, inputType);
        if (result.intent === 'portfolio' && Array.isArray(result.portfolio) && result.portfolio.length) {
          const total = result.portfolio.reduce((sum, item) => sum + (item.percentage ?? 0), 0);
          if (total !== 100) {
            return {
              ...result,
              success: false,
              validationErrors: [...(result.validationErrors ?? []), `Total allocation is ${total}%, but should be 100%`],
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
          requiresConfirmation: false,
          originalInput: userInput
        };
      }
    }

    const hasExplicitTo = /\b(?:to|into|for)\s+[A-Z]{2,10}\b/i.test(input);
    if ((!fromAsset && amountType !== 'all') || (!hasExplicitTo && amount === null && amountType === null && !conditionOperator && !quoteAmount) || /^\s*(swap|convert)\s+[A-Z]{2,10}\s*$/i.test(input) || /^\s*convert\s+to\s+[A-Z]{2,10}\s*$/i.test(input)) {
      logger.info('Fallback to LLM for:', userInput);
      try {
        const result = await parseWithLLM(userInput, conversationHistory, inputType);
        if (result.intent === 'portfolio' && Array.isArray(result.portfolio) && result.portfolio.length) {
          const total = result.portfolio.reduce((sum, item) => sum + (item.percentage ?? 0), 0);
          if (total !== 100) {
            return {
              ...result,
              success: false,
              validationErrors: [...(result.validationErrors ?? []), `Total allocation is ${total}%, but should be 100%`],
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
          requiresConfirmation: false,
          originalInput: userInput
        };
      }
    }

    return buildSwapResult(userInput, {
      intent,
      fromAsset,
      toAsset,
      amount,
      amountType,
      excludeAmount,
      excludeToken,
      quoteAmount,
      conditions: conditionOperator && conditionValue && conditionAsset
        ? {
            type: conditionOperator === 'gt' ? 'price_above' : 'price_below',
            asset: conditionAsset,
            value: conditionValue
          }
        : undefined,
      conditionOperator,
      conditionValue,
      conditionAsset,
      confidence: Math.min(100, confidence)
    });
  }

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
