import Groq from "groq-sdk";
import dotenv from 'dotenv';
// --- NEW: Import fs for audio ---
import fs from 'fs';
// --- END NEW ---

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Type definition for the parsed command object
export interface ParsedCommand {
  success: boolean;
  intent: "swap" | "checkout" | "unknown";
  // Swap fields
  fromAsset: string | null;
  fromChain: string | null;
  toAsset: string | null;
  toChain: string | null;
  amount: number | null;
  amountType: "exact" | "percentage" | "all" | null;
  // Checkout fields
  settleAsset: string | null;
  settleNetwork: string | null;
  settleAmount: number | null;
  settleAddress: string | null; // <-- ADDED THIS FIELD
  // Common fields
  confidence: number;
  validationErrors: string[];
  parsedMessage: string;
  requiresConfirmation: boolean;
  originalInput?: string;
}

// Enhanced system prompt with better validation
const systemPrompt = `
You are a precise cryptocurrency trading assistant. Your role is to extract parameters from user messages with high accuracy.

CRITICAL RULES:
1.  Always respond with valid JSON in this exact format.
2.  If ANY parameter is ambiguous, set success: false.
3.  Confirm amounts are numeric and positive.
4.  DO NOT assume default chains. If the user does not specify a chain for an asset, you MUST set its corresponding chain to null.
5.  **AMBIGUITY RULE**: If an asset (like USDC, USDT) is mentioned without a chain (for 'fromChain', 'toChain', or 'settleNetwork'), you MUST set success: false and add a validationError explaining that the chain is required.
6.  **NO CHAIN INFERENCE**: Never infer a 'fromChain' from a 'toChain' or vice-versa.
7.  **CONTEXT RULE**: If previous messages are provided, use them to resolve ambiguity. If the user provides info that was previously missing, set success: true.

"STANDARDIZED MAPPINGS":
- Chains: ethereum, bitcoin, polygon, arbitrum, avalanche, optimism, bsc, base, solana
- Assets: Use uppercase symbols (BTC, ETH, USDC, etc.)

INTENTS:
- "swap": User wants to exchange one asset for another (e.g., "Swap 0.1 ETH for BTC").
- "checkout": User wants to generate a payment link for a specific amount and asset. This can be for *themselves* (e.g., "I need 50 USDC on Polygon") or for *someone else* (e.g., "Send 50 USDC on Polygon to 0x123...").

RESPONSE FORMAT:
{
  "success": boolean,
  "intent": "swap" | "checkout" | "unknown",
  "fromAsset": string | null,
  "fromChain": string | null,
  "toAsset": string | null,
  "toChain": string | null,
  "amount": number | null,
  "amountType": "exact" | "percentage" | "all" | null,
  "settleAsset": string | null,
  "settleNetwork": string | null,
  "settleAmount": number | null,
  "settleAddress": string | null, // <-- ADDED THIS FIELD
  "confidence": number, // 0-100 scale
  "validationErrors": string[],
  "parsedMessage": string, // How you interpreted the request
  "requiresConfirmation": boolean
}

VALIDATION CHECKS:
- Amount/settleAmount must be positive number.
- Assets must be valid cryptocurrency symbols.
- Chains must be in standardized list.

---
EXAMPLE 1: GOOD SWAP
User: "Swap 0.1 ETH on Ethereum for USDC on BSC"
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
  "settleAsset": null,
  "settleNetwork": null,
  "settleAmount": null,
  "settleAddress": null,
  "confidence": 95,
  "validationErrors": [],
  "parsedMessage": "Swapping 0.1 ETH on Ethereum for USDC on BSC.",
  "requiresConfirmation": false
}
---
EXAMPLE 2: BAD SWAP (Missing 'fromChain')
User: "Swap 100 USDC for ETH on Base"
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
  "settleAsset": null,
  "settleNetwork": null,
  "settleAmount": null,
  "settleAddress": null,
  "confidence": 50,
  "validationErrors": ["'fromChain' is required for USDC. Please specify the source chain (e.g., '100 USDC on Polygon')."],
  "parsedMessage": "Swap 100 USDC on an unknown chain for ETH on Base.",
  "requiresConfirmation": true
}
---
EXAMPLE 3: GOOD CHECKOUT (for self)
User: "I want 50 USDC on Polygon"
Response:
{
  "success": true,
  "intent": "checkout",
  "fromAsset": null,
  "fromChain": null,
  "toAsset": null,
  "toChain": null,
  "amount": null,
  "amountType": null,
  "settleAsset": "USDC",
  "settleNetwork": "polygon",
  "settleAmount": 50,
  "settleAddress": null, // <-- User's own address will be used
  "confidence": 95,
  "validationErrors": [],
  "parsedMessage": "Creating a checkout to receive 50 USDC on Polygon.",
  "requiresConfirmation": false
}
---
EXAMPLE 4: BAD CHECKOUT (Missing 'settleNetwork')
User: "Create a payment link for 50 USDC"
Response:
{
  "success": false,
  "intent": "checkout",
  "fromAsset": null,
  "fromChain": null,
  "toAsset": null,
  "toChain": null,
  "amount": null,
  "amountType": null,
  "settleAsset": "USDC",
  "settleNetwork": null,
  "settleAmount": 50,
  "settleAddress": null,
  "confidence": 40,
  "validationErrors": ["'settleNetwork' is required for USDC. Please specify the chain (e.g., '50 USDC on Polygon')."],
  "parsedMessage": "Creating a checkout to receive 50 USDC on an unknown chain.",
  "requiresConfirmation": true
}
---
EXAMPLE 5: GOOD CHECKOUT (with specific address)
User: "Send 50 USDC on Polygon to 0x1234567890abcdef1234567890abcdef12345678"
Response:
{
  "success": true,
  "intent": "checkout",
  "fromAsset": null,
  "fromChain": null,
  "toAsset": null,
  "toChain": null,
  "amount": null,
  "amountType": null,
  "settleAsset": "USDC",
  "settleNetwork": "polygon",
  "settleAmount": 50,
  "settleAddress": "0x1234567890abcdef1234567890abcdef12345678",
  "confidence": 95,
  "validationErrors": [],
  "parsedMessage": "Creating a checkout to send 50 USDC on Polygon to 0x1234...",
  "requiresConfirmation": false
}
---
EXAMPLE 6: CONTEXTUAL FOLLOW-UP
(The following messages are in sequence)

Message 1 (User): "Swap 100 USDC for ETH on Base"
Message 2 (Assistant): "'fromChain' is required for USDC. Please specify the source chain (e.g., '100 USDC on Polygon')."
Message 3 (User): "on polygon"
Response:
{
  "success": true,
  "intent": "swap",
  "fromAsset": "USDC",
  "fromChain": "polygon",
  "toAsset": "ETH",
  "toChain": "base",
  "amount": 100,
  "amountType": "exact",
  "settleAsset": null,
  "settleNetwork": null,
  "settleAmount": null,
  "settleAddress": null,
  "confidence": 90,
  "validationErrors": [],
  "parsedMessage": "Swapping 100 USDC on Polygon for ETH on Base.",
  "requiresConfirmation": false
}
`;

