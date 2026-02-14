import Groq from "groq-sdk";
import dotenv from 'dotenv';
import fs from 'fs';
import { handleError } from './logger';
import { analyzeCommand, generateContextualHelp } from './contextual-help';

dotenv.config();

// Global singleton declaration to prevent multiple instances
declare global {
  var _groqClient: Groq | undefined;
}

/**
 * Production-grade singleton pattern for Groq client
 * - Prevents new instance per request
 * - Reuses client connection pool
 * - Avoids TCP connection exhaustion
 */
function getGroqClient(): Groq {
  if (!global._groqClient) {
    global._groqClient = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
  }
  return global._groqClient;
}

const groq = getGroqClient();

// Enhanced Interface to support Portfolio and Yield
export interface ParsedCommand {
  success: boolean;
  intent: "swap" | "checkout" | "portfolio" | "yield_scout" | "yield_deposit" | "yield_migrate" | "dca" | "unknown";
  
  // Single Swap Fields
  fromAsset: string | null;
  fromChain: string | null;
  toAsset: string | null;
  toChain: string | null;
  amount: number | null;
  amountType?: "exact" | "percentage" | "all" | "exclude" | null; // Added back for compatibility

  excludeAmount?: number;
  excludeToken?: string;
  
  // Portfolio Fields (Array of outputs)
  portfolio?: {
    toAsset: string;
    toChain: string;
    percentage: number; // e.g., 50 for 50%
  }[];

  // DCA Fields
  frequency?: "daily" | "weekly" | "monthly" | null;
  dayOfWeek?: string | null; // For weekly: "monday", "tuesday", etc.
  dayOfMonth?: string | null; // For monthly: "1", "15", etc.

  // Checkout Fields
  settleAsset: string | null;
  settleNetwork: string | null;
  settleAmount: number | null;
  settleAddress: string | null;

  fromProject: string | null;
  fromYield: number | null;
  toProject: string | null;
  toYield: number | null;

