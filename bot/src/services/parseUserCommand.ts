import { parseWithLLM } from './groq-client';
import type { ParsedCommand, ParseResult as ParseResultType, NextAction, FallbackAction, Condition } from '../types/ParsedCommand';
import logger from './logger';
import { parseDCA } from './nl-dca';
import { detectLimitOrder } from './nl-limit-orders';

export type { ParsedCommand };

export type ParseResult = ParseResultType;

const REGEX_TOKENS = /([A-Z]{2,10})\s+(to|into|for|→|->)\s+([A-Z]{2,10})/i;
const REGEX_FROM_TO = /from\s+([A-Z]{2,10})\s+to\s+([A-Z]{2,10})/i;
const REGEX_AMOUNT_TOKEN = /\b(\d+(?:\.\d+)?[kmb]?)\s+([A-Z]{2,10})\b/i;
const REGEX_MULTI_SOURCE =
  /(?:^|\s)([A-Z]{2,10}|(?:\d+(?:\.\d+)?[kmb]?\s+[A-Z]{2,10}))\s+(?:and|&|\+)\s+([A-Z]{2,10}|(?:\d+(?:\.\d+)?[kmb]?\s+[A-Z]{2,10}))\s+(?:to|into|for)/i;

// Enhanced patterns for complex conditional parsing
const REGEX_AMBIGUOUS_OR = /\b(or|either|maybe)\b/i;
const REGEX_MULTIPLE_DESTINATIONS = /(?:to|into|for)\s+([A-Z]{2,10})(?:\s+(?:or|and|\+|,)\s+([A-Z]{2,10}))+/i;
const REGEX_CONDITIONAL = /\b(if|when|only\s+if|provided|assuming|unless)\b/i;
const REGEX_PRICE_CONDITION = /(?:price|value|[A-Z]{2,10})\s*(?:is|goes|hits|reaches|drops?|rises?|falls?)?\s*(above|below|over|under|>|<|>=|<=)\s*\$?(\d+(?:\.\d+)?[kmb]?)/i;

// Enhanced multi-step and fallback patterns
const REGEX_MULTI_STEP = /\b(then|after|next|subsequently|followed\s+by)\b/i;
const REGEX_FALLBACK = /\b(otherwise|else|or\s+else|if\s+not|alternatively)\b/i;
const REGEX_SECONDARY_CONDITION = /\b(and|but|also|plus|additionally)\b.*?\b(if|when|only\s+if|provided|assuming)\b/i;

// Enhanced balance and market condition patterns
const REGEX_BALANCE_CONDITION = /\b(if\s+(?:I\s+)?have|only\s+if\s+(?:my\s+)?balance|provided\s+(?:I\s+)?(?:have|own))\s+(?:(?:more|less)\s+than\s+|at\s+least\s+|over\s+|under\s+)?(\d+(?:\.\d+)?[kmb]?)\s+([A-Z]{2,10})/i;
const REGEX_MARKET_CONDITION = /\b(market|volatility|volume|trend)\s+(?:is\s+)?(good|bad|high|low|bullish|bearish|stable|volatile)/i;

// Enhanced abbreviation handling
const COMMON_TYPOS = {
  'swp': 'swap',
  'cnvrt': 'convert',
  'exchng': 'exchange',
  'trd': 'trade',
  'pls': 'please',
  '2': 'to',
  '4': 'for',
  'u': 'you',
  'ur': 'your',
  'btc': 'BTC',
  'eth': 'ETH',
  'usdc': 'USDC',
  'usdt': 'USDT',
  'bnb': 'BNB',
  'sol': 'SOL',
  'ada': 'ADA',
  'dot': 'DOT',
  'matic': 'MATIC',
  'avax': 'AVAX'
};

// Voice input phonetic corrections
const PHONETIC_CORRECTIONS = {
  'eeth': 'ETH',
  'bit coin': 'BTC',
  'bitcoin': 'BTC',
  'ethereum': 'ETH',
  'you es dee see': 'USDC',
  'tether': 'USDT',
  'solana': 'SOL',
  'cardano': 'ADA',
  'polkadot': 'DOT',
  'polygon': 'MATIC',
  'avalanche': 'AVAX',
  'won': '1',
  'too': '2',
  'tree': '3',
  'for': '4',
  'fiv': '5'
};

// Enhanced number parsing with better scaling
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

