/**
 * Type guards for runtime type checking and validation
 * Used for validating external API responses and ensuring type safety
 */

import type { Quote, Order, DepositAddress, OrderStatus } from './Quote';
import type { 
  ParsedCommand, 
  PortfolioAllocation, 
  Condition, 
  NextAction,
  SecondaryCondition 
} from './ParsedCommand';
import type { ConversationMessage, GroqMessage, GroqChatCompletionResponse } from './Message';
import type { ErrorDetails, LogContext } from './Logger';

/**
 * Type guard for checking if a value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Type guard for checking if a value is a number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Type guard for checking if a value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Type guard for checking if a value is an array
 */
export function isArray<T>(value: unknown, itemGuard?: (item: unknown) => item is T): value is T[] {
  if (!Array.isArray(value)) return false;
  if (itemGuard) {
    return value.every(itemGuard);
  }
  return true;
}

/**
 * Type guard for checking if an object is a Record
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard for Quote type
 */
export function isQuote(value: unknown): value is Quote {
  if (!isRecord(value)) return false;
  const q = value as Record<string, unknown>;
  
  return (
    (isString(q.id) || isString(q.quoteId)) &&
    isString(q.fromAsset) &&
    isString(q.toAsset) &&
    (isString(q.fromAmount) || isNumber(q.fromAmount)) &&
    (isString(q.toAmount) || isNumber(q.toAmount)) &&
    (isString(q.settleAmount) || isNumber(q.settleAmount))
  );
}

/**
 * Type guard for DepositAddress type
 */
export function isDepositAddress(value: unknown): value is DepositAddress {
  if (!isRecord(value)) return false;
  const d = value as Record<string, unknown>;
  
  return isString(d.address) && (isString(d.memo) || d.memo === undefined);
}

/**
 * Type guard for Order type
 */
export function isOrder(value: unknown): value is Order {
  if (!isRecord(value)) return false;
  const o = value as Record<string, unknown>;
  
  return (
    (isString(o.id) || isString(o.orderId)) &&
    isString(o.status) &&
    isNumber(o.createdAt) &&
    isString(o.fromAsset) &&
    isString(o.toAsset) &&
    (isString(o.depositAddress) || isDepositAddress(o.depositAddress))
  );
}

/**
 * Type guard for OrderStatus type
 */
export function isOrderStatus(value: unknown): value is OrderStatus {
  if (!isRecord(value)) return false;
  const os = value as Record<string, unknown>;
  
  const validStatuses = ['pending', 'confirming', 'preparing', 'sending', 'complete', 'failed', 'expired'];
  
  return (
    isString(os.id) &&
    validStatuses.includes(os.status as string) &&
    isString(os.fromAsset) &&
    isString(os.toAsset) &&
    isNumber(os.createdAt)
  );
}

/**
 * Type guard for PortfolioAllocation type
 */
export function isPortfolioAllocation(value: unknown): value is PortfolioAllocation {
  if (!isRecord(value)) return false;
  const pa = value as Record<string, unknown>;
  
  return (
    isString(pa.toAsset) &&
    isString(pa.toChain) &&
    isNumber(pa.percentage) &&
    pa.percentage >= 0 &&
    pa.percentage <= 100
  );
}

/**
 * Type guard for SecondaryCondition type
 */
export function isSecondaryCondition(value: unknown): value is SecondaryCondition {
  if (!isRecord(value)) return false;
  const sc = value as Record<string, unknown>;
  
  const validOperators = ['gt', 'lt', 'gte', 'lte', 'eq'];
  const validLogic = ['AND', 'OR'];
  
  return (
    isString(sc.type) &&
    isString(sc.asset) &&
    isNumber(sc.value) &&
    validOperators.includes(sc.operator as string) &&
    validLogic.includes(sc.logic as string)
  );
}

/**
 * Type guard for Condition type
 */