  // Limit Order Fields
  conditionOperator?: 'gt' | 'lt';
  conditionValue?: number;
  conditionAsset?: string;

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
6. "yield_migrate": Move funds from a lower-yielding pool to a higher-yielding pool on the same or different chain.
7. "dca": Dollar Cost Averaging - Recurring automated swaps at regular intervals (daily, weekly, monthly).

STANDARDIZED CHAINS: ethereum, bitcoin, polygon, arbitrum, avalanche, optimism, bsc, base, solana.

ADDRESS RESOLUTION:
- Users can specify addresses as raw wallet addresses (0x...), ENS names (ending in .eth), Lens handles (ending in .lens), Unstoppable Domains (ending in .crypto, .nft, .blockchain, etc.), or nicknames from their address book.
- If an address is specified, include it in settleAddress field.
- The system will resolve nicknames, ENS, Lens, and Unstoppable Domains automatically.

IMPORTANT: ENS/ADDRESS HANDLING:
- When a user says "Swap X ETH to vitalik.eth" or "Send X ETH to vitalik.eth", they mean:
  * Keep the same asset (ETH)
  * Send it to the address vitalik.eth
  * This should be parsed as: toAsset: "ETH", toChain: "ethereum", settleAddress: "vitalik.eth"
- Patterns to recognize as addresses (not assets):
  * Ends with .eth (ENS)
  * Ends with .lens (Lens Protocol)
  * Ends with .crypto, .nft, .blockchain, .wallet, etc. (Unstoppable Domains)
  * Starts with 0x followed by 40 hex characters
  * Looks like a nickname (single word, lowercase, no special chars)

AMBIGUITY HANDLING:
- If the command is ambiguous (e.g., "swap all my ETH to BTC or USDC"), set confidence low (0-30) and add validation error "Command is ambiguous. Please specify clearly."
- For complex commands, prefer explicit allocations over assumptions.
- If multiple interpretations possible, choose the most straightforward and set requiresConfirmation: true.
- Handle conditional swaps by treating them as portfolio with conditional logic in parsedMessage.

RESPONSE FORMAT:
{
  "success": boolean,
  "intent": "swap" | "portfolio" | "checkout" | "yield_scout" | "yield_deposit" | "yield_migrate" | "dca",
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

  // Fill for 'dca'
  "frequency": "daily" | "weekly" | "monthly",
  "dayOfWeek": "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday" | null,
  "dayOfMonth": "1" | "15" | "28" | null,

  // Fill for 'checkout'
  "settleAsset": string | null,
  "settleNetwork": string | null,
  "settleAmount": number | null,
  "settleAddress": string | null,

  // Fill for 'yield_migrate'
  "fromProject": string | null,    // Current yield platform/project
  "fromYield": number | null,      // Current yield rate (percentage)
  "toProject": string | null,      // Target yield platform/project
  "toChain": string | null,        // Target chain for migration

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

6. "Swap 1 ETH to mywallet"
   -> intent: "swap", fromAsset: "ETH", toAsset: "ETH", toChain: "ethereum", amount: 1, settleAddress: "mywallet", confidence: 95

7. "Send 5 USDC to vitalik.eth"
   -> intent: "checkout", settleAsset: "USDC", settleNetwork: "ethereum", settleAmount: 5, settleAddress: "vitalik.eth", confidence: 95

8. "Move my USDC from Aave on Base to a higher yield pool"
   -> intent: "yield_migrate", fromAsset: "USDC", fromChain: "base", fromProject: "Aave", confidence: 95

9. "Switch my ETH yield from 5% to something better"
   -> intent: "yield_migrate", fromAsset: "ETH", fromYield: 5, confidence: 90

10. "Migrate my stables to the best APY pool"
    -> intent: "yield_migrate", fromAsset: "USDC", confidence: 85

11. "Swap $50 of USDC for ETH every Monday"
    -> intent: "dca", fromAsset: "USDC", toAsset: "ETH", amount: 50, frequency: "weekly", dayOfWeek: "monday", confidence: 95

12. "Buy 100 USDC of BTC daily"
    -> intent: "dca", fromAsset: "USDC", toAsset: "BTC", amount: 100, frequency: "daily", confidence: 95

13. "DCA 200 USDC into ETH every month on the 1st"
    -> intent: "dca", fromAsset: "USDC", toAsset: "ETH", amount: 200, frequency: "monthly", dayOfMonth: "1", confidence: 95
`;

export async function parseWithLLM(
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
    return validateParsedCommand(parsed, userInput, inputType);
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
function validateParsedCommand(parsed: Partial<ParsedCommand>, userInput: string, inputType: 'text' | 'voice' = 'text'): ParsedCommand {
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
  } else if (parsed.intent === "yield_migrate") {
    if (!parsed.fromAsset) errors.push("Source asset not specified for migration");
    if (parsed.amount && parsed.amount <= 0) errors.push("Invalid migration amount");
  } else if (parsed.intent === "dca") {
    if (!parsed.fromAsset) errors.push("Source asset not specified");
    if (!parsed.toAsset) errors.push("Destination asset not specified");
    if (!parsed.amount || parsed.amount <= 0) errors.push("Invalid amount specified");
    if (!parsed.frequency) errors.push("Frequency not specified (daily, weekly, or monthly)");
    if (parsed.frequency === "weekly" && !parsed.dayOfWeek) errors.push("Day of week not specified for weekly DCA");
    if (parsed.frequency === "monthly" && !parsed.dayOfMonth) errors.push("Day of month not specified for monthly DCA");
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
  
  const result: ParsedCommand = {
    success,
    intent: parsed.intent || 'unknown',
    fromAsset: parsed.fromAsset || null,
    fromChain: parsed.fromChain || null,
    toAsset: parsed.toAsset || null,
    toChain: parsed.toChain || null,
    amount: parsed.amount || null,
    amountType: parsed.amountType || null,
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
    confidence: confidence || 0,
    validationErrors: allErrors,
    parsedMessage: parsed.parsedMessage || '',
    requiresConfirmation: parsed.requiresConfirmation || false,
    originalInput: userInput
  };

  // Generate contextual help if there are errors or low confidence
  if (allErrors.length > 0 || (confidence ?? 0) < 50) {
    try {
      console.log('🔍 Generating contextual help...');
      console.log('Errors:', allErrors);
      console.log('Confidence:', confidence);
      
      const analysis = analyzeCommand(result);
      console.log('Analysis:', JSON.stringify(analysis, null, 2));
      
      const contextualHelp = generateContextualHelp(analysis, userInput, inputType);
      console.log('Contextual Help Generated:', contextualHelp);
      
      // Replace generic low confidence message with contextual help
      const lowConfidenceIndex = result.validationErrors.findIndex(err => 
        err.includes('Low confidence') || err.includes('Please rephrase')
      );
      
      if (lowConfidenceIndex !== -1) {
        result.validationErrors[lowConfidenceIndex] = contextualHelp;
        console.log('✅ Replaced low confidence message');
      } else if (result.validationErrors.length > 0) {
        // Add contextual help as additional guidance
        result.validationErrors.push(contextualHelp);
        console.log('✅ Added contextual help to errors');
      } else {
        result.validationErrors = [contextualHelp];
        console.log('✅ Set contextual help as only error');
      }
      
      console.log('Final validation errors:', result.validationErrors);
    } catch (error) {
      console.error('❌ Contextual help generation failed:', error);
      // Fallback to existing error messages
    }
  }
  
  return result;
}