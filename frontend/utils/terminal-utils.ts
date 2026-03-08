/**
 * Terminal Command Processing Business Logic
 * Separates command processing from UI rendering
 */

import { ParsedCommand } from '@/utils/groq-client';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?:
  | 'message'
  | 'intent_confirmation'
  | 'swap_confirmation'
  | 'yield_info'
  | 'checkout_link';
  data?:
  | ParsedCommand
  | { quoteData: Record<string, unknown>; confidence: number }
  | { url: string }
  | { parsedCommand: ParsedCommand }
  | Record<string, unknown>;
}

/**
 * Execute a swap command
 * @param command - The parsed command to execute
 * @returns Promise<Response> from the API
 */
export async function executeSwapCommand(command: ParsedCommand) {
  const response = await fetch('/api/create-swap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fromAsset: command.fromAsset,
      toAsset: command.toAsset,
      amount: command.amount,
      fromChain: command.fromChain,
      toChain: command.toChain,
    }),
  });

  const quote = await response.json();
  if (quote.error) throw new Error(quote.error);
  return quote;
}

/**
 * Execute a yield scouting command
 * @returns Promise with yield data
 */
export async function executeYieldScoutCommand() {
  const response = await fetch('/api/yields');
  return await response.json();
}

/**
 * Execute a checkout/payment link command
 * @param command - The parsed command with checkout details
 * @param address - The wallet address (if command.settleAddress not provided)
 * @returns Promise with checkout data
 */
export async function executeCheckoutCommand(
  command: ParsedCommand,
  address?: string
) {
  const finalAddress = command.settleAddress || address;

  if (!finalAddress) {
    throw new Error(
      'No address provided. Please connect your wallet or specify a settlement address.'
    );
  }

  const response = await fetch('/api/create-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      settleAsset: command.settleAsset,
      settleNetwork: command.settleNetwork,
      settleAmount: command.settleAmount,
      settleAddress: finalAddress,
    }),
  });

  const checkoutData = await response.json();
  if (checkoutData.error) throw new Error(checkoutData.error);
  return checkoutData;
}

/**
 * Process user text input through the Groq API
 * @param text - The user's input text
 * @returns Promise<ParsedCommand>
 */
export async function parseUserCommand(text: string): Promise<ParsedCommand> {
  const response = await fetch('/api/parse-command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: text }),
  });

  return await response.json();
}

/**
 * Build portfolio execution messages from a portfolio command
 * Used to handle portfolio strategy splitting
 * @param command - The original parsed command
 * @returns Array of split commands for each portfolio asset
 */
export function buildPortfolioCommands(command: ParsedCommand): ParsedCommand[] {
  if (!command.portfolio || command.amount === undefined) {
    return [];
  }

  return command.portfolio.map((item) => ({
    ...command,
    intent: 'swap' as const,
    amount: (command.amount! * item.percentage) / 100,
    toAsset: item.toAsset,
    toChain: item.toChain,
    portfolio: undefined,
    confidence: command.confidence,
  }));
}

/**
 * Validate if a command requires confirmation from the user
 * @param command - The parsed command
 * @param confidenceThreshold - Confidence threshold (0-100, default 80)
 * @returns Boolean indicating if confirmation is needed
 */
export function requiresConfirmation(
  command: ParsedCommand,
  confidenceThreshold: number = 80
): boolean {
  return command.requiresConfirmation || command.confidence < confidenceThreshold;
}

/**
 * Format swap message for display
 * @param quote - The quote data from the API
 * @returns Formatted string
 */
export function formatSwapMessage(quote: Record<string, unknown>): string {
  const { depositAmount, depositCoin, settleAmount, settleCoin } = quote;
  return `Swap Prepared: ${depositAmount} ${depositCoin} → ${settleAmount} ${settleCoin}`;
}

/**
 * Format checkout message for display
 * @param checkoutData - The checkout data from the API
 * @param network - The settlement network
 * @returns Formatted string
 */
export function formatCheckoutMessage(
  checkoutData: Record<string, unknown>,
  network: string
): string {
  return `Payment Link Created for ${checkoutData.settleAmount} ${checkoutData.settleCoin} on ${network}`;
}

/**
 * Format error message based on command intent
 * @param intent - The command intent
 * @param validationErrors - Optional validation error messages
 * @returns Formatted error message
 */
export function formatErrorMessage(
  intent: string,
  validationErrors?: string[]
): string {
  if (validationErrors?.length) {
    return `I couldn't understand. ${validationErrors.join(', ')}`;
  }
  return `Failed to process ${intent} command. Please try again.`;
}
