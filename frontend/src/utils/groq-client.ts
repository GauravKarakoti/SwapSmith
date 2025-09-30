import Groq from "groq-sdk";

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
1. Always respond with valid JSON in this exact format
2. If ANY parameter is ambiguous, set success: false
3. Confirm amounts are numeric and positive
4. Validate asset/chain combinations exist

STANDARDIZED MAPPINGS:
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
- Amount must be positive number
- Assets must be valid cryptocurrency symbols
- Chains must be in standardized list
- Cross-chain swaps must have both chains specified
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
