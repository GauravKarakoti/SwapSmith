import { parseWithLLM, ParsedCommand } from './groq-client';
import logger from './logger';

export { ParsedCommand };

// Define a union type for the result to handle validationErrors safely
export type ParseResult = ParsedCommand | {
    success: false;
    validationErrors: string[];
    intent?: string;
    confidence?: number;
    parsedMessage?: string;
    requiresConfirmation?: boolean;
    originalInput?: string;
    [key: string]: any;
};

// Regex Patterns
const REGEX_EXCLUSION = /(?:everything|all|entire|max)\s*(?:[A-Z]+\s+)?(?:except|but\s+keep)\s+(\d+(\.\d+)?)\s*([A-Z]+)?/i;
const REGEX_PERCENTAGE = /(\d+(\.\d+)?)\s*(?:%|percent)\s*(?:of\s+(?:my\s+)?)?([A-Z]+)?/i;
const REGEX_HALF = /\b(half)\b\s*(?:of\s+(?:my\s+)?)?([A-Z]+)?/i;
const REGEX_QUARTER = /\b(quarter)\b\s*(?:of\s+(?:my\s+)?)?([A-Z]+)?/i;
const REGEX_MAX_ALL = /\b(max|all|everything|entire)\b/i;
const REGEX_ALL_TOKEN = /(max|all|everything|entire)\s+([A-Z]+)/i; // "all ETH"

const REGEX_TOKENS = /([A-Z]+)\s+(to|into|for)\s+([A-Z]+)/i; // "ETH to BTC"
const REGEX_FROM_TO = /from\s+([A-Z]+)\s+to\s+([A-Z]+)/i; // "from ETH to BTC"
const REGEX_AMOUNT_TOKEN = /\b(\d+(\.\d+)?)\s+(?!to|into|for|from|with|using\b)([A-Z]+)\b/i; // "10 ETH" (exclude prepositions)

// New Regex for Conditions
const REGEX_CONDITION = /(?:if|when)\s+(?:the\s+)?(?:price|rate|market|value)?\s*(?:of\s+)?([A-Z]+)?\s*(?:is|goes|drops|rises|falls)?\s*(above|below|greater|less|more|under|>|<)\s*(?:than)?\s*(\$?[\d,]+(\.\d+)?\s*[kKmM]?)/i;

// New Regex for Quote Amount ("Worth")
const REGEX_QUOTE = /(?:([A-Z]+)\s+)?(?:worth|value|valued\s+at)\s*(?:of)?\s*(\$)?(\d+(\.\d+)?)\s*([A-Z]+)?/i;

// New Regex for Multiple Source Assets
const REGEX_MULTI_SOURCE = /([A-Z]+)\s+(?:and|&)\s+([A-Z]+)\s+(?:to|into|for)/i;

// New Regex for Swap and Stake / Zap intents
const REGEX_SWAP_STAKE = /(?:swap\s+and\s+stake|zap\s+(?:into|to)|stake\s+(?:my|after|then)|swap\s+(?:to|into)\s+(?:stake|yield))/i;
const REGEX_STAKE_PROTOCOL = /(?:to\s+)?(aave|compound|yearn|lido|morpho|euler|spark)/i;

// New Regex for Trailing Stop Orders
const REGEX_TRAILING_STOP = /(?:trailing\s+stop|stop\s+loss|protect\s+profit|trailing)/i;
const REGEX_TRAILING_PERCENTAGE = /(\d+(\.\d+)?)\s*(?:%|percent)\s*(?:trailing|stop|drop|decline|fall)/i;
const REGEX_TRAILING_AMOUNT = /(?:trailing\s+stop|stop\s+loss)\s+(?:at\s+)?(\d+(\.\d+)?)\s*(?:%|percent)/i;


function normalizeNumber(val: string): number {
  val = val.toLowerCase().replace(/[\$,]/g, '');

  if (val.endsWith("k")) {
    return parseFloat(val) * 1000;
  }
  if (val.endsWith("m")) {
    return parseFloat(val) * 1000000;
  }
  return parseFloat(val);
}

