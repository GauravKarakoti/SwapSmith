import Groq from "groq-sdk";
import dotenv from 'dotenv';
import fs from 'fs';
import { handleError } from './logger';

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Enhanced Interface to support Portfolio and Yield
export interface ParsedCommand {
  success: boolean;
  intent: "swap" | "checkout" | "portfolio" | "yield_scout" | "yield_deposit" | "unknown";
  
  // Single Swap Fields
  fromAsset: string | null;
  fromChain: string | null;
  toAsset: string | null;
  toChain: string | null;
  amount: number | null;
  amountType?: "exact" | "percentage" | "all" | null; // Added back for compatibility
  
  // Portfolio Fields (Array of outputs)
  portfolio?: {
    toAsset: string;
    toChain: string;
    percentage: number; // e.g., 50 for 50%
  }[];

  // Checkout Fields
  settleAsset: string | null;
  settleNetwork: string | null;
  settleAmount: number | null;
  settleAddress: string | null;

  confidence: number;
  validationErrors: string[];
  parsedMessage: string;
  requiresConfirmation?: boolean; // Added back for compatibility
  originalInput?: string;         // Added back for compatibility
}

const systemPrompt = `
You are SwapSmith, an advanced DeFi AI agent.
Your job is to parse natural language into specific JSON commands.

MODES:
1. "swap": 1 Input -> 1 Output.
2. "portfolio": 1 Input -> Multiple Outputs (Split allocation).
3. "checkout": Payment link creation.
4. "yield_scout": User asking for high APY/Yield info.
5. "yield_deposit": Deposit assets into yield platforms, possibly bridging if needed.

STANDARDIZED CHAINS: ethereum, bitcoin, polygon, arbitrum, avalanche, optimism, bsc, base, solana.

AMBIGUITY HANDLING:
- If the command is ambiguous (e.g., "swap all my ETH to BTC or USDC"), set confidence low (0-30) and add validation error "Command is ambiguous. Please specify clearly."
- For complex commands, prefer explicit allocations over assumptions.
- If multiple interpretations possible, choose the most straightforward and set requiresConfirmation: true.
- Handle conditional swaps by treating them as portfolio with conditional logic in parsedMessage.

RESPONSE FORMAT:
{
  "success": boolean,
  "intent": "swap" | "portfolio" | "checkout" | "yield_scout" | "yield_deposit",
  "fromAsset": string | null,
  "fromChain": string | null,
  "amount": number | null,
  "amountType": "exact" | "percentage" | "all" | null,

  // Fill for 'swap'
  "toAsset": string | null,
  "toChain": string | null,

  // Fill for 'portfolio'
  "portfolio": [
    { "toAsset": "BTC", "toChain": "bitcoin", "percentage": 50 },
    { "toAsset": "SOL", "toChain": "solana", "percentage": 50 }
  ],

  // Fill for 'checkout'
  "settleAsset": string | null,
  "settleNetwork": string | null,
  "settleAmount": number | null,
  "settleAddress": string | null,

  "confidence": number,  // 0-100, lower for ambiguous
  "validationErrors": string[],
  "parsedMessage": "Human readable summary",
  "requiresConfirmation": boolean
}

EXAMPLES:
1. "Split 1 ETH on Base into 50% USDC on Arb and 50% SOL"
   -> intent: "portfolio", fromAsset: "ETH", fromChain: "base", amount: 1, portfolio: [{toAsset: "USDC", toChain: "arbitrum", percentage: 50}, {toAsset: "SOL", toChain: "solana", percentage: 50}], confidence: 95

2. "Where can I get good yield on stables?"
   -> intent: "yield_scout", confidence: 100

3. "Swap 1 ETH to BTC or USDC" (ambiguous)
   -> intent: "swap", fromAsset: "ETH", toAsset: null, confidence: 20, validationErrors: ["Command is ambiguous. Please specify clearly."], requiresConfirmation: true

4. "If ETH > $3000, swap to BTC, else to USDC" (conditional)
   -> intent: "portfolio", fromAsset: "ETH", portfolio: [{toAsset: "BTC", toChain: "bitcoin", percentage: 100}], confidence: 70, parsedMessage: "Conditional swap: If ETH > $3000, swap to BTC", requiresConfirmation: true

5. "Deposit 1 ETH to yield"
   -> intent: "yield_deposit", fromAsset: "ETH", amount: 1, confidence: 95
`;

