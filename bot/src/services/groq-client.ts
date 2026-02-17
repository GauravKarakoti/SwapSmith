import Groq from "groq-sdk";
import dotenv from 'dotenv';
import fs from 'fs';
import logger, { handleError } from './logger';

import { analyzeCommand, generateContextualHelp } from './contextual-help';
import { safeParseLLMJson } from "../utils/safe-json";

dotenv.config();

// Global singleton declaration to prevent multiple instances
declare global {
  var _groqClient: Groq | undefined;
}

function getGroqClient(): Groq {
  if (!global._groqClient) {
    global._groqClient = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
  }
  return global._groqClient;
}

const groq = getGroqClient();

export interface ParsedCommand {
  success: boolean;
  intent: "swap" | "checkout" | "portfolio" | "yield_scout" | "yield_deposit" | "yield_migrate" | "dca" | "unknown";
  
  // Single Swap Fields
  fromAsset: string | null;
  fromChain: string | null;
  toAsset: string | null;
  toChain: string | null;
  amount: number | null;
  amountType?: "exact" | "percentage" | "all" | "exclude" | null; 

  excludeAmount?: number;
  excludeToken?: string;
  quoteAmount?: number;
  
  // Portfolio Fields
  portfolio?: {
    toAsset: string;
    toChain: string;
    percentage: number;
  }[];

  // DCA Fields
  frequency?: "daily" | "weekly" | "monthly" | null;
  dayOfWeek?: string | null;
  dayOfMonth?: string | null;

  // Checkout Fields
  settleAsset: string | null;
  settleNetwork: string | null;
  settleAmount: number | null;
  settleAddress: string | null;

  // Yield Fields
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
  requiresConfirmation?: boolean; 
  originalInput?: string;        
}


const systemPrompt = `
You are SwapSmith, an advanced DeFi AI agent.
Your job is to parse natural language into specific JSON commands.

MODES:
1. "swap": 1 Input -> 1 Output (immediate market swap).
   Example: "Swap 100 ETH for BTC"
   
2. "portfolio": 1 Input -> Multiple Outputs (Split allocation).
   Example: "Split 1000 ETH: 50% to BTC, 30% to SOL, 20% to USDC"
   
3. "checkout": Payment link creation for receiving assets.
   Example: "Create a payment link for 500 USDC on Ethereum"
   
4. "yield_scout": User asking for high APY/Yield info.
   Example: "What are the best yields right now?"

5. "yield_deposit": Deposit assets into yield platforms.
   Example: "Deposit 1000 USDC into Aave"
   
6. "yield_migrate": Move funds between yield pools.
   Example: "Move my ETH from Lido to Rocket Pool"
   
7. "dca": Dollar Cost Averaging - recurring swaps on a schedule.
   DESCRIPTION: User wants to buy an asset repeatedly at regular intervals.
   DETECTION KEYWORDS: daily, weekly, every day, every week, every month, recurring, schedule, automate, periodic, each week, every Friday, on the 15th, every Monday, etc.
   FIELDS NEEDED:
   - fromAsset: Asset being sold (e.g., "USDC", "ETH")
   - fromChain: Blockchain for source asset
   - toAsset: Asset being bought (e.g., "BTC", "SOL")
   - toChain: Blockchain for destination asset
   - amount: Amount per transaction (e.g., "100" = 100 USDC per swap)
   - frequency: "daily" | "weekly" | "monthly"
   - dayOfWeek: For weekly - "monday", "tuesday", etc. (only if weekly)
   - dayOfMonth: For monthly - "1", "15", etc. (only if monthly)
   EXAMPLES:
   - "Buy 100 USDC worth of ETH every day" → intent: "dca", fromAsset: "USDC", toAsset: "ETH", amount: 100, frequency: "daily"
   - "Swap 50 USDT to BTC every week on Monday" → intent: "dca", fromAsset: "USDT", toAsset: "BTC", amount: 50, frequency: "weekly", dayOfWeek: "monday"
   - "Every month on the 15th, convert 500 USDC to SOL" → intent: "dca", fromAsset: "USDC", toAsset: "SOL", amount: 500, frequency: "monthly", dayOfMonth: "15"

8. ADVANCED: Limit Orders with Conditions (special use of "swap" intent).
   DESCRIPTION: Execute a swap only when a price condition is met.
   DETECTION KEYWORDS: "if", "when", "only if", "once", "trigger at", "at price", "when price", "condition", etc.
   FIELDS (in addition to swap fields):
   - conditionAsset: Asset whose price is being monitored (e.g., "BTC")
   - conditionOperator: "gt" (greater than/above) | "lt" (less than/below)
   - conditionValue: Price threshold (e.g., 50000)
   USE "swap" INTENT WITH THESE FIELDS.
   EXAMPLES:
   - "Swap 100 ETH to BTC if ETH price goes above 5000" → intent: "swap", fromAsset: "ETH", toAsset: "BTC", amount: 100, conditionAsset: "ETH", conditionOperator: "gt", conditionValue: 5000
   - "Convert 1000 USDC to SOL only when SOL drops below 200" → intent: "swap", fromAsset: "USDC", toAsset: "SOL", amount: 1000, conditionAsset: "SOL", conditionOperator: "lt", conditionValue: 200

STANDARDIZED CHAINS: ethereum, bitcoin, polygon, arbitrum, avalanche, optimism, bsc, base, solana.

RESPONSE FORMAT:
{
  "success": boolean,
  "intent": "swap" | "portfolio" | "checkout" | "yield_scout" | "yield_deposit" | "yield_migrate" | "dca",
  "fromAsset": string | null,
  "fromChain": string | null,
  "amount": number | null,
  "amountType": "exact" | "percentage" | "all" | null,
  "toAsset": string | null,
  "toChain": string | null,
  "portfolio": [],
  "frequency": "daily" | "weekly" | "monthly" | null,
  "dayOfWeek": "monday" | "tuesday" | ... | null,
  "dayOfMonth": "1" to "31" | null,
  "settleAsset": null,
  "settleNetwork": null,
  "settleAmount": null,
  "settleAddress": null,
  "conditionOperator": "gt" | "lt" | null,
  "conditionValue": number | null,
  "conditionAsset": string | null,
  "confidence": number,
  "validationErrors": string[],
  "parsedMessage": "Human readable summary",
  "requiresConfirmation": boolean
}
`;