// Enhanced input preprocessing
const preprocessInput = (input: string): string => {
  let processed = input.toLowerCase().trim();
  
  // Apply common typo corrections
  Object.entries(COMMON_TYPOS).forEach(([typo, correction]) => {
    const regex = new RegExp(`\\b${typo}\\b`, 'gi');
    processed = processed.replace(regex, correction);
  });
  
  // Apply phonetic corrections for voice input
  Object.entries(PHONETIC_CORRECTIONS).forEach(([phonetic, correction]) => {
    const regex = new RegExp(`\\b${phonetic}\\b`, 'gi');
    processed = processed.replace(regex, correction);
  });
  
  processed = processed.replace(/[-–—]/g, ' to ');
  processed = processed.replace(/→|->/g, ' to ');
  
  return processed;
};

// Enhanced staking patterns for better natural language support
const REGEX_SWAP_STAKE = /(?:swap\s+and\s+stake|zap\s+(?:into|to)|stake\s+(?:my|after|then)|swap\s+(?:to|into)\s+(?:stake|yield))/i;
const REGEX_STAKE_PROTOCOL = /(?:to\s+)?(aave|compound|yearn|lido|morpho|euler|spark|rocket\s*pool|stakewise)/i;

// Enhanced regex for direct stake commands with better natural language support
const REGEX_STAKE_COMMAND = /\b(stake|staking)\b/i;
const REGEX_LIQUID_STAKING_PROVIDER = /\b(lido|rocket\s*pool|rocketpool|stakewise|stake\s*wise|marinade|benqi|ankr)\b/i;

// Enhanced patterns for amount detection in staking commands
const REGEX_STAKE_AMOUNT = /(?:stake|staking)\s+(?:my\s+)?(?:all\s+)?(?:(\d+(?:\.\d+)?[kmb]?)\s+)?([A-Z]{2,10})/i;
const REGEX_STAKE_ALL = /\b(?:stake|staking)\s+(?:all|everything|my\s+entire|my\s+whole)\s+([A-Z]{2,10})/i;
const REGEX_STAKE_PERCENTAGE = /(?:stake|staking)\s+(\d+(?:\.\d+)?)%\s+(?:of\s+)?(?:my\s+)?([A-Z]{2,10})/i;

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
    requiresConfirmation,
    nextActions,
    fallbackAction,
    alternativeInterpretations,
    suggestedClarifications
  }: Partial<ParsedCommand> & { 
    intent: ParsedCommand['intent']; 
    confidence: number;
    nextActions?: NextAction[];
    fallbackAction?: FallbackAction;
    alternativeInterpretations?: string[];
    suggestedClarifications?: string[];
  }
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
  originalInput: userInput,
  ...(nextActions && { nextActions }),
  ...(fallbackAction && { fallbackAction }),
  ...(alternativeInterpretations && { alternativeInterpretations }),
  ...(suggestedClarifications && { suggestedClarifications })
});

/**
 * Enhanced function to parse complex conditional and multi-step commands
 */
interface ComplexConditionalAnalysis {
  hasComplexConditions: boolean;
  primaryCondition?: Condition;
  secondaryConditions?: Array<Record<string, unknown>>;
  multiStep?: boolean;
  nextActions?: NextAction[];
  hasFallback?: boolean;
  fallbackAction?: FallbackAction;
  validationErrors: string[];
  confidence: number;
}