export async function parseUserCommand(
  userInput: string,
  conversationHistory: any[] = [],
  inputType: 'text' | 'voice' = 'text'
): Promise<ParseResult> {
  let input = userInput.trim();

  // Pre-processing: Remove fillers
  input = input.replace(/^(hey|hi|hello|please|kindly|can you)\s+/i, '')
               .replace(/\s+(please|kindly|immediately|now|right now)$/i, '')
               .replace(/\b(like)\b/gi, '') // "swap like 100" -> "swap 100"
               .trim();

  // Check for Trailing Stop Intent
  if (REGEX_TRAILING_STOP.test(input)) {
    let amount: number | null = null;
    let trailingPercentage: number | null = null;
    let fromAsset: string | null = null;
    let toAsset: string | null = null;

    // Extract trailing percentage
    const trailingMatch = input.match(REGEX_TRAILING_PERCENTAGE) || input.match(REGEX_TRAILING_AMOUNT);
    if (trailingMatch) {
      trailingPercentage = parseFloat(trailingMatch[1]);
    }

    // Extract amount
    const amtMatch = input.match(/\b(\d+(\.\d+)?)\b/);
    if (amtMatch) {
      amount = parseFloat(amtMatch[1]);
    }

    // Extract tokens
    const fromToMatch = input.match(/([A-Z]{2,5})\s+(?:to|into)\s+([A-Z]{2,5})/i);
    if (fromToMatch) {
      fromAsset = fromToMatch[1].toUpperCase();
      toAsset = fromToMatch[2].toUpperCase();
    } else {
      // Try to find single token
      const tokenMatch = input.match(/([A-Z]{2,5})/);
      if (tokenMatch) {
        fromAsset = tokenMatch[1].toUpperCase();
        toAsset = 'USDC'; // Default to stablecoin
      }
    }

    // Default trailing percentage if not specified
    if (!trailingPercentage) {
      trailingPercentage = 5.0; // Default 5% trailing stop
    }

    return {
      success: true,
      intent: 'trailing_stop',
      fromAsset: fromAsset || null,
      fromChain: null,
      toAsset: toAsset || 'USDC',
      toChain: null,
      amount: amount || null,
      amountType: amount ? 'exact' : null,
      trailingPercentage,
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
      confidence: 85,
      validationErrors: [],
      parsedMessage: `Parsed: Trailing stop order - Sell ${amount || '?'} ${fromAsset || '?'} if price drops ${trailingPercentage}% from peak`,
      requiresConfirmation: true,
      originalInput: userInput
    };
  }

  // Check for Swap and Stake / Zap Intent
  if (REGEX_SWAP_STAKE.test(input)) {

    const protocolMatch = input.match(REGEX_STAKE_PROTOCOL);
    const stakeProtocol = protocolMatch ? protocolMatch[1].toLowerCase() : null;
    
    let amount: number | null = null;
    let fromAsset: string | null = null;
    let toAsset: string | null = null;
    
    const amtMatch = input.match(/\b(\d+(\.\d+)?)\b/);
    if (amtMatch) {
      amount = parseFloat(amtMatch[1]);
    }
    
    const fromToMatch = input.match(/([A-Z]{2,5})\s+(?:to|into)\s+([A-Z]{2,5})/i);
    if (fromToMatch) {
      fromAsset = fromToMatch[1].toUpperCase();
      toAsset = fromToMatch[2].toUpperCase();
    }
    
    if (!toAsset) {
      toAsset = 'USDC';
    }
    
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
      parsedMessage: `Parsed: Swap ${amount || '?'} ${fromAsset || '?'} to ${toAsset} and stake`,
      requiresConfirmation: true,
      originalInput: userInput
    };
  }

  // 1. Check for Swap Intent Keywords
  const isSwapRelated = /\b(swap|convert|send|transfer|buy|sell|move|exchange)\b/i.test(input);

  if (isSwapRelated) {
    let intent: ParsedCommand['intent'] = 'swap';
    let amountType: ParsedCommand['amountType'] = null;
    let amount: number | null = null;
    let excludeAmount: number | undefined;
    let excludeToken: string | undefined;
    let quoteAmount: number | undefined;
    let fromAsset: string | null = null;
    let toAsset: string | null = null;
    let confidence = 0;
    let validationErrors: string[] = [];

    // Boost confidence slightly for explicit swap keywords
    confidence += 10;

    // Limit Order fields
    let conditionOperator: 'gt' | 'lt' | undefined;
    let conditionValue: number | undefined;
    let conditionAsset: string | undefined;
    let conditions: ParsedCommand['conditions'];

    // Check Multi-source
    if (REGEX_MULTI_SOURCE.test(input)) {
        validationErrors.push('Multiple source assets not supported');
        return {
             success: false,
             intent: 'swap',
             fromAsset: null, fromChain: null, toAsset: null, toChain: null, amount: null,
             settleAsset: null, settleNetwork: null, settleAmount: null, settleAddress: null,
             fromProject: null, fromYield: null, toProject: null, toYield: null,
             validationErrors,
             confidence: 0,
             parsedMessage: 'Multiple source assets detected',
             requiresConfirmation: false,
             originalInput: userInput
        };
    }

    // A. Detect Exclusion
    const exclusionMatch = input.match(REGEX_EXCLUSION);
    if (exclusionMatch) {
      amountType = 'all';
      excludeAmount = parseFloat(exclusionMatch[1]);
      if (exclusionMatch[3]) {
        excludeToken = exclusionMatch[3].toUpperCase();
        if (!fromAsset) fromAsset = excludeToken;
      }
      confidence += 40;
    }

    // Attempt to extract token from "all [Token]" if we identified 'all' but missed the token
    if (amountType === 'all' && !fromAsset) {
        const allTokenMatch = input.match(REGEX_ALL_TOKEN);
        if (allTokenMatch) {
             const token = allTokenMatch[2].toUpperCase();
             if (!/^(swap|convert|send|transfer|buy|sell|move|exchange)$/i.test(token)) {
                 fromAsset = token;
             }
        }
    }

    // B. Detect Percentage / Max
    if (amountType !== 'all') { 
      const pctMatch = input.match(REGEX_PERCENTAGE);
      if (pctMatch) {
        amountType = 'percentage';
        amount = parseFloat(pctMatch[1]);
        if (pctMatch[3]) fromAsset = pctMatch[3].toUpperCase();
        confidence += 40;
      } else {
        const halfMatch = input.match(REGEX_HALF);
        if (halfMatch) {
            amountType = 'percentage';
            amount = 50;
            if (halfMatch[2]) fromAsset = halfMatch[2].toUpperCase();
            confidence += 40;
        } else {
            const quarterMatch = input.match(REGEX_QUARTER);
            if (quarterMatch) {
                amountType = 'percentage';
                amount = 25;
                if (quarterMatch[2]) fromAsset = quarterMatch[2].toUpperCase();
                confidence += 40;
            } else if (REGEX_MAX_ALL.test(input)) {
                amountType = 'all';
                const allTokenMatch = input.match(REGEX_ALL_TOKEN);
                if (allTokenMatch) {
                    fromAsset = allTokenMatch[2].toUpperCase();
                }
                confidence += 30;
            }
        }
      }
    }

    // C. Detect Quote Amount ("Worth")
    const quoteMatch = input.match(REGEX_QUOTE);
    if (quoteMatch) {
        if (quoteMatch[1]) {
             const candidate = quoteMatch[1].toUpperCase();
             if (!/^(swap|convert|send|transfer|buy|sell|move|exchange)$/i.test(candidate)) {
                 if (!fromAsset) fromAsset = candidate;
             }
        }
        quoteAmount = parseFloat(quoteMatch[3]);
        if (quoteMatch[5]) {
            if (!toAsset) toAsset = quoteMatch[5].toUpperCase();
        }
        confidence += 30;
    }

    // D. Detect Tokens
    if (!fromAsset || !toAsset) {
        const fromToMatch = input.match(REGEX_FROM_TO);
        if (fromToMatch) {
            fromAsset = fromToMatch[1].toUpperCase();
            toAsset = fromToMatch[2].toUpperCase();
            confidence += 40;
        } else {
            const tokenMatch = input.match(REGEX_TOKENS);
            if (tokenMatch) {
                const token1 = tokenMatch[1].toUpperCase();
                const token2 = tokenMatch[3].toUpperCase();
                const isVerb = /^(swap|convert|send|transfer|buy|sell|move|exchange)$/i.test(token1);

                if (!isVerb) {
                    if (fromAsset && fromAsset !== token1) {
                    } else {
                        fromAsset = token1;
                    }
                    toAsset = token2;
                    confidence += 30;
                }
            }
        }
    }

    // E. Detect Numeric Amount
    if (!amount && amountType === null && !quoteAmount) {
       const amtTokenMatch = input.match(REGEX_AMOUNT_TOKEN);
       if (amtTokenMatch) {
           amount = parseFloat(amtTokenMatch[1]);
           amountType = 'exact';
           if (!fromAsset) fromAsset = amtTokenMatch[3].toUpperCase();
           confidence += 20;
       } else {
           const numMatch = input.match(/\b(\d+(\.\d+)?)\b/);
           if (numMatch) {
               if (amountType !== 'all') { 
                   amount = parseFloat(numMatch[1]);
                   amountType = 'exact';
                   confidence += 10;
               }
           }
       }
    }

    // F. Detect Limit Order Condition
    const conditionMatch = input.match(REGEX_CONDITION);
    if (conditionMatch) {
        intent = 'limit_order';
        const assetStr = conditionMatch[1];
        const operatorStr = conditionMatch[2].toLowerCase();
        const valueStr = conditionMatch[3];

        conditionValue = normalizeNumber(valueStr);

        if (assetStr) {
            const candidate = assetStr.toUpperCase();
            const ignoredWords = ['IS', 'GOES', 'DROPS', 'RISES', 'FALLS', 'THE', 'PRICE', 'OF'];
            if (!ignoredWords.includes(candidate)) {
                conditionAsset = candidate;
            }
        }

        // Logic fix: "drops below" -> lt, "rises above" -> gt
        if (operatorStr.includes('below') || operatorStr.includes('less') || operatorStr.includes('under') || operatorStr.includes('<') || operatorStr.includes('drops') || operatorStr.includes('falls')) {
            conditionOperator = 'lt';
        } else {
            conditionOperator = 'gt';
        }

        if (conditionValue) {
            conditions = {
                type: conditionOperator === 'gt' ? "price_above" : "price_below",
                asset: conditionAsset || fromAsset || 'ETH',
                value: conditionValue
            };
        }

        confidence += 30;
    }

    if (conditionOperator && conditionValue) {
        conditions = {
            type: conditionOperator === 'gt' ? 'price_above' : 'price_below',
            asset: conditionAsset || fromAsset || 'ETH',
            value: conditionValue
        };
    }

    if (confidence >= 30) {
        if ((conditionOperator || conditionValue) && !conditionAsset && fromAsset) {
            conditionAsset = fromAsset;
        }

        if (conditions && !conditions.asset && conditionAsset) {
            conditions.asset = conditionAsset;
        }

        let parsedMessage = `Parsed: ${amountType || amount || (quoteAmount ? 'Value ' + quoteAmount : '?')} ${fromAsset || '?'} -> ${toAsset || '?'}`;
        if (conditionOperator && conditionValue) {
            parsedMessage += ` if ${conditionAsset || fromAsset} ${conditionOperator === 'gt' ? '>' : '<'} ${conditionValue}`;
        }

        return {
            success: true,
            intent: intent,
            fromAsset: fromAsset || null,
            fromChain: null,
            toAsset: toAsset || null,
            toChain: null,
            amount: amount || null,
            amountType: amountType || 'exact',
            excludeAmount,
            excludeToken,
            quoteAmount,
            conditions,
            portfolio: undefined,
            frequency: null, dayOfWeek: null, dayOfMonth: null,
            settleAsset: null, settleNetwork: null, settleAmount: null, settleAddress: null,
            fromProject: null, fromYield: null, toProject: null, toYield: null,

            conditionOperator,
            conditionValue,
            conditionAsset,
            targetPrice: conditionValue,
            condition: conditionOperator === 'gt' ? 'above' : 'below',

            confidence: Math.min(100, confidence + 30),
            validationErrors: [],
            parsedMessage,
            requiresConfirmation: false,
            originalInput: userInput
        };
    }
  }

  // 2. Fallback to LLM
  logger.info("Fallback to LLM for:", userInput);
  try {
    const result = await parseWithLLM(userInput, conversationHistory, inputType);

    if (!result.conditions) {
        const text = userInput.toLowerCase();
        const aboveMatch = text.match(/above\s+(\d+(?:k|m)?)/i);
        const belowMatch = text.match(/below\s+(\d+(?:k|m)?)/i);

        if (aboveMatch) {
            result.conditions = {
                type: "price_above",
                asset: result.toAsset || result.fromAsset || 'ETH',
                value: normalizeNumber(aboveMatch[1])
            };
        } else if (belowMatch) {
             result.conditions = {
                type: "price_below",
                asset: result.toAsset || result.fromAsset || 'ETH',
                value: normalizeNumber(belowMatch[1])
            };
        }
    }

    if (userInput.includes("%")) {
       result.amountType = "percentage";
    }

    return {
      ...result,
      amountType: result.amountType || null,
      excludeAmount: result.excludeAmount || undefined,
      excludeToken: result.excludeToken || undefined,
      quoteAmount: result.quoteAmount || undefined,
      conditions: result.conditions || undefined,
      originalInput: userInput
    };
  } catch (error) {
     logger.error("LLM Error", error);
     return {
        success: false,
        intent: 'unknown',
        confidence: 0,
        validationErrors: ['Parsing failed'],
        parsedMessage: '',
        fromAsset: null, fromChain: null, toAsset: null, toChain: null, amount: null,
        settleAsset: null, settleNetwork: null, settleAmount: null, settleAddress: null,
        fromProject: null, fromYield: null, toProject: null, toYield: null,
        requiresConfirmation: false,
        originalInput: userInput
     };
  }
}