export async function parseUserCommand(
  userInput: string,
  conversationHistory: any[] = [],
  inputType: 'text' | 'voice' = 'text'
): Promise<ParsedCommand> {
  let currentSystemPrompt = systemPrompt;

  if (inputType === 'voice') {
    currentSystemPrompt += `
    \n\nVOICE MODE ACTIVE: 
    1. The user is speaking. Be more lenient with phonetic typos (e.g., "Ether" vs "Ethereum").
    2. In the 'parsedMessage' field, write the response as if it will be spoken aloud. Keep it concise, friendly, and avoid special characters like asterisks or complex formatting.
    `;
  }

  try {
    const messages: any[] = [
        { role: "system", content: currentSystemPrompt },
        ...conversationHistory,
        { role: "user", content: userInput }
    ];

    const completion = await groq.chat.completions.create({
      messages: messages,
      model: "llama-3.3-70b-versatile", 
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 2048, 
    });

    const parsed = JSON.parse(completion.choices[0].message.content || '{}');
    console.log("Parsed:", parsed);
    return validateParsedCommand(parsed, userInput);
  } catch (error) {
    console.error("Groq Error:", error);
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
    const transcription = await groq.audio.transcriptions.create({
        file: fs.createReadStream(mp3FilePath),
        model: "whisper-large-v3",
        response_format: "json",
    });
    return transcription.text;
  } catch (error) {
    await handleError('TranscriptionError', { error: error instanceof Error ? error.message : 'Unknown error', filePath: mp3FilePath }, null, false);
    throw error; // Re-throw to let caller handle
  }
}

// --- MISSING FUNCTION RESTORED & UPDATED ---
function validateParsedCommand(parsed: Partial<ParsedCommand>, userInput: string): ParsedCommand {
  const errors: string[] = [];
  
  if (parsed.intent === "swap") {
    if (!parsed.fromAsset) errors.push("Source asset not specified");
    if (!parsed.toAsset) errors.push("Destination asset not specified");
    if (!parsed.amount || parsed.amount <= 0) errors.push("Invalid amount specified");
    
  } else if (parsed.intent === "portfolio") {
    if (!parsed.fromAsset) errors.push("Source asset not specified");
    if (!parsed.amount || parsed.amount <= 0) errors.push("Invalid amount specified");
    if (!parsed.portfolio || parsed.portfolio.length === 0) {
      errors.push("No portfolio allocation specified");
    } else {
      // Validate portfolio percentages
      const totalPercentage = parsed.portfolio.reduce((sum, item) => sum + (item.percentage || 0), 0);
      if (Math.abs(totalPercentage - 100) > 1) { // Allow slight float tolerance
        errors.push(`Total allocation is ${totalPercentage}%, but should be 100%`);
      }
    }

  } else if (parsed.intent === "checkout") {
    if (!parsed.settleAsset) errors.push("Asset to receive not specified");
    if (!parsed.settleNetwork) errors.push("Network to receive on not specified");
    if (!parsed.settleAmount || parsed.settleAmount <= 0) errors.push("Invalid amount specified");
    
  } else if (parsed.intent === "yield_scout") {
    // No specific validation needed for yield scout, just needs the intent
    if (!parsed.success && (!parsed.validationErrors || parsed.validationErrors.length === 0)) {
       // If AI marked as failed but didn't give a reason, we might still accept it if intent is clear
       // But usually, we trust the AI's success flag here.
    }
  } else if (!parsed.intent || parsed.intent === "unknown") {
      if (parsed.success === false && parsed.validationErrors && parsed.validationErrors.length > 0) {
         // Keep prompt-level validation errors
      } else {
        errors.push("Could not determine intent.");
      }
  }
  
  // Combine all errors
  const allErrors = [...(parsed.validationErrors || []), ...errors];

  // Additional validation for low confidence
  if ((parsed.confidence || 0) < 50) {
    allErrors.push("Low confidence in parsing. Please rephrase your command for clarity.");
  }

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
    portfolio: parsed.portfolio, // Pass through portfolio
    settleAsset: parsed.settleAsset || null,
    settleNetwork: parsed.settleNetwork || null,
    settleAmount: parsed.settleAmount || null,
    settleAddress: parsed.settleAddress || null, 
    confidence: confidence || 0,
    validationErrors: allErrors,
    parsedMessage: parsed.parsedMessage || '',
    requiresConfirmation: parsed.requiresConfirmation || false,
    originalInput: userInput
  };
}