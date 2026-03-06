import Groq from "groq-sdk";
import { safeParseJSON } from "@/lib/safeParse";
import { logGroqUsage } from "@/lib/stats-service";

// Global singleton declaration to prevent multiple instances during hot reload
declare global {
  var _groqClient: Groq | undefined;
}

/**
 * Production-grade singleton pattern for Groq client
 * - Prevents new instance per request in serverless environments
 * - Reuses client in warm functions
 * - Handles hot reload in development
 * - Avoids connection flooding and TCP exhaustion
 */
function getGroqClient(): Groq {
  if (!global._groqClient) {
    global._groqClient = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
  }
  return global._groqClient;
}

// Type definition for the parsed command object
export interface ParsedCommand {
  success: boolean;
  intent: "swap" | "checkout" | "portfolio" | "yield_scout" | "dca" | "swap_and_stake" | "unknown";

  // Single Swap Fields
  fromAsset: string | null;
  fromChain: string | null;
  toAsset: string | null;
  toChain: string | null;
  amount: number | null;
  amountType?: "exact" | "percentage" | "all" | null;

  // Portfolio Fields
  portfolio?: {
    toAsset: string;
    toChain: string;
    percentage: number;
  }[] | null;

  // DCA Fields
  frequency?: "daily" | "weekly" | "monthly" | null;
  dayOfWeek?: number | null; // 1 (Monday) - 7 (Sunday)
  dayOfMonth?: number | null; // 1-31

  // Limit Order Fields (Conditional Swaps)
  conditionOperator?: "gt" | "lt" | null; // 'gt' for greater than, 'lt' for less than
  conditionValue?: number | null;
  conditionAsset?: string | null;

  // Checkout Fields
  settleAsset: string | null;
  settleNetwork: string | null;
  settleAmount: number | null;
  settleAddress: string | null;

  // Staking Fields
  fromProject?: string | null;
  toProject?: string | null;

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

5. "dca": Dollar Cost Averaging
   Examples: "Buy $100 of BTC daily", "DCA into ETH weekly", "Invest $50 in SOL every month"

6. "swap_and_stake": Natural language staking commands
   Examples: "Stake my ETH", "Stake 10 ETH with Lido", "Stake all my SOL", "Stake 50% of my MATIC"
   
   STAKING LOGIC:
   - Use "swap_and_stake" as the intent (not "stake")
   - Auto-map base assets to Liquid Staking Tokens (LSTs):
     * ETH -> stETH (Lido), rETH (Rocket Pool), osETH (StakeWise)
     * SOL -> mSOL (Marinade)
     * MATIC -> stMATIC (Lido)
     * AVAX -> sAVAX (Benqi)
     * BNB -> ankrBNB (Ankr)
   - Default to Lido for ETH if no provider specified
   - Support amount types: exact numbers, percentages, "all"
   - Set fromAsset to the base asset (ETH, SOL, etc.)
   - Set toAsset to the corresponding LST (stETH, mSOL, etc.)
   - Set appropriate chains for each asset

7. "unknown": Commands that don't fit other categories
   Examples: General questions, help requests, unclear instructions

STANDARDIZED CHAINS: ethereum, bitcoin, polygon, arbitrum, avalanche, optimism, bsc, base, solana

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

RESPONSE FORMAT:
{
  "success": boolean,
  "intent": "swap" | "portfolio" | "checkout" | "yield_scout" | "dca" | "swap_and_stake" | "unknown",
  "fromAsset": string | null,
  "fromChain": string | null,
  "toAsset": string | null,
  "toChain": string | null,
  "amount": number | null,
  "amountType": "exact" | "percentage" | "all" | null,

  // Portfolio Fields
  "portfolio": [{
    "toAsset": string,
    "toChain": string,
    "percentage": number
  }] | null,

  // DCA Fields
  "frequency": "daily" | "weekly" | "monthly" | null,
  "dayOfWeek": number | null,
  "dayOfMonth": number | null,

  // Checkout Fields
  "settleAsset": string | null,
  "settleNetwork": string | null,
  "settleAmount": number | null,
  "settleAddress": string | null,

  // Conditional Fields
  "conditionOperator": "gt" | "lt" | null,
  "conditionValue": number | null,
  "conditionAsset": string | null,

  "confidence": number,
  "validationErrors": string[],
  "parsedMessage": string,
  "requiresConfirmation": boolean
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
     "requiresConfirmation": true
   }

3. MISSING AMOUNT:
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
     "requiresConfirmation": true
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

5. PORTFOLIO SPLIT:
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

6. STAKING COMMANDS:
   Input: "Stake my ETH"
   Output: {
     "success": true,
     "intent": "swap_and_stake",
     "fromAsset": "ETH",
     "fromChain": "ethereum",
     "toAsset": "stETH",
     "toChain": "ethereum",
     "amount": null,
     "amountType": null,
     "confidence": 60,
     "validationErrors": ["Amount not specified. How much ETH would you like to stake?"],
     "parsedMessage": "Stake [amount needed] ETH -> stETH via Lido",
     "requiresConfirmation": true
   }

