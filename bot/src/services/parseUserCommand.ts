import { parseWithLLM } from './groq-client';
import { parseDCA } from './nl-dca';
import { detectLimitOrder } from './nl-limit-orders';
import type { ParsedCommand, ParseResult } from '../types/ParsedCommand';
import logger from './logger';
import { validateAndSanitizeLLMInput, VALIDATION_LIMITS } from '../../../shared/utils/validation';

export type { ParsedCommand };

const REGEX_SWAP = /\b(?:swap|convert|sell|exchange)\s+(\d+(?:\.\d+)?%?|all|everything)\s+([A-Z]{2,10})\s+(?:to|for|into)\s+([A-Z]{2,10})\b/i;
const REGEX_STAKE = /\b(?:stake|zap)\s+(?:all\s+)?(\d+(?:\.\d+)?%?)?\s*([A-Z]{2,10})\b/i;

/* ---------------- MAIN PARSER ---------------- */

export async function parseUserCommand(
  userInput: string,
  conversationHistory: Array<Record<string, string>> = [],
  inputType: 'text' | 'voice' = 'text'
): Promise<ParseResult> {

  const { valid, sanitized, errors } = validateAndSanitizeLLMInput(userInput);

  if (!valid || sanitized.length > VALIDATION_LIMITS.COMMAND_MAX) {
    return {
      success: false,
      intent: 'unknown',
      confidence: 0,
      validationErrors: !valid ? errors : ['Input exceeds max length'],
      parsedMessage: 'Input validation failed',
      requiresConfirmation: false,
      originalInput: userInput
    } as ParsedCommand;
  }

  const input = sanitized.toLowerCase().trim();

  // 1. Check for specific natural language modules
  const dcaMatch = parseDCA(input);
  if (dcaMatch) {
    return buildResult(userInput, { ...dcaMatch, intent: 'dca', confidence: 90 });
  }

  const limitOrderMatch = detectLimitOrder(input);
  if (limitOrderMatch) {
    return buildResult(userInput, { ...limitOrderMatch, intent: 'limit_order', confidence: 90 });
  }

  // 2. Deterministic Standard Regex
  const stakeMatch = input.match(REGEX_STAKE);
  if (stakeMatch) {
    const isAll = input.includes('all') || input.includes('everything');
    return buildResult(userInput, {
      intent: 'stake',
      amount: isAll ? null : parseFloat(stakeMatch[1]!),
      amountType: isAll ? 'all' : (stakeMatch[1]?.includes('%') ? 'percentage' : 'exact'),
      fromAsset: stakeMatch[2]!.toUpperCase(),
      confidence: 95
    });
  }

  const swapMatch = input.match(REGEX_SWAP);
  if (swapMatch && !input.includes(' if ') && !input.includes(' when ')) {
    const isAll = swapMatch[1] === 'all' || swapMatch[1] === 'everything';
    return buildResult(userInput, {
      intent: 'swap',
      amount: isAll ? null : parseFloat(swapMatch[1]!),
      amountType: isAll ? 'all' : (swapMatch[1]!.includes('%') ? 'percentage' : 'exact'),
      fromAsset: swapMatch[2]!.toUpperCase(),
      toAsset: swapMatch[3]!.toUpperCase(),
      confidence: 95
    });
  }

  // 3. Fallback to Groq LLM parsing
  logger.info('Fallback to LLM for:', userInput);
  try {
    const result = await parseWithLLM(userInput, conversationHistory as any, inputType);
    return { ...result, originalInput: userInput };
  } catch (error) {
    logger.error('LLM Fallback Error', error);
    return buildResult(userInput, { intent: 'unknown', confidence: 0, validationErrors: ['Parsing failed'] });
  }
}

function buildResult(userInput: string, config: Partial<ParsedCommand>): ParsedCommand {
  return {
    success: true,
    fromAsset: null, toAsset: null, amount: null, amountType: null,
    validationErrors: [],
    requiresConfirmation: false,
    parsedMessage: `Determined Intent: ${config.intent}`,
    ...config,
    originalInput: userInput
  } as ParsedCommand;
}