import Groq from "groq-sdk";
import fs from 'fs';
import logger, { handleError } from './logger';
import { loadSecret } from '@shared/utils/secrets-loader';
import { sanitizeLLMPrompt, validateAndSanitizeLLMInput } from '@shared/utils/validation';
import type { ParsedCommand } from '../types/ParsedCommand';
import type { ConversationMessage, GroqMessage } from '../types/Message';
import { analyzeCommand, generateContextualHelp } from './contextual-help';

function getGroqClient(): Groq {
  const apiKey = loadSecret('groq_api_key', 'GROQ_API_KEY');
  return new Groq({ apiKey });
}

const SYSTEM_PROMPT = `
You are SwapSmith, a highly deterministic DeFi AI agent. Parse natural language into strictly valid JSON.
Do not include conversational filler, markdown formatting, or explanations. 

SUPPORTED INTENTS: "swap", "portfolio", "checkout", "yield_scout", "yield_deposit", "yield_migrate", "dca", "limit_order", "swap_and_stake", "stake", "bridge", "unknown".

RULES:
1. PRECISION: If ambiguous, set low confidence and requiresConfirmation: true.
2. CONDITIONS: If "when", "if", "above", "below" are used, map to "conditions" object.
3. STAKING AUTO-MAPPING: ETH->stETH (lido), SOL->mSOL (marinade), MATIC->stMATIC (lido). Default protocol is "lido".
4. CROSS-CHAIN: If the user mentions distinct source and destination networks (e.g., "Arbitrum to Optimism"), map them to fromNetwork and toNetwork.
5. ADDRESS RESOLUTION: Addresses ending in .eth, .lens, or starting with 0x mapped to "settleAddress".

RESPONSE SCHEMA:
{
  "success": boolean,
  "intent": "string",
  "fromAsset": "string | null",
  "fromNetwork": "string | null",
  "toAsset": "string | null",
  "toNetwork": "string | null",
  "amount": "number | null",
  "amountType": "exact | percentage | all | null",
  "conditions": {
    "type": "price_above | price_below | balance_threshold | time_based",
    "asset": "string",
    "value": "number",
    "operator": "gt | lt | gte | lte | eq"
  } | null,
  "portfolio": [{"toAsset": "string", "percentage": "number", "network": "string"}] | null,
  "frequency": "daily | weekly | monthly | null",
  "settleAddress": "string | null",
  "stakeProtocol": "string | null",
  "confidence": "number (0-100)",
  "validationErrors": ["string array of missing required info"],
  "parsedMessage": "string (human readable interpretation)",
  "requiresConfirmation": boolean
}
`;

export async function parseWithLLM(
  userInput: string,
  conversationHistory: ConversationMessage[] = [],
  inputType: 'text' | 'voice' = 'text'
): Promise<ParsedCommand> {
  const { valid, sanitized, errors } = validateAndSanitizeLLMInput(userInput);
  
  if (!valid) {
    return buildFallbackCommand(userInput, errors);
  }

  let prompt = SYSTEM_PROMPT;
  if (inputType === 'voice') {
    prompt += `\nVOICE MODE ACTIVE: Be lenient with phonetic typos. Write 'parsedMessage' as if spoken aloud.`;
  }

  try {
    const messages: GroqMessage[] = [
      { role: "system", content: prompt },
      ...conversationHistory,
      { role: "user", content: sanitizeLLMPrompt(sanitized) }
    ];

    const completion = await getGroqClient().chat.completions.create({
      messages,
      model: "mixtral-8x7b-32768", // Fast deterministic parsing
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const parsed = JSON.parse(completion.choices[0]?.message.content || '{}');
    return validateParsedCommand(parsed, userInput, inputType);
  } catch (error) {
    logger.error("Groq Parsing Error:", error);
    return buildFallbackCommand(userInput, ["AI parsing failed"]);
  }
}

export async function transcribeAudio(mp3FilePath: string): Promise<string> {
  try {
    const transcription = await getGroqClient().audio.transcriptions.create({
      file: fs.createReadStream(mp3FilePath),
      model: "whisper-large-v3",
      response_format: "json",
    });
    return transcription.text;
  } catch (error) {
    await handleError('TranscriptionError', { filePath: mp3FilePath }, undefined, false, 'low');
    throw error;
  }
}

function validateParsedCommand(parsed: Partial<ParsedCommand>, userInput: string, inputType: 'text' | 'voice'): ParsedCommand {
  const errors: string[] = parsed.validationErrors || [];
  if (!parsed.intent) errors.push("Could not determine intent.");

  const success = parsed.success !== false && errors.length === 0;
  const confidence = errors.length > 0 ? Math.max(0, (parsed.confidence || 0) - 30) : (parsed.confidence || 100);

  const result: ParsedCommand = {
    ...parsed,
    success,
    intent: parsed.intent || 'unknown',
    confidence,
    validationErrors: errors,
    parsedMessage: parsed.parsedMessage || '',
    requiresConfirmation: parsed.requiresConfirmation || false,
    originalInput: userInput
  } as ParsedCommand;

  if (errors.length > 0) {
    try {
      const analysis = analyzeCommand(result);
      result.validationErrors.push(generateContextualHelp(analysis, userInput, inputType));
    } catch (e) {
      logger.error('ContextualHelpGenerationError', e);
    }
  }

  return result;
}

function buildFallbackCommand(userInput: string, errors: string[]): ParsedCommand {
  return {
    success: false, intent: 'unknown', confidence: 0, validationErrors: errors,
    parsedMessage: 'Invalid or unparsable input', requiresConfirmation: false, originalInput: userInput
  } as ParsedCommand;
}