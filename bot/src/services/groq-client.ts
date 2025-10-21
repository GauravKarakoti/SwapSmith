import Groq from "groq-sdk";
import dotenv from 'dotenv';
dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Type definition for the parsed command object
export interface ParsedCommand {
  success: boolean;
  intent: "swap" | "unknown";
  fromAsset: string | null;
  fromChain: string | null;
  toAsset: string | null;
  toChain: string | null;
  amount: number | null;
  amountType: "exact" | "percentage" | "all" | null;
  confidence: number;
  validationErrors: string[];
  parsedMessage: string;
  requiresConfirmation: boolean;
  originalInput?: string;
}

// Enhanced system prompt with better validation
const systemPrompt = `
You are a precise cryptocurrency trading assistant. Your role is to extract swap parameters from user messages with high accuracy.

CRITICAL RULES:
1.  Always respond with valid JSON in this exact format.
2.  If ANY parameter is ambiguous, set success: false.
3.  Confirm amounts are numeric and positive.
4.  DO NOT assume default chains. If the user does not specify a chain for 'fromAsset' or 'toAsset', you MUST set 'fromChain' or 'toChain' to null.
5.  **AMBIGUITY RULE**: If an asset (like USDC, USDT) is mentioned without a chain, and it's not clear which chain is intended, you MUST set success: false and add a validationError explaining that the chain is required for that asset.

"STANDARDIZED MAPPINGS":
- Chains: ethereum, bitcoin, polygon, arbitrum, avalanche, optimism, bsc, base, solana
- Assets: Use uppercase symbols (BTC, ETH, USDC, etc.)

RESPONSE FORMAT:
{
  "success": boolean,
  "intent": "swap" | "unknown",
  "fromAsset": string | null,
  "fromChain": string | null,
  "toAsset": string | null,
  "toChain": string | null,
  "amount": number | null,
  "amountType": "exact" | "percentage" | "all" | null,
  "confidence": number, // 0-100 scale
  "validationErrors": string[],
  "parsedMessage": string, // How you interpreted the request
  "requiresConfirmation": boolean // If confidence < 90%
}

VALIDATION CHECKS:
- Amount must be positive number.
- Assets must be valid cryptocurrency symbols.
- Chains must be in standardized list.

EXAMPLES OF AMBIGUOUS (FAILING) REQUESTS:

1.  User: "Swap 0.1 ETH for USDC"
    Reasoning: ETH implies 'ethereum' chain, but USDC exists on many chains (ethereum, polygon, bsc, etc.). The 'toChain' is missing and ambiguous.
    Response:
    {
      "success": false,
      "intent": "swap",
      "fromAsset": "ETH",
      "fromChain": "ethereum",
      "toAsset": "USDC",
      "toChain": null,
      "amount": 0.1,
      "amountType": "exact",
      "confidence": 50,
      "validationErrors": ["'toChain' is required for USDC. Please specify the destination chain (e.g., 'USDC on Polygon')."],
      "parsedMessage": "Swap 0.1 ETH on ethereum for USDC on an unknown chain.",
      "requiresConfirmation": true
    }

2.  User: "Swap 100 USDC for ETH on Base"
    Reasoning: 'toAsset' (ETH) and 'toChain' (Base) are clear. But 'fromAsset' (USDC) has no specified chain ('fromChain').
    Response:
    {
      "success": false,
      "intent": "swap",
      "fromAsset": "USDC",
      "fromChain": null,
      "toAsset": "ETH",
      "toChain": "base",
      "amount": 100,
      "amountType": "exact",
      "confidence": 50,
      "validationErrors": ["'fromChain' is required for USDC. Please specify the source chain (e.g., '100 USDC on Polygon')."],
      "parsedMessage": "Swap 100 USDC on an unknown chain for ETH on Base.",
      "requiresConfirmation": true
    }

EXAMPLE OF A GOOD (SUCCESSFUL) REQUEST:

1.  User: "Swap 0.1 ETH on Ethereum for USDC on BSC"
    Response:
    {
      "success": true,
      "intent": "swap",
      "fromAsset": "ETH",
      "fromChain": "ethereum",
      "toAsset": "USDC",
      "toChain": "bsc",
      "amount": 0.1,
      "amountType": "exact",
      "confidence": 95,
      "validationErrors": [],
      "parsedMessage": "Swapping 0.1 ETH on Ethereum for USDC on BSC.",
      "requiresConfirmation": false
    }
`;

export async function parseUserCommand(userInput: string): Promise<ParsedCommand> {
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Parse this trading request: "${userInput}"` }
      ],
      model: "openai/gpt-oss-20b",
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 500,
    });

    const parsed = JSON.parse(completion.choices[0].message.content || '{}');
    console.log("Raw parsed command:", parsed);
    
    // Additional client-side validation
    return validateParsedCommand(parsed, userInput);
  } catch (error) {
    console.error("Error parsing command:", error);
    return {
      success: false,
      intent: "unknown",
      confidence: 0,
      validationErrors: ["Failed to process your request"],
      parsedMessage: "Error occurred during parsing",
      requiresConfirmation: false,
      fromAsset: null, fromChain: null, toAsset: null, toChain: null, amount: null, amountType: null,
    };
  }
}

function validateParsedCommand(parsed: Partial<ParsedCommand>, userInput: string): ParsedCommand {
  const errors: string[] = [];
  
  // Validate required fields for swap intent
  if (parsed.intent === "swap") {
    if (!parsed.fromAsset) errors.push("Source asset not specified");
    if (!parsed.toAsset) errors.push("Destination asset not specified");
    if (!parsed.amount || parsed.amount <= 0) errors.push("Invalid amount specified");
    
    // ✅ FIX: Added a null check for parsed.amount before comparison
    if (parsed.amountType === "percentage" && parsed.amount != null && (parsed.amount > 100 || parsed.amount < 0)) {
      errors.push("Percentage must be between 0-100");
    }
  }
  
  // Update success status based on validation
  // If the prompt itself set success: false, keep it false.
  const success = parsed.success !== false && errors.length === 0;
  const confidence = errors.length > 0 ? Math.max(0, (parsed.confidence || 0) - 30) : parsed.confidence;
  
  return {
    success,
    intent: parsed.intent || 'unknown',
    fromAsset: parsed.fromAsset || null,
    fromChain: parsed.fromChain || null,
    toAsset: parsed.toAsset || null,
    toChain: parsed.toChain || null,
    amount: parsed.amount || null,
    amountType: parsed.amountType || null,
    confidence: confidence || 0,
    validationErrors: [...(parsed.validationErrors || []), ...errors],
    parsedMessage: parsed.parsedMessage || '',
    requiresConfirmation: parsed.requiresConfirmation || false,
    originalInput: userInput
  };
}