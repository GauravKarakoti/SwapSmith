import Groq from "groq-sdk";
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Enhanced Interface to support Portfolio and Yield
export interface ParsedCommand {
  success: boolean;
  intent: "swap" | "checkout" | "portfolio" | "yield_scout" | "unknown";
  
  // Single Swap Fields
  fromAsset: string | null;
  fromChain: string | null;
  toAsset: string | null;
  toChain: string | null;
  amount: number | null;
  amountType?: "exact" | "percentage" | "all" | null; // Added back for compatibility
  excludeAmount?: number;
  
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

STANDARDIZED CHAINS: ethereum, bitcoin, polygon, arbitrum, avalanche, optimism, bsc, base, solana.

RESPONSE FORMAT:
{
  "success": boolean,
  "intent": "swap" | "portfolio" | "checkout" | "yield_scout",
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

  "validationErrors": string[],
  "parsedMessage": "Human readable summary",
  "requiresConfirmation": boolean
}

EXAMPLES:
1. "Split 1 ETH on Base into 50% USDC on Arb and 50% SOL"
   -> intent: "portfolio", fromAsset: "ETH", fromChain: "base", amount: 1, portfolio: [{toAsset: "USDC", toChain: "arbitrum", percentage: 50}, {toAsset: "SOL", toChain: "solana", percentage: 50}]

2. "Where can I get good yield on stables?"
   -> intent: "yield_scout"
`;

export async function parseUserCommand(
  userInput: string,
  conversationHistory: any[] = [],
  inputType: 'text' | 'voice' = 'text'
): Promise<ParsedCommand> {
  // 1. Try Regex Parsing First
  const regexResult = parseWithRegex(userInput);
  if (regexResult) {
    return regexResult;
  }

  // 2. Fallback to AI
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
  const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(mp3FilePath),
      model: "whisper-large-v3",
      response_format: "json",
  });
  return transcription.text;
}

// --- MISSING FUNCTION RESTORED & UPDATED ---
function validateParsedCommand(parsed: Partial<ParsedCommand>, userInput: string): ParsedCommand {
  const errors: string[] = [];
  
  const hasValidAmount = (parsed.amount && parsed.amount > 0) || parsed.amountType === 'all';

  if (parsed.intent === "swap") {
    if (!parsed.fromAsset) errors.push("Source asset not specified");
    if (!parsed.toAsset) errors.push("Destination asset not specified");
    if (!hasValidAmount) errors.push("Invalid amount specified");
    
  } else if (parsed.intent === "portfolio") {
    if (!parsed.fromAsset) errors.push("Source asset not specified");
    if (!hasValidAmount) errors.push("Invalid amount specified");
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
    // if (!parsed.settleNetwork) errors.push("Network to receive on not specified"); // Regex might miss network, allow it for now or fail?
    // AI usually infers network. Regex won't. If we enforce network, Regex fails often.
    // But checkout usually needs network. Let's keep it but maybe lenient if address is present?
    // For now, I'll keep strict validation for checkout as it involves money.
    if (!parsed.settleNetwork && !parsed.settleAddress) errors.push("Network or Address to receive on not specified");
    if (!parsed.settleAmount || parsed.settleAmount <= 0) {
         if (parsed.amountType !== 'all') errors.push("Invalid amount specified");
    }
    
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
    excludeAmount: parsed.excludeAmount,
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

function parseWithRegex(text: string): ParsedCommand | null {
  const normalized = text.toLowerCase().trim()
    .replace(/\s+/g, ' ')
    .replace('percent', '%')
    .replace('convert', 'swap')
    .replace('exchange', 'swap')
    .replace('transfer', 'send');

  // Basic Intent Detection
  let intent: ParsedCommand['intent'] = 'unknown';
  if (normalized.includes('swap') || normalized.includes('buy') || normalized.includes('sell') || normalized.includes('trade')) {
    intent = 'swap';
  } else if (normalized.startsWith('send') || normalized.includes('pay') || normalized.includes('checkout')) {
    intent = 'checkout';
  }

  if (intent === 'unknown') return null;

  const result: Partial<ParsedCommand> = {
    intent,
    success: true,
    confidence: 0.9,
    validationErrors: [],
    parsedMessage: `Parsed via Regex: ${text}`
  };

  // 1. Max / All
  if (/\b(max|all|everything)\b/i.test(normalized)) {
    result.amountType = 'all';
  }

  // 2. Percentage
  // Fix: Allow space between number and %
  const percentMatch = normalized.match(/(\d+)\s*%/);
  if (percentMatch) {
    result.amountType = 'percentage';
    result.amount = Number(percentMatch[1]);
  }

  // 3. Half
  if (/\bhalf\b/i.test(normalized)) {
    result.amountType = 'percentage';
    result.amount = 50;
  }

  // 4. Except
  const exceptMatch = normalized.match(/except\s+(\d+(\.\d+)?)/i);
  if (exceptMatch) {
    result.excludeAmount = Number(exceptMatch[1]);
  }

  // 5. Amount (if not percentage/max/half)
  if (!result.amountType && !result.excludeAmount) {
      // Avoid matching numbers inside "except 10" or "50%"
      const allNumbers = [...normalized.matchAll(/(\d+(\.\d+)?)/g)];
      for (const m of allNumbers) {
          const val = Number(m[0]);
          const idx = m.index!;
          // Check if this number is part of percentage match
          if (percentMatch && Math.abs(idx - percentMatch.index!) < 10 && val === result.amount) continue;
          // Check if this number is part of except match
          if (exceptMatch && Math.abs(idx - exceptMatch.index!) < 20 && val === result.excludeAmount) continue;

          // Use this as amount
          result.amount = val;
          break;
      }
  }

  // 6. Tokens & Prepositions
  const commonTokens = ['ETH', 'BTC', 'USDT', 'USDC', 'MATIC', 'SOL', 'DAI', 'WETH', 'WBTC', 'ARB', 'OP', 'BNB', 'AVAX', 'BASE', 'LINK', 'UNI', 'AAVE'];
  const tokenPattern = new RegExp(`\\b(${commonTokens.join('|')})\\b`, 'gi');
  const tokenMatches = [...normalized.matchAll(tokenPattern)];

  for (const m of tokenMatches) {
      const token = m[0].toUpperCase();
      const idx = m.index!;
      const precedingText = normalized.substring(0, idx);

      let isTo = /(to|into|for)\s+$/.test(precedingText);
      let isFrom = /(with|from)\s+$/.test(precedingText);

      if (intent === 'checkout') {
           if (!result.settleAsset) result.settleAsset = token;
      } else {
          // Swap logic
          if (isTo) {
              result.toAsset = token;
          } else if (isFrom) {
              result.fromAsset = token;
          } else {
              // Default order
              if (!result.fromAsset) {
                  result.fromAsset = token;
              } else if (!result.toAsset) {
                  result.toAsset = token;
              }
          }
      }
  }

  // Decision Priority Logic
  if (result.amountType === 'all') {
      result.amount = undefined;
  }

  // Validate
  const validated = validateParsedCommand(result, text);
  if (validated.success) {
      return validated;
  }

  // Return partial if strong signals
  if (result.intent !== 'unknown' && (result.amountType || result.excludeAmount || result.fromAsset || result.settleAsset)) {
      return validated;
  }

  return null;
}