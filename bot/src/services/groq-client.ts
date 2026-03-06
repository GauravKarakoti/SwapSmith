import Groq from "groq-sdk";
import dotenv from 'dotenv';
import fs from 'fs';
import logger, { handleError } from './logger';

import { analyzeCommand, generateContextualHelp } from './contextual-help';

dotenv.config();

function getGroqClient(): Groq {
  return new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });
}


export interface ParsedCommand {
  success: boolean;
  intent: "swap" | "checkout" | "portfolio" | "yield_scout" | "yield_deposit" | "yield_migrate" | "dca" | "limit_order" | "swap_and_stake" | "unknown"; // Added "swap_and_stake" intent
  
  // Single Swap Fields
  fromAsset: string | null;
  fromChain: string | null;
  toAsset: string | null;
  toChain: string | null;
  amount: number | null;
  amountType?: "exact" | "absolute" | "percentage" | "all" | "exclude" | null; // Extended with 'absolute'

  excludeAmount?: number;
  excludeToken?: string;
  quoteAmount?: number;

  // Conditional Fields
  conditions?: {
    type: "price_above" | "price_below";
    asset: string;
    value: number;
  };
  
  // Portfolio Fields
  portfolio?: {
    toAsset: string;
    toChain: string;
    percentage: number;
  }[];
  driftThreshold?: number;
  autoRebalance?: boolean;
  portfolioName?: string;

  // DCA Fields
  frequency?: "daily" | "weekly" | "monthly" | string | null;
  dayOfWeek?: string | null;
  dayOfMonth?: string | null;
  totalAmount?: number;
  numPurchases?: number;

  // Checkout Fields
  settleAsset: string | null;
  settleNetwork: string | null;
  settleAmount: number | null;
  settleAddress: string | null;

  // Yield Fields
  fromProject: string | null;
  fromYield: number | null;
  toProject: string | null;
  toYield: number | null;

  // Stake Fields
  estimatedApy?: number | null;
  stakeProtocol?: string | null;
  stakePool?: string | null;

