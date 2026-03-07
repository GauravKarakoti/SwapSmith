export interface ParsedCommand {
    success: boolean;
    intent: 'swap' | 'checkout' | 'portfolio' | 'yield_scout' | 'dca' | 'swap_and_stake' | 'unknown';
    fromAsset: string | null;
    fromChain: string | null;
    toAsset: string | null;
    toChain: string | null;
    amount: number | null;
    amountType: 'exact' | 'percentage' | null;
    portfolio: Array<{
        toAsset: string;
        toChain: string;
        percentage: number;
    }> | null;
    settleAsset: string | null;
    settleNetwork: string | null;
    settleAmount: number | null;
    settleAddress: string | null;
    fromProject?: string | null;
    toProject?: string | null;
    confidence: number;
    validationErrors: string[];
    parsedMessage: string;
    requiresConfirmation?: boolean;
    originalInput?: string;
}

export interface QuoteData {
    depositCoin: string;
    depositNetwork: string;
    settleCoin: string;
    settleNetwork: string;
    depositAmount: string;
    settleAmount: string;
    rate: string;
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    type?: 'message' | 'intent_confirmation' | 'swap_confirmation' | 'yield_info' | 'checkout_link';
    data?: {
        parsedCommand?: ParsedCommand;
        quoteData?: QuoteData;
        confidence?: number;
        url?: string;
    } | Record<string, unknown>;
}
