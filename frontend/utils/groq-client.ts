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
  intent: "swap" | "checkout" | "portfolio" | "yield_scout" | "dca" | "stake" | "unknown"; // Added "stake" intent

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
  }[];

  // DCA Fields
  frequency?: "daily" | "weekly" | "monthly";
  dayOfWeek?: number; // 1 (Monday) - 7 (Sunday)
  dayOfMonth?: number; // 1-31

  // Limit Order Fields (Conditional Swaps)
  conditionOperator?: "gt" | "lt"; // 'gt' for greater than, 'lt' for less than
  conditionValue?: number;
  conditionAsset?: string;

  // Checkout Fields
  settleAsset: string | null;
  settleNetwork: string | null;
  settleAmount: number | null;
  settleAddress: string | null;

  // Staking Fields (for "stake" intent)
  stakeAsset?: string | null;        // Asset to stake (e.g., "ETH")
  stakeProtocol?: string | null;   // Protocol to stake with (e.g., "lido", "rocket_pool", "stakewise")
  stakeChain?: string | null;        // Chain to stake on (default: "ethereum")
  stakingApr?: number | null;        // Estimated staking APR (e.g., 3.5 for 3.5%) - SHOWN IN CONFIRMATION BOX
  stakeProvider?: string | null;     // Display name of provider (e.g., "Lido", "Rocket Pool")

  confidence: number;
  validationErrors: string[];
  parsedMessage: string;
  requiresConfirmation?: boolean;
  originalInput?: string;
}

const systemPrompt = `
You are SwapSmith, an advanced DeFi AI agent.
Your job is to parse natural language into specific JSON commands.

MODES:
1. "swap": User wants to exchange one asset for another (e.g., "Swap ETH for USDC").
   - Can include CONDITIONS for Limit Orders (e.g., "Swap ETH to USDC when ETH price is above 4000").
2. "dca": User wants to set up recurring swaps (e.g., "DCA 100 USDC to BTC every Friday" or "Buy ETH daily").
3. "portfolio": User wants to split one input asset into multiple output assets (e.g., "Split 1 ETH into 50% BTC and 50% SOL").
4. "checkout":
   - User wants to create a payment link.
   - User says "Send [amount] [asset] to [address]" (Generate a link to pay that address).
   - User says "I want to receive [amount] [asset]" (Generate a link for their own wallet).
5. "yield_scout": User asking for high APY/Yield info.
6. "stake": User wants to stake assets with liquid staking providers (Lido, Rocket Pool, StakeWise).
   - Example: "Stake 1 ETH with Lido" or "Stake my ETH to earn rewards"
   - Maps to liquid staking providers: lido (stETH), rocket_pool (rETH), stakewise (osETH)
   - For ETH staking, default to "lido" if no provider specified
   - Include stakingApr field with estimated annual percentage rate

LIQUID STAKING PROVIDERS:
- lido: stETH on Ethereum (~3-4% APR), most popular
- rocket_pool: rETH on Ethereum (~3-4% APR), decentralized
- stakewise: osETH on Ethereum (~3-4% APR)

STANDARDIZED CHAINS: ethereum, bitcoin, polygon, arbitrum, avalanche, optimism, bsc, base, solana.

RESPONSE FORMAT:
{
  "success": boolean,
  "intent": "swap" | "dca" | "portfolio" | "checkout" | "yield_scout" | "stake",

  // SWAP & LIMIT ORDER PARAMS
  "fromAsset": string | null,
  "fromChain": string | null,
  "toAsset": string | null,
  "toChain": string | null,
  "amount": number | null,
  "amountType": "exact" | "percentage" | "all" | null,
  // Limit Order specific:
  "conditionOperator": "gt" | "lt" | null, // gt (above/greater), lt (below/less)
  "conditionValue": number | null,         // The price target
  "conditionAsset": string | null,         // The asset being monitored (usually fromAsset)

  // DCA PARAMS
  "frequency": "daily" | "weekly" | "monthly" | null,
  "dayOfWeek": number | null, // 1=Monday, 7=Sunday
  "dayOfMonth": number | null, // 1-31

  // PORTFOLIO PARAMS
  "portfolio": [
    { "toAsset": "BTC", "toChain": "bitcoin", "percentage": 50 },
    { "toAsset": "SOL", "toChain": "solana", "percentage": 50 }
  ],

  // CHECKOUT PARAMS
  "settleAsset": string | null,
  "settleNetwork": string | null,
  "settleAmount": number | null,
  "settleAddress": string | null,

  // STAKING PARAMS (for "stake" intent)
  "stakeAsset": string | null,       // Asset to stake (e.g., "ETH")
  "stakeProtocol": string | null,    // Protocol to stake with (e.g., "lido", "rocket_pool", "stakewise")
  "stakeChain": string | null,       // Chain to stake on (default: "ethereum")
  "stakingApr": number | null,       // Estimated staking APR (e.g., 3.5 for 3.5%)
  "stakeProvider": string | null,    // Display name of provider (e.g., "Lido", "Rocket Pool")

  "confidence": number, // Confidence score 0-100
  "validationErrors": string[],
  "parsedMessage": "Human readable summary",
  "requiresConfirmation": boolean
}
`;

export async function transcribeAudio(file: File): Promise<string> {
  try {
    const groq = getGroqClient();
    
    // Call Groq's audio transcription endpoint
    const transcription = await groq.audio.transcriptions.create({
      file: file,
      model: "whisper-large-v3", // You can also use "whisper-large-v3-turbo" for faster/cheaper inference
      response_format: "json",
    });

    return transcription.text;
  } catch (error) {
    console.error("Error transcribing audio with Groq:", error);
    throw new Error("Failed to transcribe audio");
  }
}

