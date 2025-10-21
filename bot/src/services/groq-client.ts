import Groq from "groq-sdk";
import dotenv from 'dotenv';
dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Type definition for the parsed command object
export interface ParsedCommand {
  success: boolean;
  intent: "checkout" | "unknown";
  settleAsset: string | null;
  settleNetwork: string | null;
  settleAmount: number | null;
  confidence: number;
  validationErrors: string[];
  parsedMessage: string;
  requiresConfirmation: boolean;
  originalInput?: string;
}

// Enhanced system prompt for SideShift Pay (settleAmount focused)
const systemPrompt = `
You are a precise cryptocurrency payment assistant. Your role is to extract what asset and amount the user wants to *RECEIVE*.

CRITICAL RULES:
1.  Always respond with valid JSON in this exact format.
2.  The user's intent is to create a 'checkout'.
3.  You must extract the 'settleAsset' (what they want to receive), 'settleNetwork' (the chain they want to receive on), and 'settleAmount' (how much they want to receive).
4.  If ANY of these three parameters (settleAsset, settleNetwork, settleAmount) are missing or ambiguous, you MUST set success: false.
5.  DO NOT assume default chains. If a user says "I want 50 USDC" it is ambiguous. They must say "I want 50 USDC on Polygon".
6.  The 'from' asset (what the user is paying with) is IRRELEVANT. Do not try to parse it. The user will choose what to pay with on the payment page.

"STANDARDIZED MAPPINGS":
- Chains: ethereum, bitcoin, polygon, arbitrum, avalanche, optimism, bsc, base, solana
- Assets: Use uppercase symbols (BTC, ETH, USDC, etc.)

RESPONSE FORMAT:
{
  "success": boolean,
  "intent": "checkout" | "unknown",
  "settleAsset": string | null,
  "settleNetwork": string | null,
  "settleAmount": number | null,
  "confidence": number, // 0-100 scale
  "validationErrors": string[],
  "parsedMessage": string, // How you interpreted the request
  "requiresConfirmation": boolean // If confidence < 90%
}

VALIDATION CHECKS:
- settleAmount must be a positive number.
- settleAsset must be a valid cryptocurrency symbol.
- settleNetwork must be in the standardized list.

EXAMPLES OF AMBIGUOUS (FAILING) REQUESTS:

1.  User: "Swap 0.1 ETH for USDC"
    Reasoning: The user is specifying what they want to *send* (0.1 ETH), not what they want to *receive*. The 'settleAmount' is unknown.
    Response:
    {
      "success": false,
      "intent": "checkout",
      "settleAsset": "USDC",
      "settleNetwork": null,
      "settleAmount": null,
      "confidence": 20,
      "validationErrors": ["Please specify the amount you want to *receive* (e.g., 'I want 150 USDC on Polygon').", "The destination chain for USDC is missing."],
      "parsedMessage": "User wants to receive an unknown amount of USDC on an unknown chain.",
      "requiresConfirmation": true
    }

2.  User: "I want 100 USDC"
    Reasoning: 'settleAmount' (100) and 'settleAsset' (USDC) are clear. But 'settleNetwork' is missing and ambiguous.
    Response:
    {
      "success": false,
      "intent": "checkout",
      "settleAsset": "USDC",
      "settleNetwork": null,
      "settleAmount": 100,
      "confidence": 50,
      "validationErrors": ["'settleNetwork' is required for USDC. Please specify the destination chain (e.g., '100 USDC on Polygon')."],
      "parsedMessage": "User wants 100 USDC on an unknown chain.",
      "requiresConfirmation": true
    }

EXAMPLE OF A GOOD (SUCCESSFUL) REQUEST:

1.  User: "I need 50 MATIC on Polygon"
    Response:
    {
      "success": true,
      "intent": "checkout",
      "settleAsset": "MATIC",
      "settleNetwork": "polygon",
      "settleAmount": 50,
      "confidence": 95,
      "validationErrors": [],
      "parsedMessage": "Creating a checkout to receive 50 MATIC on Polygon.",
      "requiresConfirmation": false
    }
`;

export async function parseUserCommand(userInput: string): Promise<ParsedCommand> {
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Parse this payment request: "${userInput}"` }
      ],
      model: "openai/gpt-oss-20b", // Using a recommended model
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
      settleAsset: null, settleNetwork: null, settleAmount: null,
    };
  }
}

function validateParsedCommand(parsed: Partial<ParsedCommand>, userInput: string): ParsedCommand {
  const errors: string[] = [];
  
  // Validate required fields for checkout intent
  if (parsed.intent === "checkout") {
    if (!parsed.settleAsset) errors.push("Destination asset not specified (e.g., 'USDC')");
    if (!parsed.settleNetwork) errors.push("Destination network not specified (e.g., 'on Polygon')");
    if (!parsed.settleAmount || parsed.settleAmount <= 0) errors.push("Invalid amount specified (e.g., '50 USDC')");
  } else if (parsed.success) {
      // If Groq succeeded but didn't set intent to checkout, force fail
      errors.push("I could not determine the asset and amount you want to receive.");
  }
  
  // Update success status based on validation
  // If the prompt itself set success: false, keep it false.
  const success = parsed.success !== false && errors.length === 0;
  const confidence = errors.length > 0 ? Math.max(0, (parsed.confidence || 0) - 30) : parsed.confidence;
  
  return {
    success,
    intent: parsed.intent || 'unknown',
    settleAsset: parsed.settleAsset || null,
    settleNetwork: parsed.settleNetwork || null,
    settleAmount: parsed.settleAmount || null,
    confidence: confidence || 0,
    validationErrors: [...(parsed.validationErrors || []), ...errors],
    parsedMessage: parsed.parsedMessage || '',
    requiresConfirmation: parsed.requiresConfirmation || false,
    originalInput: userInput
  };
}