// --- MODIFIED: Accept conversation history for context ---
export async function parseUserCommand(
  userInput: string,
  conversationHistory: Groq.Chat.Completions.ChatCompletionMessageParam[] = []
): Promise<ParsedCommand> {
  try {
    const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...conversationHistory,
        { role: "user", content: `Parse this trading request: "${userInput}"` }
    ];

    const completion = await groq.chat.completions.create({
      messages: messages,
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
      settleAsset: null, settleNetwork: null, settleAmount: null, settleAddress: null, // <-- ADDED
    };
  }
}
// --- END MODIFIED ---

// --- NEW: Function to transcribe audio ---
export async function transcribeAudio(mp3FilePath: string): Promise<string> {
  console.log(`Transcribing audio file: ${mp3FilePath}`);
  try {
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(mp3FilePath),
      model: "whisper-large-v3",
      response_format: "json",
    });
    console.log(`Transcription result: ${transcription.text}`);
    return transcription.text;
  } catch (error) {
    console.error("Error transcribing audio:", error);
    throw new Error("Failed to transcribe audio.");
  }
}
// --- END NEW ---


function validateParsedCommand(parsed: Partial<ParsedCommand>, userInput: string): ParsedCommand {
  const errors: string[] = [];
  
  if (parsed.intent === "swap") {
    if (!parsed.fromAsset) errors.push("Source asset not specified");
    if (!parsed.toAsset) errors.push("Destination asset not specified");
    if (!parsed.amount || parsed.amount <= 0) errors.push("Invalid amount specified");
    
    if (parsed.amountType === "percentage" && parsed.amount != null && (parsed.amount > 100 || parsed.amount < 0)) {
      errors.push("Percentage must be between 0-100");
    }
  } else if (parsed.intent === "checkout") {
    if (!parsed.settleAsset) errors.push("Asset to receive not specified");
    if (!parsed.settleNetwork) errors.push("Network to receive on not specified");
    if (!parsed.settleAmount || parsed.settleAmount <= 0) errors.push("Invalid amount specified");
    // We don't validate settleAddress here, as null is acceptable (it means 'use my wallet')
  } else if (!parsed.intent || parsed.intent === "unknown") {
      if (parsed.success === false && parsed.validationErrors && parsed.validationErrors.length > 0) {
         // Keep prompt-level validation errors
      } else {
        errors.push("Could not determine intent. Please try 'swap' or 'receive'.");
      }
  }
  
  // Combine all errors
  const allErrors = [...(parsed.validationErrors || []), ...errors];

  // Update success status based on validation
  const success = parsed.success !== false && allErrors.length === 0;
  const confidence = allErrors.length > 0 ? Math.max(0, (parsed.confidence || 0) - 30) : parsed.confidence;
  
  return {
    success,
    intent: parsed.intent || 'unknown',
    fromAsset: parsed.fromAsset || null,
    fromChain: parsed.fromChain || null,
    toAsset: parsed.toAsset || null,
    toChain: parsed.toChain || null,
    amount: parsed.amount || null,
    amountType: parsed.amountType || null,
    settleAsset: parsed.settleAsset || null,
    settleNetwork: parsed.settleNetwork || null,
    settleAmount: parsed.settleAmount || null,
    settleAddress: parsed.settleAddress || null, // <-- ADDED
    confidence: confidence || 0,
    validationErrors: allErrors,
    parsedMessage: parsed.parsedMessage || '',
    requiresConfirmation: parsed.requiresConfirmation || false,
    originalInput: userInput
  };
}