export function isCondition(value: unknown): value is Condition {
  if (!isRecord(value)) return false;
  const c = value as Record<string, unknown>;
  
  const validConditionTypes = [
    'price_above',
    'price_below',
    'balance_threshold',
    'time_based',
    'market_condition'
  ];
  const validOperators = ['gt', 'lt', 'gte', 'lte', 'eq'];
  
  return (
    validConditionTypes.includes(c.type as string) &&
    isString(c.asset) &&
    isNumber(c.value) &&
    (!c.operator || validOperators.includes(c.operator as string))
  );
}

/**
 * Type guard for NextAction type
 */
export function isNextAction(value: unknown): value is NextAction {
  if (!isRecord(value)) return false;
  const na = value as Record<string, unknown>;
  
  return (
    isString(na.rawText) &&
    isBoolean(na.needsParsing)
  );
}

/**
 * Type guard for ParsedCommand type
 */
export function isParsedCommand(value: unknown): value is ParsedCommand {
  if (!isRecord(value)) return false;
  const pc = value as Record<string, unknown>;
  
  const validIntents = [
    'swap',
    'checkout',
    'portfolio',
    'yield_scout',
    'yield_deposit',
    'yield_migrate',
    'dca',
    'limit_order',
    'swap_and_stake',
    'unknown'
  ];
  
  return (
    isBoolean(pc.success) &&
    validIntents.includes(pc.intent as string) &&
    isNumber(pc.confidence) &&
    isArray(pc.validationErrors, isString) &&
    isString(pc.parsedMessage)
  );
}

/**
 * Type guard for ConversationMessage type
 */
export function isConversationMessage(value: unknown): value is ConversationMessage {
  if (!isRecord(value)) return false;
  const cm = value as Record<string, unknown>;
  
  const validRoles = ['system', 'user', 'assistant'];
  
  return (
    validRoles.includes(cm.role as string) &&
    isString(cm.content)
  );
}

/**
 * Type guard for GroqMessage type
 */
export function isGroqMessage(value: unknown): value is GroqMessage {
  if (!isRecord(value)) return false;
  const gm = value as Record<string, unknown>;
  
  const validRoles = ['system', 'user', 'assistant'];
  
  return (
    validRoles.includes(gm.role as string) &&
    isString(gm.content)
  );
}

/**
 * Type guard for GroqChatCompletionResponse type
 */
export function isGroqChatCompletionResponse(value: unknown): value is GroqChatCompletionResponse {
  if (!isRecord(value)) return false;
  const gcr = value as Record<string, unknown>;
  
  return (
    isArray(gcr.choices) &&
    isString(gcr.id) &&
    isString(gcr.model)
  );
}

/**
 * Type guard for ErrorDetails type
 */
export function isErrorDetails(value: unknown): value is ErrorDetails {
  return isRecord(value);
}

/**
 * Type guard for LogContext type
 */
export function isLogContext(value: unknown): value is LogContext {
  if (!isRecord(value)) return false;
  const lc = value as Record<string, unknown>;
  
  return (
    (isNumber(lc.chatId) || lc.chatId === undefined) &&
    (isNumber(lc.messageId) || lc.messageId === undefined) &&
    (isString(lc.username) || lc.username === undefined)
  );
}

/**
 * Safe JSON parse with type guard
 */
export function safeJsonParse<T>(
  json: string,
  typeGuard: (value: unknown) => value is T
): T | null {
  try {
    const parsed = JSON.parse(json);
    if (typeGuard(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Validate and narrow type for Quote array
 */
export function validateQuoteArray(value: unknown): Quote[] {
  if (!isArray(value)) return [];
  return value.filter(isQuote);
}

/**
 * Validate and narrow type for Order array
 */
export function validateOrderArray(value: unknown): Order[] {
  if (!isArray(value)) return [];
  return value.filter(isOrder);
}

/**
 * Validate and narrow type for PortfolioAllocation array
 */
export function validatePortfolioArray(value: unknown): PortfolioAllocation[] {
  if (!isArray(value)) return [];
  return value.filter(isPortfolioAllocation);
}