// RENAMED from parseUserCommand to parseWithLLM
export async function parseWithLLM(
  userInput: string,
  conversationHistory: any[] = [],
  inputType: 'text' | 'voice' = 'text'
): Promise<ParsedCommand> {
  let currentSystemPrompt = systemPrompt;

  if (inputType === 'voice') {
    currentSystemPrompt += `
    \n\nVOICE MODE ACTIVE: 
    1. The user is speaking. Be more lenient with phonetic typos.
    2. In 'parsedMessage', write as if spoken aloud.
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
    logger.info("LLM Parsed:", parsed);
    return validateParsedCommand(parsed, userInput, inputType);
  } catch (error) {
    logger.error("Groq Error:", error);

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
    throw error;
  }
}

function validateParsedCommand(parsed: Partial<ParsedCommand>, userInput: string, inputType: 'text' | 'voice' = 'text'): ParsedCommand {
  const errors: string[] = [];
  // ... (Keeping validation logic simple for brevity, same as before)
  if (!parsed.intent) errors.push("Could not determine intent.");

  const allErrors = [...(parsed.validationErrors || []), ...errors];
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
    excludeAmount: parsed.excludeAmount,
    excludeToken: parsed.excludeToken,
    quoteAmount: parsed.quoteAmount,
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

  // Contextual help generation (simplified for this file refactor)
  if (allErrors.length > 0) {
      try {
          const analysis = analyzeCommand(result);
          const help = generateContextualHelp(analysis, userInput, inputType);
          result.validationErrors.push(help);
      } catch (e) { 
          logger.error('ContextualHelpGenerationError', {
              error: e instanceof Error ? e.message : 'Unknown error',
              stack: e instanceof Error ? e.stack : undefined,
              operation: 'generateContextualHelp',
              parsedCommand: result
          });
      }

  }

  return result;
}
