import Groq from "groq-sdk";
import { safeParseJSON } from "@/lib/safeParse";

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
  intent: "swap" | "checkout" | "portfolio" | "yield_scout" | "dca" | "unknown";

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

STANDARDIZED CHAINS: ethereum, bitcoin, polygon, arbitrum, avalanche, optimism, bsc, base, solana.

RESPONSE FORMAT:
{
  "success": boolean,
  "intent": "swap" | "dca" | "portfolio" | "checkout" | "yield_scout",
  
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

  "confidence": number, // Confidence score 0-100
  "validationErrors": string[],
  "parsedMessage": "Human readable summary",
  "requiresConfirmation": boolean
}
`;

export async function parseUserCommand(userInput: string): Promise<ParsedCommand> {
  try {
    const groq = getGroqClient();
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userInput }
      ],
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 1024,
    });

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
    confidence: confidence,
    validationErrors: allErrors,
    parsedMessage: parsed.parsedMessage || '',
    requiresConfirmation: parsed.requiresConfirmation || false,
    originalInput: userInput
  };
}