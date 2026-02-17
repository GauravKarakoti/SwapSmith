import { parseWithLLM, ParsedCommand } from './groq-client';
import logger from './logger';

export { ParsedCommand };


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
const REGEX_CONDITION = /(?:if|when)\s+(?:the\s+)?(?:price|rate|market|value)?\s*(?:of\s+)?([A-Z]+)?\s*(?:is|goes|drops|rises|falls)?\s*(above|below|greater|less|more|under|>|<)\s*(?:than)?\s*(\$?[\d,]+(\.\d+)?)/i;

// New Regex for Quote Amount ("Worth")
// Capture optional preceding token (group 1), amount (group 3), optional following token (group 5)
const REGEX_QUOTE = /(?:([A-Z]+)\s+)?(?:worth|value|valued\s+at)\s*(?:of)?\s*(\$)?(\d+(\.\d+)?)\s*([A-Z]+)?/i;

// New Regex for Multiple Source Assets
const REGEX_MULTI_SOURCE = /([A-Z]+)\s+(?:and|&)\s+([A-Z]+)\s+(?:to|into|for)/i;

export async function parseUserCommand(
  userInput: string,
  conversationHistory: any[] = [],
  inputType: 'text' | 'voice' = 'text'
): Promise<ParsedCommand> {
  let input = userInput.trim();

  // Pre-processing: Remove fillers
  input = input.replace(/^(hey|hi|hello|please|kindly|can you)\s+/i, '')
               .replace(/\s+(please|kindly|immediately|now|right now)$/i, '')
               .replace(/\b(like)\b/gi, '') // "swap like 100" -> "swap 100"
               .trim();

  // 1. Check for Swap Intent Keywords
  // Expanded list to catch more variations
  const isSwapRelated = /\b(swap|convert|send|transfer|buy|sell|move|exchange)\b/i.test(input);

  if (isSwapRelated) {
    let intent: ParsedCommand['intent'] = 'swap';
    let amountType: ParsedCommand['amountType'] = null; // Default to null, set to 'exact' later if needed
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

    // Check Multi-source
    if (REGEX_MULTI_SOURCE.test(input)) {
        validationErrors.push('Multiple source assets not supported');
        // We can stop here or continue parsing. If we stop, we return failure.
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
        // If exclude token is present, it's likely the source asset too
        if (!fromAsset) fromAsset = excludeToken;
      }
      confidence += 40;
    }

    // Attempt to extract token from "all [Token]" if we identified 'all' but missed the token
    if (amountType === 'all' && !fromAsset) {
        const allTokenMatch = input.match(REGEX_ALL_TOKEN);
        if (allTokenMatch) {
             const token = allTokenMatch[2].toUpperCase();
             // Avoid verbs
             if (!/^(swap|convert|send|transfer|buy|sell|move|exchange)$/i.test(token)) {
                 fromAsset = token;
             }
        }
    }

    // B. Detect Percentage / Max
    if (amountType !== 'all') { // Only check if not already exclusion (which implies all)
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
    // Needs to be checked before tokens to capture implied intent
    const quoteMatch = input.match(REGEX_QUOTE);
    if (quoteMatch) {
        // Group 1: Preceding token
        if (quoteMatch[1]) {
             const candidate = quoteMatch[1].toUpperCase();
             if (!/^(swap|convert|send|transfer|buy|sell|move|exchange)$/i.test(candidate)) {
                 if (!fromAsset) fromAsset = candidate;
             }
        }

        // Group 3: Amount
        quoteAmount = parseFloat(quoteMatch[3]);

        // Group 5: Following token (quote currency / toAsset)
        if (quoteMatch[5]) {
            if (!toAsset) toAsset = quoteMatch[5].toUpperCase();
        }
        confidence += 30;
    }

    // D. Detect Tokens (Source and Dest)
    // Priority: "from X to Y" > "X to Y"

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

                // Ensure token1 is not a common verb (e.g. "Convert to BTC")
                const isVerb = /^(swap|convert|send|transfer|buy|sell|move|exchange)$/i.test(token1);

                if (!isVerb) {
                    if (fromAsset && fromAsset !== token1) {
                        // Conflict logic? Keep existing fromAsset if already set strong
                    } else {
                        fromAsset = token1;
                    }
                    toAsset = token2;
                    confidence += 30;
                }
            }
        }
    }

    // E. Detect Numeric Amount (if not percentage/exclude/all/quote)
    // If amountType is null, we assume it might be exact if we find a number
    if (!amount && amountType === null && !quoteAmount) {
       const amtTokenMatch = input.match(REGEX_AMOUNT_TOKEN);
       if (amtTokenMatch) {
           amount = parseFloat(amtTokenMatch[1]);
           amountType = 'exact';
           if (!fromAsset) fromAsset = amtTokenMatch[3].toUpperCase();
           confidence += 20;
       } else {
           // Standalone number?
           const numMatch = input.match(/\b(\d+(\.\d+)?)\b/);
           if (numMatch) {
               // Check if this number was part of exclusion?
               if (amountType !== 'all') { // If exclusion, we ignore other numbers unless relevant
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
        const assetStr = conditionMatch[1];
        const operatorStr = conditionMatch[2].toLowerCase();
        const valueStr = conditionMatch[3].replace(/[$,]/g, '');

        conditionValue = parseFloat(valueStr);

        if (assetStr) {
            const candidate = assetStr.toUpperCase();
            // Ignore common verbs/keywords if captured as asset
            const ignoredWords = ['IS', 'GOES', 'DROPS', 'RISES', 'FALLS', 'THE', 'PRICE', 'OF'];
            if (!ignoredWords.includes(candidate)) {
                conditionAsset = candidate;
            }
        }

        // above, greater, more, rises, >  => gt
        // below, less, under, drops, falls, < => lt
        if (['above', 'greater', 'more', 'rises', '>'].some(s => operatorStr.includes(s))) {
            conditionOperator = 'gt';
        } else {
            conditionOperator = 'lt';
        }

        confidence += 30;
    }

    // Construct Result if confidence is high enough
    // We need at least an intent and some token info.
    // If quoteAmount is present, allow null 'amount'.

    if (confidence >= 30) {
        // If amountType is 'all' or 'percentage', amount is optional/derived.
        // If 'exact', amount is required? No, might be missing.

        // Default conditionAsset to fromAsset if not specified but condition exists
        if ((conditionOperator || conditionValue) && !conditionAsset && fromAsset) {
            conditionAsset = fromAsset;
        }

        let parsedMessage = `Parsed: ${amountType || amount || (quoteAmount ? 'Value ' + quoteAmount : '?')} ${fromAsset || '?'} -> ${toAsset || '?'}`;
        if (conditionOperator && conditionValue) {
            parsedMessage += ` if ${conditionAsset || fromAsset} ${conditionOperator === 'gt' ? '>' : '<'} ${conditionValue}`;
        }

        return {
            success: true, // Mark as success parsing, even if validation fails later
            intent: 'swap',
            fromAsset: fromAsset || null,
            fromChain: null,
            toAsset: toAsset || null,
            toChain: null,
            amount: amount || null,
            amountType: amountType || 'exact',
            excludeAmount,
            excludeToken,
            quoteAmount,
            portfolio: undefined,
            frequency: null, dayOfWeek: null, dayOfMonth: null,
            settleAsset: null, settleNetwork: null, settleAmount: null, settleAddress: null,
            fromProject: null, fromYield: null, toProject: null, toYield: null,

            // Limit Order fields
            conditionOperator,
            conditionValue,
            conditionAsset,

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

    return {
      ...result,
      amountType: result.amountType || null,
      excludeAmount: result.excludeAmount || undefined,
      excludeToken: result.excludeToken || undefined,
      quoteAmount: result.quoteAmount || undefined,
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