function parseComplexConditional(input: string): ComplexConditionalAnalysis {
  const result: ComplexConditionalAnalysis = {
    hasComplexConditions: false,
    validationErrors: [],
    confidence: 100
  };

  // Check for multi-step commands
  const hasMultiStep = REGEX_MULTI_STEP.test(input);
  if (hasMultiStep) {
    result.hasComplexConditions = true;
    result.multiStep = true;
    
    // Split on multi-step keywords and parse each part
    const parts = input.split(/\b(?:then|after|next|subsequently|followed\s+by)\b/i);
    if (parts.length > 1) {
      result.nextActions = parts.slice(1).map(part => ({
        rawText: part.trim(),
        needsParsing: true
      }));
      result.validationErrors.push("Multi-step execution requires manual confirmation for subsequent actions");
      result.confidence = Math.min(result.confidence, 75);
    }
  }

  // Check for fallback actions
  const hasFallback = REGEX_FALLBACK.test(input);
  if (hasFallback) {
    result.hasComplexConditions = true;
    result.hasFallback = true;
    
    // Split on fallback keywords
    const parts = input.split(/\b(?:otherwise|else|or\s+else|if\s+not|alternatively)\b/i);
    if (parts.length > 1) {
      result.fallbackAction = {
        rawText: parts[1]?.trim(),
        needsParsing: true
      };
      result.confidence = Math.min(result.confidence, 80);
    }
  }

  // Check for secondary conditions
  const hasSecondaryCondition = REGEX_SECONDARY_CONDITION.test(input);
  if (hasSecondaryCondition) {
    result.hasComplexConditions = true;
    result.secondaryConditions = [];
    
    // Look for balance conditions
    const balanceMatch = input.match(REGEX_BALANCE_CONDITION);
    if (balanceMatch) {
      const [, amount, asset] = balanceMatch;
      result.secondaryConditions.push({
        type: 'balance_threshold',
        asset: asset?.toUpperCase(),
        value: parseScaledNumber(amount as string),
        operator: 'gte',
        logic: 'AND'
      });
    }

    // Look for market conditions
    const marketMatch = input.match(REGEX_MARKET_CONDITION);
    if (marketMatch) {
      result.secondaryConditions.push({
        type: 'market_condition',
        condition: marketMatch[2]?.toLowerCase(),
        logic: 'AND'
      });
      result.validationErrors.push(`Market condition '${marketMatch[2]}' cannot be automatically evaluated`);
      result.confidence = Math.min(result.confidence, 60);
    }
  }

  // Enhanced price condition parsing
  const priceMatch = input.match(REGEX_PRICE_CONDITION);
  if (priceMatch) {
    const [, operator, rawValue] = priceMatch;
    const value = parseScaledNumber(rawValue as string);

    if (!isNaN(value)) {
      result.hasComplexConditions = true;
      result.primaryCondition = {
        type: ['above', 'over', '>', '>='].includes(operator!.toLowerCase()) ? 'price_above' : 'price_below',
        asset: 'BTC', // Default, should be extracted from context
        value,
        operator: ['above', 'over', '>', '>='].includes(operator!.toLowerCase()) ? 'gte' : 'lte'
      };
    }
  }

  return result;
}