  // Limit Order Fields (Legacy - kept for compatibility, prefer 'conditions')
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


const systemPrompt = `
You are SwapSmith, an advanced DeFi AI agent specialized in parsing natural language into precise JSON commands.
Your job is to handle complex, ambiguous, and edge-case trading commands with high accuracy.

CORE PARSING PRINCIPLES:
1. PRECISION OVER ASSUMPTIONS: If unclear, set low confidence and require confirmation
2. CONTEXT AWARENESS: Consider previous context and common trading patterns
3. AMBIGUITY RESOLUTION: Provide multiple interpretations when commands are unclear
4. EDGE CASE HANDLING: Handle typos, abbreviations, and non-standard phrasing

SUPPORTED INTENTS:
1. "swap": 1 Input -> 1 Output (immediate market swap)
   Examples: "Swap 100 ETH for BTC", "Convert my USDC to ETH", "Exchange 0.5 BTC for SOL"
   
2. "portfolio": 1 Input -> Multiple Outputs (Split allocation)
   Examples: "Split 1000 ETH: 50% to BTC, 30% to SOL, 20% to USDC", "Diversify my ETH into 3 assets equally"
   
3. "checkout": Payment link creation for receiving assets
   Examples: "Create a payment link for 500 USDC on Ethereum", "Generate invoice for 1 BTC"
   
4. "yield_scout": User asking for high APY/Yield info
   Examples: "What are the best yields right now?", "Show me top staking rewards", "Where can I earn on USDC?"

5. "yield_deposit": Deposit assets into yield platforms
   Examples: "Stake my ETH with Lido", "Deposit USDC into Aave", "Put my tokens to work"

6. "yield_migrate": Move funds between pools
   Examples: "Move my staked ETH from Lido to Rocket Pool", "Switch my USDC from Aave to Compound"

7. "dca": Dollar Cost Averaging
   Examples: "Buy $100 of BTC daily", "DCA into ETH weekly", "Invest $50 in SOL every month"

8. "limit_order": Buy/Sell at specific price
   Examples: "Buy ETH if price drops below $2000", "Sell when BTC hits $50k", "Convert to USDC when ETH goes above $3000"

9. "swap_and_stake": Swap assets and immediately stake them for yield
   Examples: "Swap 100 USDC for ETH and stake it", "Convert my BTC to stETH", "Zap into liquid staking"
   Keywords: "swap and stake", "zap", "stake immediately", "swap to stake", "stake"
   
   AUTO-MAPPING for staking commands:
   - ETH -> stETH (Lido) ~3-4% APR
   - SOL -> mSOL (Marinade) ~7-8% APR  
   - MATIC -> stMATIC (Lido) ~4-5% APR
   - AVAX -> sAVAX (Benqi) ~8-9% APR
   - BNB -> ankrBNB (Ankr) ~3-4% APR

STANDARDIZED CHAINS: ethereum, bitcoin, polygon, arbitrum, avalanche, optimism, bsc, base, solana

LIQUID STAKING PROVIDERS:
- lido: Most popular, supports ETH, MATIC (~3-4% APR)
- rocket_pool: Decentralized ETH staking (~3-4% APR)  
- stakewise: Community-driven ETH staking (~3-4% APR)
- Default to "lido" for ETH if no provider specified

ADDRESS RESOLUTION PATTERNS:
- Raw addresses: 0x followed by 40 hex characters
- ENS names: ending in .eth (e.g., vitalik.eth)
- Lens handles: ending in .lens (e.g., stani.lens)
- Unstoppable Domains: .crypto, .nft, .blockchain, .wallet, etc.
- Nicknames: single word, lowercase, no special chars

CRITICAL: When user says "Swap X ETH to vitalik.eth":
- This means: Keep ETH, send to address vitalik.eth
- Parse as: toAsset: "ETH", toChain: "ethereum", settleAddress: "vitalik.eth"
- NOT as a token swap to a different asset

ADVANCED AMBIGUITY HANDLING:
1. MULTIPLE INTERPRETATIONS: For commands like "swap all my ETH to BTC or USDC":
   - Set confidence: 0-30
   - Add validation error: "Multiple destination assets detected. Please specify one: BTC or USDC?"
   - Set requiresConfirmation: true
   - Suggest most likely interpretation in parsedMessage

2. MISSING CRITICAL INFO: For incomplete commands:
   - Identify what's missing specifically
   - Provide helpful suggestions in validationErrors
   - Set confidence based on completeness (missing amount: 40-60, missing asset: 10-30)

3. TYPOS & ABBREVIATIONS: Handle common variations:
   - "btc/bitcoin", "eth/ethereum", "usdc/usd coin"
   - "k" = thousand, "m" = million, "b" = billion
   - "%" for percentage amounts
   - "all/everything/max" for full balance

4. CONDITIONAL COMPLEXITY: For multi-condition commands:
   - Extract primary condition into "conditions" object
   - Note secondary conditions in validationErrors
   - Suggest breaking into multiple commands if too complex

5. CONTEXT CLUES: Use surrounding words for disambiguation:
   - "my ETH" vs "1 ETH" (percentage vs exact)
   - "when price" vs "if available" (condition types)
   - "split" vs "swap" (portfolio vs single swap)

RESPONSE FORMAT (Enhanced):
{
  "success": boolean,
  "intent": "swap" | "portfolio" | "checkout" | "yield_scout" | "yield_deposit" | "yield_migrate" | "dca" | "limit_order" | "swap_and_stake",
  "fromAsset": string | null,
  "fromChain": string | null,
  "amount": number | null,
  "amountType": "exact" | "absolute" | "percentage" | "all" | null,

  // Enhanced Conditions Support
  "conditions": {
    "type": "price_above" | "price_below" | "time_based" | "balance_threshold",
    "asset": string,
    "value": number,
    "operator": "gt" | "lt" | "gte" | "lte" | "eq",
    "secondary_conditions"?: object[]
  } | null,

  // Core swap fields
  "toAsset": string | null,
  "toChain": string | null,
  
  // Portfolio allocation
  "portfolio": [{
    "toAsset": string,
    "toChain": string, 
    "percentage": number,
    "priority"?: number
  }] | null,
  
  // DCA fields
  "frequency": "daily" | "weekly" | "monthly" | null,
  "dayOfWeek": "monday" | "tuesday" | ... | null,
  "dayOfMonth": "1" to "31" | null,
  "settleAsset": null,
  "settleNetwork": null,
  "settleAmount": null,
  "settleAddress": null,
  "totalAmount": number | null,
  "numPurchases": number | null,
  
  // Staking Fields (for stake and swap_and_stake intents)
  "estimatedApy": number | null,
  "stakeProtocol": "aave" | "compound" | "lido" | "yearn" | "morpho" | "spark" | "euler" | null,
  "stakePool": string | null,
  "toProject": string | null,
  
  "conditionOperator": "gt" | "lt" | null,
  "conditionValue": number | null,
  "conditionAsset": string | null,
  
  // Quality indicators
  "confidence": number, // 0-100, higher = more certain
  "validationErrors": string[], // Specific issues found
  "parsedMessage": string, // Human-readable summary
  "requiresConfirmation": boolean, // True if ambiguous/risky
  "alternativeInterpretations"?: string[], // Other possible meanings
  "suggestedClarifications"?: string[] // Questions to ask user
}

ENHANCED EXAMPLES WITH EDGE CASES:

1. CLEAR COMMAND:
   Input: "Swap 100 ETH for BTC"
   Output: {
     "success": true,
     "intent": "swap",
     "fromAsset": "ETH",
     "fromChain": "ethereum", 
     "amount": 100,
     "amountType": "exact",
     "toAsset": "BTC",
     "toChain": "bitcoin",
     "confidence": 95,
     "validationErrors": [],
     "parsedMessage": "Swap 100 ETH for BTC",
     "requiresConfirmation": false
   }

2. AMBIGUOUS DESTINATION:
   Input: "Swap all my ETH to BTC or USDC"
   Output: {
     "success": true,
     "intent": "swap",
     "fromAsset": "ETH",
     "amount": 100,
     "amountType": "percentage",
     "toAsset": null,
     "confidence": 25,
     "validationErrors": ["Multiple destination assets detected: BTC, USDC. Please specify one."],
     "parsedMessage": "Swap all ETH to [BTC or USDC - clarification needed]",
     "requiresConfirmation": true,
     "alternativeInterpretations": ["Swap all ETH to BTC", "Swap all ETH to USDC", "Split ETH: 50% BTC, 50% USDC"],
     "suggestedClarifications": ["Which asset would you prefer: BTC or USDC?", "Would you like to split between both assets?"]
   }

3. COMPLEX CONDITIONAL:
   Input: "Swap 50% of my ETH for BTC only if BTC price is above 60k and market is bullish"
   Output: {
     "success": true,
     "intent": "swap",
     "fromAsset": "ETH",
     "amount": 50,
     "amountType": "percentage",
     "toAsset": "BTC",
     "conditions": {
       "type": "price_above",
       "asset": "BTC",
       "value": 60000,
       "operator": "gt"
     },
     "confidence": 70,
     "validationErrors": ["Secondary condition 'market is bullish' cannot be automatically evaluated"],
     "parsedMessage": "Conditional swap: 50% ETH → BTC if BTC > $60,000 (market sentiment condition ignored)",
     "requiresConfirmation": true,
     "suggestedClarifications": ["How should I determine if the market is bullish?"]
   }

4. TYPOS AND ABBREVIATIONS:
   Input: "swp 1k usdc 2 btc pls"
   Output: {
     "success": true,
     "intent": "swap",
     "fromAsset": "USDC",
     "amount": 1000,
     "amountType": "exact",
     "toAsset": "BTC",
     "confidence": 85,
     "validationErrors": [],
     "parsedMessage": "Swap 1,000 USDC for BTC (interpreted from abbreviated input)",
     "requiresConfirmation": false
   }

5. MISSING AMOUNT:
   Input: "Swap my ETH for BTC"
   Output: {
     "success": true,
     "intent": "swap",
     "fromAsset": "ETH",
     "toAsset": "BTC",
     "amount": null,
     "confidence": 60,
     "validationErrors": ["Amount not specified. How much ETH would you like to swap?"],
     "parsedMessage": "Swap [amount needed] ETH for BTC",
     "requiresConfirmation": true,
     "suggestedClarifications": ["How much ETH would you like to swap?", "Would you like to swap all your ETH?"]
   }

6. ADDRESS CONFUSION:
   Input: "Send 1 ETH to vitalik.eth"
   Output: {
     "success": true,
     "intent": "swap",
     "fromAsset": "ETH",
     "toAsset": "ETH",
     "toChain": "ethereum",
     "amount": 1,
     "amountType": "exact",
     "settleAddress": "vitalik.eth",
     "confidence": 90,
     "validationErrors": [],
     "parsedMessage": "Send 1 ETH to vitalik.eth",
     "requiresConfirmation": false
   }

7. PORTFOLIO SPLIT WITH UNCLEAR PERCENTAGES:
   Input: "Split my 1000 USDC into BTC, ETH, and SOL equally"
   Output: {
     "success": true,
     "intent": "portfolio",
     "fromAsset": "USDC",
     "amount": 1000,
     "amountType": "exact",
     "portfolio": [
       {"toAsset": "BTC", "toChain": "bitcoin", "percentage": 33.33},
       {"toAsset": "ETH", "toChain": "ethereum", "percentage": 33.33},
       {"toAsset": "SOL", "toChain": "solana", "percentage": 33.34}
     ],
     "confidence": 90,
     "validationErrors": [],
     "parsedMessage": "Split 1,000 USDC equally: 33.33% BTC, 33.33% ETH, 33.34% SOL",
     "requiresConfirmation": false
   }

8. VOICE INPUT WITH PHONETIC ERRORS:
   Input: "swap won eeth for bit coin"
   Output: {
     "success": true,
     "intent": "swap",
     "fromAsset": "ETH",
     "amount": 1,
     "amountType": "exact",
     "toAsset": "BTC",
     "confidence": 80,
     "validationErrors": [],
     "parsedMessage": "Swap 1 ETH for BTC (interpreted from voice input)",
     "requiresConfirmation": false
   }

CRITICAL PARSING RULES:
1. Always set confidence based on clarity and completeness
2. Use validationErrors for specific issues, not generic messages
3. Provide alternativeInterpretations for ambiguous commands
4. Set requiresConfirmation for any uncertainty
5. Handle common typos and abbreviations gracefully
6. Extract conditions into structured format
7. Default to most conservative interpretation when unsure
8. Preserve user intent even with imperfect phrasing

Remember: It's better to ask for clarification than to make incorrect assumptions with user funds.

6. "Deposit 1 ETH to yield"
   -> intent: "yield_deposit", fromAsset: "ETH", amount: 1, confidence: 95

7. "Swap 1 ETH to mywallet"
   -> intent: "swap", fromAsset: "ETH", toAsset: "ETH", toChain: "ethereum", amount: 1, settleAddress: "mywallet", confidence: 95

8. "Send 5 USDC to vitalik.eth"
   -> intent: "checkout", settleAsset: "USDC", settleNetwork: "ethereum", settleAmount: 5, settleAddress: "vitalik.eth", confidence: 95

9. "Move my USDC from Aave on Base to a higher yield pool"
   -> intent: "yield_migrate", fromAsset: "USDC", fromChain: "base", fromProject: "Aave", confidence: 95

10. "Switch my ETH yield from 5% to something better"
   -> intent: "yield_migrate", fromAsset: "ETH", fromYield: 5, confidence: 90

11. "Migrate my stables to the best APY pool"
    -> intent: "yield_migrate", fromAsset: "USDC", confidence: 85

12. "Swap $50 of USDC for ETH every Monday"
    -> intent: "dca", fromAsset: "USDC", toAsset: "ETH", amount: 50, frequency: "weekly", dayOfWeek: "monday", confidence: 95

13. "Buy 100 USDC of BTC daily"
    -> intent: "dca", fromAsset: "USDC", toAsset: "BTC", amount: 100, frequency: "daily", confidence: 95

14. "DCA 200 USDC into ETH every month on the 1st"
    -> intent: "dca", fromAsset: "USDC", toAsset: "ETH", amount: 200, frequency: "monthly", dayOfMonth: "1", confidence: 95

15. "Stake 2 ETH with Lido"
    -> intent: "swap_and_stake", fromAsset: "ETH", toAsset: "stETH", amount: 2, confidence: 95

16. "Stake my ETH to earn rewards" (amount missing)
    -> intent: "swap_and_stake", fromAsset: "ETH", toAsset: "stETH", amount: null, validationErrors: ["Amount not specified"], requiresConfirmation: true, confidence: 90

17. "Stake 1 ETH with Rocket Pool"
    -> intent: "swap_and_stake", fromAsset: "ETH", toAsset: "rETH", amount: 1, confidence: 95

18. "Stake 0.5 ETH"
    -> intent: "swap_and_stake", fromAsset: "ETH", toAsset: "stETH", amount: 0.5, confidence: 90
`;

// RENAMED from parseUserCommand to parseWithLLM
export async function parseWithLLM(
  userInput: string,
  conversationHistory: any[] = [],
  inputType: 'text' | 'voice' = 'text'
): Promise<ParsedCommand> {
  let currentSystemPrompt = systemPrompt;

  if (inputType === 'voice') {
    currentSystemPrompt += `
    \\n\\nVOICE MODE ACTIVE: 
    1. The user is speaking. Be more lenient with phonetic typos.
    2. In 'parsedMessage', write as if spoken aloud.
    `;
  }

  try {
    const messages: any[] = [
        { role: "system", content: currentSystemPrompt },
        ...conversationHistory,
        { role: "user", content: userInput }
    ];

    const completion = await getGroqClient().chat.completions.create({
      messages: messages,
      model: "llama-3.3-70b-versatile", 
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 2048, 
    });

    const parsed = JSON.parse(completion.choices[0].message.content || '{}');
    logger.info("LLM Parsed:", parsed);
    return validateParsedCommand(parsed, userInput, inputType);
  } catch (error) {
    logger.error("Groq Error:", error);

    return {
      success: false, intent: "unknown", confidence: 0,
      validationErrors: ["AI parsing failed"], parsedMessage: "",
      fromAsset: null, fromChain: null, toAsset: null, toChain: null, amount: null,
      settleAsset: null, settleNetwork: null, settleAmount: null, settleAddress: null
    } as ParsedCommand;
  }
}

export async function transcribeAudio(mp3FilePath: string): Promise<string> {
  try {
    const transcription = await getGroqClient().audio.transcriptions.create({
        file: fs.createReadStream(mp3FilePath),
        model: "whisper-large-v3",
        response_format: "json",
    });
    return transcription.text;
  } catch (error) {
    await handleError('TranscriptionError', { error: error instanceof Error ? error.message : 'Unknown error', filePath: mp3FilePath }, null, false, 'low');
    throw error;
  }
}

function validateParsedCommand(parsed: Partial<ParsedCommand>, userInput: string, inputType: 'text' | 'voice' = 'text'): ParsedCommand {
  const errors: string[] = [];
  // ... (Keeping validation logic simple for brevity, same as before)
  if (!parsed.intent) errors.push("Could not determine intent.");

  if (parsed.intent === 'portfolio' && Array.isArray(parsed.portfolio) && parsed.portfolio.length > 0) {
    const total = parsed.portfolio.reduce((sum, item) => sum + (item?.percentage || 0), 0);
    if (total !== 100) {
      errors.push(`Total allocation is ${total}%, but should be 100%`);
    }
  }

  if (parsed.intent === 'limit_order') {
    if (parsed.targetPrice == null && parsed.conditionValue == null) {
      errors.push('Target price not specified');
    }
  }

  if (parsed.intent === 'dca') {
    if (parsed.totalAmount == null) {
      errors.push('Total investment amount not specified');
    }
  }

  const allErrors = [...(parsed.validationErrors || []), ...errors];
  const success = parsed.success !== false && allErrors.length === 0;
  const confidence = allErrors.length > 0 ? Math.max(0, (parsed.confidence || 0) - 30) : parsed.confidence;

  const result: ParsedCommand = {
    success,
    intent: parsed.intent || 'unknown',
    fromAsset: parsed.fromAsset || null,
    fromChain: parsed.fromChain || null,
    toAsset: parsed.toAsset || null,
    toChain: parsed.toChain || null,
    amount: parsed.amount || null,
    amountType: parsed.amountType || null,
    excludeAmount: parsed.excludeAmount,
    excludeToken: parsed.excludeToken,
    quoteAmount: parsed.quoteAmount,
    conditions: parsed.conditions, // Pass through conditions
    portfolio: parsed.portfolio, // Pass through portfolio
    frequency: parsed.frequency || null,
    dayOfWeek: parsed.dayOfWeek || null,
    dayOfMonth: parsed.dayOfMonth || null,
    settleAsset: parsed.settleAsset || null,
    settleNetwork: parsed.settleNetwork || null,
    settleAmount: parsed.settleAmount || null,
    settleAddress: parsed.settleAddress || null,
    fromProject: parsed.fromProject || null,
    fromYield: parsed.fromYield || null,
    toProject: parsed.toProject || null,
    toYield: parsed.toYield || null,
    
    // Stake fields
    estimatedApy: parsed.estimatedApy || null,
    stakeProtocol: parsed.stakeProtocol || null,
    stakePool: parsed.stakePool || null,
    
    // New fields
    targetPrice: parsed.targetPrice,
    condition: parsed.condition,
    totalAmount: parsed.totalAmount,
    numPurchases: parsed.numPurchases,
    conditionOperator: parsed.conditionOperator,
    conditionValue: parsed.conditionValue,
    conditionAsset: parsed.conditionAsset,

    confidence: confidence || 0,

    validationErrors: allErrors,
    parsedMessage: parsed.parsedMessage || '',
    requiresConfirmation: parsed.requiresConfirmation || false,
    originalInput: userInput
  };

  // Contextual help generation (simplified for this file refactor)
  if (allErrors.length > 0) {
      try {
          const analysis = analyzeCommand(result);
          const help = generateContextualHelp(analysis, userInput, inputType);
          result.validationErrors.push(help);
      } catch (e) { 
          logger.error('ContextualHelpGenerationError', {
              error: e instanceof Error ? e.message : 'Unknown error',
              stack: e instanceof Error ? e.stack : undefined,
              operation: 'generateContextualHelp',
              parsedCommand: result
          });
      }

  }

  return result;
}