export async function parseUserCommand(
  userInput: string,
  userId?: string | null,
): Promise<ParsedCommand> {
  const MODEL = 'llama-3.3-70b-versatile';
  try {
    const groq = getGroqClient();
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userInput },
      ],
      model: MODEL,
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 1024,
    });

    // Log token usage asynchronously – never block the main flow
    if (completion.usage) {
      logGroqUsage({
        userId: userId ?? null,
        model: MODEL,
        endpoint: 'chat',
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        totalTokens: completion.usage.total_tokens,
      }).catch(() => { /* swallow */ });
    }

    const parsed = safeParseJSON(completion.choices[0].message.content) || {};
    return validateParsedCommand(parsed, userInput);
  } catch (error) {
    console.error("Error parsing command:", error);
    return {
      success: false,
      intent: "unknown",
      confidence: 0,
      validationErrors: ["AI parsing failed"],
      parsedMessage: "",
      fromAsset: null, fromChain: null, toAsset: null, toChain: null, amount: null,
      settleAsset: null, settleNetwork: null, settleAmount: null, settleAddress: null
    } as ParsedCommand;
  }
}

function validateParsedCommand(parsed: Partial<ParsedCommand>, userInput: string): ParsedCommand {
  const errors: string[] = [];

  if (parsed.intent === "swap") {
    if (!parsed.fromAsset) errors.push("Source asset not specified");
    if (!parsed.toAsset) errors.push("Destination asset not specified");
    if (!parsed.amount || parsed.amount <= 0) errors.push("Invalid amount specified");

  } else if (parsed.intent === "dca") {
    if (!parsed.fromAsset) errors.push("Source asset not specified");
    if (!parsed.toAsset) errors.push("Destination asset not specified");
    if (!parsed.amount || parsed.amount <= 0) errors.push("Invalid amount specified");
    if (!parsed.frequency) errors.push("Frequency (daily/weekly/monthly) not specified");

  } else if (parsed.intent === "portfolio") {
    if (!parsed.fromAsset) errors.push("Source asset not specified");
    if (!parsed.amount || parsed.amount <= 0) errors.push("Invalid amount specified");
    if (!parsed.portfolio || parsed.portfolio.length === 0) {
      errors.push("No portfolio allocation specified");
    }

  } else if (parsed.intent === "checkout") {
    // Remap swap fields to checkout fields if the AI got confused
    if (!parsed.settleAsset && parsed.fromAsset) parsed.settleAsset = parsed.fromAsset;
    if (!parsed.settleNetwork && parsed.fromChain) parsed.settleNetwork = parsed.fromChain;
    if (!parsed.settleAmount && parsed.amount) parsed.settleAmount = parsed.amount;

    if (!parsed.settleAsset) errors.push("Asset to receive/send not specified");
    if (!parsed.settleAmount || parsed.settleAmount <= 0) errors.push("Invalid amount specified");

  } else if (parsed.intent === "stake") {
    // Validate staking command
    if (!parsed.stakeAsset && !parsed.fromAsset) errors.push("Asset to stake not specified");
    if (!parsed.amount || parsed.amount <= 0) errors.push("Invalid amount specified");
    // If stakeProtocol not specified, default to "lido" for ETH
    if (!parsed.stakeProtocol && (parsed.stakeAsset === "ETH" || parsed.fromAsset === "ETH")) {
      parsed.stakeProtocol = "lido";
      parsed.stakeProvider = "Lido";
      parsed.stakingApr = 3.5; // Estimated APR
    }
  }

  const allErrors = [...(parsed.validationErrors || []), ...errors];
  const success = parsed.success !== false && allErrors.length === 0;

  const rawConfidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;
  const confidence = allErrors.length > 0 ? Math.max(0, rawConfidence - 30) : rawConfidence;

  return {
    success,
    intent: parsed.intent || 'unknown',
    fromAsset: parsed.fromAsset || null,
    fromChain: parsed.fromChain || null,
    toAsset: parsed.toAsset || null,
    toChain: parsed.toChain || null,
    amount: parsed.amount || null,
    amountType: parsed.amountType || null,
    portfolio: parsed.portfolio,

    // DCA & Limit Order fields
    frequency: parsed.frequency,
    dayOfWeek: parsed.dayOfWeek,
    dayOfMonth: parsed.dayOfMonth,
    conditionOperator: parsed.conditionOperator,
    conditionValue: parsed.conditionValue,
    conditionAsset: parsed.conditionAsset,

    settleAsset: parsed.settleAsset || null,
    settleNetwork: parsed.settleNetwork || null,
    settleAmount: parsed.settleAmount || null,
    settleAddress: parsed.settleAddress || null,

    // Staking fields
    stakeAsset: parsed.stakeAsset || parsed.fromAsset || null,
    stakeProtocol: parsed.stakeProtocol || null,
    stakeChain: parsed.stakeChain || parsed.fromChain || 'ethereum',
    stakingApr: parsed.stakingApr || null,
    stakeProvider: parsed.stakeProvider || null,

    confidence: confidence,
    validationErrors: allErrors,
    parsedMessage: parsed.parsedMessage || '',
    requiresConfirmation: parsed.requiresConfirmation || false,
    originalInput: userInput
  };
}