export async function parseUserCommand(
  userInput: string,
  conversationHistory: Array<Record<string, string>> = [],
  inputType: 'text' | 'voice' = 'text'
): Promise<ParseResult> {
  // Graceful handling if someone passes a boolean for legacy fallbackToLLM
  if (typeof conversationHistory === 'boolean') {
    conversationHistory = [];
  }

  if (!userInput?.trim()) {
    return {
      success: false,
      validationErrors: ['Input cannot be empty'],
      confidence: 0,
      parsedMessage: 'No input provided',
      requiresConfirmation: false,
      originalInput: userInput
    };
  }

  const originalInput = userInput;
  const preprocessedInput = preprocessInput(userInput);
  
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
    
    const amount = amountMatch ? parseScaledNumber(amountMatch[1] as string) : null;
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

  // Enhanced conditional parsing with complex command support
  if (hasConditionals) {
    const complexAnalysis = parseComplexConditional(preprocessedInput);
    
    if (complexAnalysis.hasComplexConditions) {
      // Handle complex multi-condition or multi-step commands
      const priceCondition = preprocessedInput.match(REGEX_PRICE_CONDITION);
      if (priceCondition) {
        const [, operator, rawValue] = priceCondition;
        const value = parseScaledNumber(rawValue as string);

        if (!isNaN(value)) {
          const conditionType = ['above', 'over', '>', '>='].includes(operator!.toLowerCase()) 
            ? 'price_above' : 'price_below';
          
          // Try to extract basic swap info
          const tokenMatch = preprocessedInput.match(REGEX_TOKENS);
          const amountMatch = preprocessedInput.match(REGEX_AMOUNT_TOKEN);
          
          // Build enhanced conditions object
          const conditions: any = {
            type: conditionType,
            asset: tokenMatch?.[3] || 'BTC',
            value,
            operator: conditionType === 'price_above' ? 'gte' : 'lte'
          };

          // Add secondary conditions if present
          if (complexAnalysis.secondaryConditions?.length) {
            conditions.secondary_conditions = complexAnalysis.secondaryConditions;
          }

          // Add fallback action if present
          if (complexAnalysis.fallbackAction) {
            conditions.fallback_action = complexAnalysis.fallbackAction;
          }

          const result = buildSwapResult(originalInput, {
            intent: 'limit_order',
            fromAsset: tokenMatch?.[1] || (amountMatch?.[2]),
            toAsset: tokenMatch?.[3],
            amount: amountMatch ? parseScaledNumber(amountMatch[1] as string) : null,
            amountType: amountMatch ? 'exact' : null,
            conditions,
            confidence: complexAnalysis.confidence,
            requiresConfirmation: true,
            nextActions: complexAnalysis.nextActions,
            fallbackAction: complexAnalysis.fallbackAction,
            alternativeInterpretations: complexAnalysis.hasFallback ? [
              "Set up multiple separate orders",
              "Create conditional order with manual fallback"
            ] : undefined,
            suggestedClarifications: complexAnalysis.validationErrors.length > 0 ? [
              "Should I break this into multiple simpler commands?",
              "Which conditions are most important to you?"
            ] : undefined
          });

          // Add validation errors from complex analysis
          result.validationErrors = complexAnalysis.validationErrors;
          
          return result;
        }
      }
    } else {
      // Handle simple conditional commands (existing logic)
      const priceCondition = preprocessedInput.match(REGEX_PRICE_CONDITION);
      if (priceCondition) {
        const [, operator, rawValue] = priceCondition;
        const value = parseScaledNumber(rawValue as string);

        if (!isNaN(value)) {
          const conditionType = ['above', 'over', '>', '>='].includes(operator!.toLowerCase()) 
            ? 'price_above' : 'price_below';
          
          // Try to extract basic swap info
          const tokenMatch = preprocessedInput.match(REGEX_TOKENS);
          const amountMatch = preprocessedInput.match(REGEX_AMOUNT_TOKEN);
          
          return buildSwapResult(originalInput, {
            intent: 'limit_order',
            fromAsset: tokenMatch?.[1] || (amountMatch?.[2]),
            toAsset: tokenMatch?.[3],
            amount: amountMatch ? parseScaledNumber(amountMatch[1] as string) : null,
            amountType: amountMatch ? 'exact' : null,
            conditions: {
              type: conditionType as "price_above" | "price_below",
              asset: tokenMatch?.[3] || 'BTC',
              value
            },
            confidence: 75,
            requiresConfirmation: true
          });
        }
      }
    }
  }

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
    if (amtMatch) amount = parseFloat(amtMatch[1] as string);

    const fromToMatch = input.match(/([A-Z]{2,10})\s+(?:to|into|for)\s+([A-Z]{2,10})/i);
    if (fromToMatch) {
      fromAsset = fromToMatch[1]!.toUpperCase();
      toAsset = fromToMatch[2]!.toUpperCase();
    }

    if (!fromAsset) {
      const singleAsset = input.match(/\b([A-Z]{2,10})\b/);
      if (singleAsset) fromAsset = singleAsset[1]!.toUpperCase();
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

  // Enhanced staking command detection and parsing
  if (REGEX_STAKE_COMMAND.test(input) && !REGEX_SWAP_STAKE.test(input)) {
    const providerMatch = input.match(REGEX_LIQUID_STAKING_PROVIDER);
    const stakeProtocol = providerMatch ? providerMatch[1]?.toLowerCase().replace(/\s+/g, '_') : 'lido';

    let amount: number | null = null;
    let amountType: 'exact' | 'percentage' | 'all' | null = null;
    let stakeAsset: string | null = null;

    // Check for "stake all" patterns
    const allMatch = input.match(REGEX_STAKE_ALL);
    if (allMatch) {
      stakeAsset = allMatch[1]!.toUpperCase();
      amountType = 'all';
    }

    // Check for percentage patterns
    const percentageMatch = input.match(REGEX_STAKE_PERCENTAGE);
    if (percentageMatch && !allMatch) {
      amount = parseFloat(percentageMatch[1]!);
      stakeAsset = percentageMatch[2]!.toUpperCase();
      amountType = 'percentage';
    }

    // Check for exact amount patterns
    const amountMatch = input.match(REGEX_STAKE_AMOUNT);
    if (amountMatch && !allMatch && !percentageMatch) {
      if (amountMatch[1]) {
        amount = parseScaledNumber(amountMatch[1]);
        amountType = 'exact';
      }
      stakeAsset = amountMatch[2]!.toUpperCase();
    }

    // Fallback: try to find asset after "stake" keyword
    if (!stakeAsset) {
      const assetMatch = input.match(/stake\s+(?:my\s+)?(?:some\s+)?([A-Z]{2,10})/i);
      if (assetMatch) {
        stakeAsset = assetMatch[1]!.toUpperCase();
      }
    }

    // Default to ETH if no asset specified
    if (!stakeAsset) {
      stakeAsset = 'ETH';
    }

    // Enhanced asset to LST mapping with more protocols
    let toAsset = 'stETH';
    let toChain = 'ethereum';
    
    if (stakeAsset === 'ETH') {
      if (stakeProtocol === 'rocket_pool' || stakeProtocol === 'rocketpool') {
        toAsset = 'rETH';
      } else if (stakeProtocol === 'stakewise') {
        toAsset = 'osETH';
      } else {
        toAsset = 'stETH'; // Default to Lido
      }
      toChain = 'ethereum';
    } else if (stakeAsset === 'SOL') {
      toAsset = 'mSOL';
      toChain = 'solana';
    } else if (stakeAsset === 'MATIC') {
      toAsset = 'stMATIC';
      toChain = 'polygon';
    } else if (stakeAsset === 'AVAX') {
      toAsset = 'sAVAX';
      toChain = 'avalanche';
    } else if (stakeAsset === 'BNB') {
      toAsset = 'ankrBNB';
      toChain = 'bsc';
    }

    // Determine confidence based on completeness
    let confidence = 85;
    if (!amount && amountType !== 'all') {
      confidence = 60; // Lower confidence when amount is missing
    }

    const validationErrors: string[] = [];
    if (!amount && amountType !== 'all') {
      validationErrors.push('Amount not specified. How much would you like to stake?');
    }

    return {
      success: true,
      intent: 'swap_and_stake',
      fromAsset: stakeAsset,
      fromChain: stakeAsset === 'SOL' ? 'solana' : 
                 stakeAsset === 'MATIC' ? 'polygon' :
                 stakeAsset === 'AVAX' ? 'avalanche' :
                 stakeAsset === 'BNB' ? 'bsc' : 'ethereum',
      toAsset: toAsset,
      toChain: toChain,
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
      confidence,
      validationErrors,
      parsedMessage: `Parsed: Stake ${amount || amountType || '?'} ${stakeAsset} -> ${toAsset} via ${stakeProtocol}`,
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
      fromAsset = fromToMatch[1]!.toUpperCase();
      toAsset = (fromToMatch[3] ?? fromToMatch[2])!.toUpperCase();
      confidence += 35;
    }

    const buyWithMatch = input.match(/\bbuy\s+(\d+(?:\.\d+)?)\s+([A-Z]{2,10})\s+with\s+([A-Z]{2,10})\b/i);
    if (buyWithMatch) {
      amount = parseFloat(buyWithMatch[1] as string);
      amountType = 'exact';
      toAsset = buyWithMatch[2]!.toUpperCase();
      fromAsset = buyWithMatch[3]!.toUpperCase();
      confidence += 35;
    }

    const explicitToMatch = input.match(/\b(?:to|into|for)\s+([A-Z]{2,10})\b/i);
    if (!toAsset && explicitToMatch) {
      toAsset = explicitToMatch[1]!.toUpperCase();
      confidence += 10;
    }

    const percentageMatch = input.match(/(\d+(?:\.\d+)?)\s*(?:%|percent)/i);
    if (percentageMatch) {
      amount = parseFloat(percentageMatch[1] as string);
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
        const candidate = ofAsset[1]!.toUpperCase();
        if (!stopWords.includes(candidate)) fromAsset = candidate;
      }

      if (!fromAsset) {
        const afterPercentAsset = input.match(/(?:%|percent|half)\s+(?:of\s+(?:my\s+)?)?([A-Z]{2,10})\b/i);
        if (afterPercentAsset) {
          const candidate = afterPercentAsset[1]!.toUpperCase();
          if (!stopWords.includes(candidate)) fromAsset = candidate;
        }
      }

      if (!fromAsset) {
        const tokenCandidates = [...input.toUpperCase().matchAll(/\b([A-Z]{2,10})\b/g)].map((m) => m[1]);
        const filtered = tokenCandidates.filter((t) => !stopWords.includes(t as string));
        if (filtered.length) fromAsset = filtered[filtered.length - 1] as string;
      }
    }

    const worthSourceMatch = input.match(/\b(?:swap|convert|sell|buy|send|transfer|move|exchange)\s+([A-Z]{2,10})\s+worth\b/i);
    if (!fromAsset && worthSourceMatch) {
      fromAsset = worthSourceMatch[1]!.toUpperCase();
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
      amount = parseFloat(amtMatch[1] as string);
      amountType = 'exact';
      if (!fromAsset) fromAsset = amtMatch[2]!.toUpperCase();
      confidence += 20;
    }

    if (!fromAsset) {
      const verbAsset = input.match(/\b(?:swap|convert|send|transfer|buy|sell|move|exchange)\s+(?:my\s+)?([A-Z]{2,10})\b/i);
      if (verbAsset) {
        const candidate = verbAsset[1]!.toUpperCase();
        if (!['ALL','EVERYTHING','MAX','ENTIRE','BALANCE','HALF'].includes(candidate)) fromAsset = candidate;
      }
    }

    const exclusionMatch = input.match(/(?:except|but\s+keep)\s+(\d+(?:\.\d+)?)(?:\s*%|\s+([A-Z]{2,10}))?/i);
    if (exclusionMatch) {
      excludeAmount = parseFloat(exclusionMatch[1] as string);
      excludeToken = exclusionMatch[2]?.toUpperCase() ?? fromAsset ?? undefined;
    }

    const quoteMatch = input.match(/\bworth\s+(\d+(?:\.\d+)?)\s+([A-Z]{2,10})\b/i);
    if (quoteMatch) {
      quoteAmount = parseFloat(quoteMatch[1] as string);
      if (!toAsset) toAsset = quoteMatch[2]!.toUpperCase();
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

      conditionValue = parseScaledNumber(rawValue as string);
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
      if (allAssetMatch) fromAsset = allAssetMatch[1]!.toUpperCase();
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

  /* ───────────── LIMIT ORDER & DCA ───────────── */
  if (isLimitOrDca) {
    // Only treat as DCA if the input clearly indicates recurrence; otherwise,
    // let limit-order parsing handle it later in this branch.
    const hasDcaRecurrenceCue = /\b(every|daily|weekly|monthly|recurring|recurrence|dca)\b/i.test(
      input
    );

    if (hasDcaRecurrenceCue) {
      const dcaConfig = parseDCA(input);
      if (dcaConfig && dcaConfig.amount) {
        return {
          success: true,
          intent: 'dca',
          fromAsset: 'USDC', // Default source for DCA usually
          fromChain: null,
          toAsset: dcaConfig.targetAsset ?? 'BTC', // Default target fallback
          toChain: null,
          amount: dcaConfig.amount ?? null,
          amountType: dcaConfig.amountType ?? 'exact',
          frequency: dcaConfig.frequency || 'daily',
          dayOfWeek:
            dcaConfig.dayOfWeek !== undefined
              ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dcaConfig.dayOfWeek]
              : null,
          dayOfMonth: dcaConfig.dayOfMonth?.toString() || null,
          excludeAmount: undefined,
          excludeToken: undefined,
          quoteAmount: undefined,
          conditions: undefined,
          portfolio: undefined,
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
          parsedMessage: `Parsed: DCA $${dcaConfig.amount} into ${dcaConfig.targetAsset || 'BTC'} ${dcaConfig.frequency || 'daily'}`,
          requiresConfirmation: true,
          originalInput: userInput
        };
      }
    }

    const limitConfig = detectLimitOrder(input);
    if (limitConfig && limitConfig.price) {
      const tradeAsset = limitConfig.asset ?? 'ETH';
      const quoteAsset = limitConfig.targetAsset ?? (tradeAsset === 'USDC' ? 'ETH' : 'USDC');
      const isBuyBelow = limitConfig.condition === 'below';
      return {
        success: true,
        intent: 'limit_order',
        fromAsset: isBuyBelow ? quoteAsset : tradeAsset,
        fromChain: null,
        toAsset: isBuyBelow ? tradeAsset : quoteAsset,
        toChain: null,
        amount: limitConfig.amount ?? null,
        amountType: limitConfig.amountType ?? null,
        targetPrice: limitConfig.price,
        condition: limitConfig.condition,
        // Map to new condition format
        conditions: {
            type: limitConfig.condition === 'above' ? 'price_above' : 'price_below',
            asset: limitConfig.asset ?? 'ETH',
            value: limitConfig.price
        },
        excludeAmount: undefined,
        excludeToken: undefined,
        quoteAmount: undefined,
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
        conditionOperator: limitConfig.condition === 'above' ? 'gt' : 'lt',
        conditionValue: limitConfig.price,
        conditionAsset: limitConfig.asset,
        confidence: 90,
        validationErrors: [],
        parsedMessage: `Parsed: Limit Order - ${limitConfig.condition} $${limitConfig.price}`,
        requiresConfirmation: true,
        originalInput: userInput
      };
    }
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