   Input: "Stake 10 ETH with Rocket Pool"
   Output: {
     "success": true,
     "intent": "swap_and_stake",
     "fromAsset": "ETH",
     "fromChain": "ethereum",
     "toAsset": "rETH",
     "toChain": "ethereum",
     "amount": 10,
     "amountType": "exact",
     "confidence": 95,
     "validationErrors": [],
     "parsedMessage": "Stake 10 ETH -> rETH via Rocket Pool",
     "requiresConfirmation": false
   }

   Input: "Stake all my SOL"
   Output: {
     "success": true,
     "intent": "swap_and_stake",
     "fromAsset": "SOL",
     "fromChain": "solana",
     "toAsset": "mSOL",
     "toChain": "solana",
     "amount": 100,
     "amountType": "percentage",
     "confidence": 90,
     "validationErrors": [],
     "parsedMessage": "Stake all SOL -> mSOL via Marinade",
     "requiresConfirmation": false
   }

CRITICAL PARSING RULES:
1. Always set confidence based on clarity and completeness
2. Use validationErrors for specific issues, not generic messages
3. Set requiresConfirmation for any uncertainty
4. Handle common typos and abbreviations gracefully
5. Default to most conservative interpretation when unsure
6. Preserve user intent even with imperfect phrasing

Remember: It's better to ask for clarification than to make incorrect assumptions with user funds.
`;

export async function parseUserCommand(
  userInput: string,
  userId?: string | null,
  sessionId?: string | null
): Promise<ParsedCommand> {
  const groq = getGroqClient();

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userInput,
        },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      max_tokens: 1000,
      response_format: { type: "json_object" },
    });

    // Log usage for monitoring
    if (completion.usage) {
      await logGroqUsage({
        userId: userId || 'anonymous',
        model: 'llama-3.3-70b-versatile',
        endpoint: 'chat',
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        totalTokens: completion.usage.total_tokens,
      });
    }

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response content from Groq");
    }

    const parsed = safeParseJSON(content) as any;
    if (!parsed) {
      throw new Error("Invalid JSON response from Groq");
    }

    // Ensure required fields are present
    const result: ParsedCommand = {
      success: parsed.success ?? true,
      intent: parsed.intent ?? "unknown",
      fromAsset: parsed.fromAsset ?? null,
      fromChain: parsed.fromChain ?? null,
      toAsset: parsed.toAsset ?? null,
      toChain: parsed.toChain ?? null,
      amount: parsed.amount ?? null,
      amountType: parsed.amountType ?? null,
      portfolio: parsed.portfolio ?? null,
      frequency: parsed.frequency ?? null,
      dayOfWeek: parsed.dayOfWeek ?? null,
      dayOfMonth: parsed.dayOfMonth ?? null,
      conditionOperator: parsed.conditionOperator ?? null,
      conditionValue: parsed.conditionValue ?? null,
      conditionAsset: parsed.conditionAsset ?? null,
      settleAsset: parsed.settleAsset ?? null,
      settleNetwork: parsed.settleNetwork ?? null,
      settleAmount: parsed.settleAmount ?? null,
      settleAddress: parsed.settleAddress ?? null,
      fromProject: parsed.fromProject ?? null,
      toProject: parsed.toProject ?? null,
      confidence: parsed.confidence ?? 50,
      validationErrors: parsed.validationErrors ?? [],
      parsedMessage: parsed.parsedMessage ?? "Command parsed",
      requiresConfirmation: parsed.requiresConfirmation ?? false,
      originalInput: userInput,
    };

    return result;
  } catch (error) {
    console.error("Error parsing command with Groq:", error);
    
    return {
      success: false,
      intent: "unknown",
      fromAsset: null,
      fromChain: null,
      toAsset: null,
      toChain: null,
      amount: null,
      amountType: null,
      portfolio: null,
      frequency: null,
      dayOfWeek: null,
      dayOfMonth: null,
      conditionOperator: null,
      conditionValue: null,
      conditionAsset: null,
      settleAsset: null,
      settleNetwork: null,
      settleAmount: null,
      settleAddress: null,
      fromProject: null,
      toProject: null,
      confidence: 0,
      validationErrors: ["Failed to parse command. Please try rephrasing."],
      parsedMessage: "Error occurred during parsing",
      requiresConfirmation: true,
      originalInput: userInput,
    };
  }
}

/**
 * Transcribe audio file using Groq's Whisper API
 */
export async function transcribeAudio(file: File): Promise<string> {
  const groq = getGroqClient();

  try {
    const transcription = await groq.audio.transcriptions.create({
      file: file,
      model: "whisper-large-v3",
      prompt: "This is a cryptocurrency trading command. Common terms include: swap, ETH, BTC, USDC, SOL, trade, convert, exchange.",
      response_format: "text",
      language: "en",
      temperature: 0.0,
    });

    // Log usage for monitoring
    await logGroqUsage({
      userId: 'anonymous',
      model: 'whisper-large-v3',
      endpoint: 'transcription',
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    });

    return String(transcription);
  } catch (error) {
    console.error("Error transcribing audio with Groq:", error);
    throw new Error("Failed to transcribe audio. Please try again.");
  }
}