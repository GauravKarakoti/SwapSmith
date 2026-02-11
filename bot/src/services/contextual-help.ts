import { ParsedCommand } from './groq-client';

/**
 * Analysis result identifying present, missing, and invalid fields in a parsed command
 */
export interface CommandAnalysis {
  intent: string;
  presentFields: {
    field: string;
    value: any;
  }[];
  missingFields: string[];
  invalidFields: {
    field: string;
    reason: string;
  }[];
}

/**
 * Context information needed to generate contextual help messages
 */
export interface HelpContext {
  analysis: CommandAnalysis;
  originalInput: string;
  inputType: 'text' | 'voice';
  existingErrors: string[];
}

/**
 * Analyzes a parsed command to identify present, missing, and invalid fields
 */
export function analyzeCommand(parsed: ParsedCommand): CommandAnalysis {
  if (!parsed) {
    return {
      intent: 'unknown',
      presentFields: [],
      missingFields: ['all'],
      invalidFields: []
    };
  }

  const intent = parsed.intent || 'unknown';
  const presentFields: { field: string; value: any }[] = [];
  const missingFields: string[] = [];
  const invalidFields: { field: string; reason: string }[] = [];

  // Define required fields based on intent
  const requiredFieldsByIntent: Record<string, string[]> = {
    swap: ['fromAsset', 'toAsset', 'amount'],
    portfolio: ['fromAsset', 'amount', 'portfolio'],
    checkout: ['settleAsset', 'settleNetwork', 'settleAmount'],
    yield_deposit: ['fromAsset', 'amount']
  };

  const requiredFields = requiredFieldsByIntent[intent] || [];

  // Analyze each required field
  for (const field of requiredFields) {
    const value = (parsed as any)[field];
    
    if (value === null || value === undefined) {
      missingFields.push(field);
    } else if (field === 'amount' && typeof value === 'number' && value <= 0) {
      invalidFields.push({ field, reason: 'Amount must be greater than 0' });
    } else if (field === 'portfolio' && Array.isArray(value) && value.length === 0) {
      invalidFields.push({ field, reason: 'Portfolio allocation is empty' });
    } else {
      presentFields.push({ field, value });
    }
  }

  return {
    intent,
    presentFields,
    missingFields,
    invalidFields
  };
}

/**
 * Generates contextual help message based on command analysis
 */
export function generateContextualHelp(
  analysis: CommandAnalysis,
  originalInput: string,
  inputType: 'text' | 'voice' = 'text'
): string {
  // Validate inputs
  if (!analysis || !originalInput) {
    return formatMessage(
      "I couldn't understand your command. Please try rephrasing.",
      "Try saying something like 'swap 1 ETH to BTC'",
      inputType
    );
  }

  // If no missing fields, provide generic guidance
  if (analysis.missingFields.length === 0 && analysis.invalidFields.length === 0) {
    return formatMessage(
      "Please rephrase your command more clearly.",
      "For example: 'swap 1 ETH to BTC'",
      inputType
    );
  }

  // Get the highest priority missing field
  const priorityOrder = ['amount', 'fromAsset', 'toAsset', 'settleAmount', 'settleAsset', 'portfolio'];
  const criticalMissing = priorityOrder.find(field => analysis.missingFields.includes(field));

  // Extract present field values for context
  const presentAsset = analysis.presentFields.find(f => f.field === 'fromAsset' || f.field === 'settleAsset')?.value;
  const presentAmount = analysis.presentFields.find(f => f.field === 'amount' || f.field === 'settleAmount')?.value;
  const presentToAsset = analysis.presentFields.find(f => f.field === 'toAsset')?.value;

  // Generate intent-specific messages
  let question: string;
  let example: string;

  if (criticalMissing === 'amount' || criticalMissing === 'settleAmount') {
    const asset = presentAsset || presentToAsset || 'ETH';
    const action = getActionForIntent(analysis.intent);
    question = `How much ${asset} would you like to ${action}?`;
    example = presentToAsset 
      ? `${analysis.intent} 1 ${asset} to ${presentToAsset}`
      : `${analysis.intent} 1 ${asset} to BTC`;
  } else if (criticalMissing === 'fromAsset' || criticalMissing === 'settleAsset') {
    const action = getActionForIntent(analysis.intent);
    question = `Which asset would you like to ${action}?`;
    example = presentAmount 
      ? `${analysis.intent} ${presentAmount} ETH to BTC`
      : `${analysis.intent} 1 ETH to BTC`;
  } else if (criticalMissing === 'toAsset') {
    question = `Which asset would you like to receive?`;
    const amountPart = presentAmount ? `${presentAmount}` : '1';
    const assetPart = presentAsset || 'ETH';
    example = `swap ${amountPart} ${assetPart} to BTC`;
  } else if (criticalMissing === 'portfolio') {
    question = `How would you like to split your ${presentAsset || 'assets'}?`;
    example = `split ${presentAmount || '1'} ${presentAsset || 'ETH'} into 50% BTC and 50% USDC`;
  } else {
    // Multiple missing fields or unknown scenario
    const intentName = getIntentDisplayName(analysis.intent);
    question = `I need more information to complete your ${intentName}.`;
    example = getDefaultExampleForIntent(analysis.intent);
  }

  return formatMessage(question, example, inputType);
}

/**
 * Formats the help message based on input type (text or voice)
 */
function formatMessage(question: string, example: string, inputType: 'text' | 'voice'): string {
  if (inputType === 'voice') {
    // Voice mode: plain text, no special characters
    return `${question} For example, you could say ${example}`;
  } else {
    // Text mode: full markdown with emoji
    return `💡 ${question}\n\nExample: \`${example}\``;
  }
}

/**
 * Gets the action verb for a given intent
 */
function getActionForIntent(intent: string): string {
  const actions: Record<string, string> = {
    swap: 'swap',
    portfolio: 'split',
    checkout: 'receive',
    yield_deposit: 'deposit'
  };
  return actions[intent] || 'trade';
}

/**
 * Gets the display name for an intent
 */
function getIntentDisplayName(intent: string): string {
  const names: Record<string, string> = {
    swap: 'swap',
    portfolio: 'portfolio allocation',
    checkout: 'payment link',
    yield_deposit: 'yield deposit'
  };
  return names[intent] || 'transaction';
}

/**
 * Gets a default example for a given intent
 */
function getDefaultExampleForIntent(intent: string): string {
  const examples: Record<string, string> = {
    swap: 'swap 1 ETH to BTC',
    portfolio: 'split 1 ETH into 50% BTC and 50% USDC',
    checkout: 'create payment link for 100 USDC',
    yield_deposit: 'deposit 1 ETH to yield'
  };
  return examples[intent] || 'swap 1 ETH to BTC';
}
