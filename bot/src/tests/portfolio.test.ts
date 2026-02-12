import { confirmPortfolioHandler } from '../handlers/portfolio';
import * as db from '../services/database';
import { createQuote } from '../services/sideshift-client';

jest.mock('../services/database');
jest.mock('../services/sideshift-client');

describe('confirmPortfolioHandler', () => {
    let mockCtx: any;

    beforeEach(() => {
        mockCtx = {
            from: { id: 12345 },
            reply: jest.fn(),
            replyWithMarkdown: jest.fn(),
        };
        jest.clearAllMocks();
    });

    it('should handle no state/portfolio gracefully', async () => {
        (db.getConversationState as jest.Mock).mockResolvedValue(null);

        await confirmPortfolioHandler(mockCtx);

        expect(mockCtx.reply).toHaveBeenCalledWith("No portfolio strategy found. Please try again.");
    });

    it('should execute swaps and return summary', async () => {
        const mockState = {
            parsedCommand: {
                portfolio: [
                    { toAsset: 'BTC', toChain: 'bitcoin', percentage: 50 },
                    { toAsset: 'SOL', toChain: 'solana', percentage: 50 }
                ],
                fromAsset: 'ETH',
                fromChain: 'ethereum',
                amount: 1
            }
        };
        (db.getConversationState as jest.Mock).mockResolvedValue(mockState);

        (createQuote as jest.Mock).mockResolvedValue({
            id: 'quote_123',
            depositCoin: 'ETH',
            depositAmount: '0.5',
            settleCoin: 'BTC',
            rate: '0.05',
            settleAmount: '0.025'
        });

        await confirmPortfolioHandler(mockCtx);

        expect(mockCtx.reply).toHaveBeenCalledWith("🔄 Executing portfolio strategy...");
        expect(createQuote).toHaveBeenCalledTimes(2);
        // Expect summary to contain success messages
        expect(mockCtx.replyWithMarkdown).toHaveBeenCalledWith(expect.stringContaining("Completed: 2 Success, 0 Failed"));
    });

    it('should handle partial failure', async () => {
        const mockState = {
            parsedCommand: {
                portfolio: [
                    { toAsset: 'BTC', toChain: 'bitcoin', percentage: 50 },
                    { toAsset: 'SOL', toChain: 'solana', percentage: 50 }
                ],
                fromAsset: 'ETH',
                fromChain: 'ethereum',
                amount: 1
            }
        };
        (db.getConversationState as jest.Mock).mockResolvedValue(mockState);

        // First call succeeds
        (createQuote as jest.Mock).mockResolvedValueOnce({
            id: 'quote_123',
            depositCoin: 'ETH',
            depositAmount: '0.5',
            settleCoin: 'BTC',
            rate: '0.05',
            settleAmount: '0.025'
        });
        // Second call fails
        (createQuote as jest.Mock).mockResolvedValueOnce({
            error: { message: "API Down" }
        });

        await confirmPortfolioHandler(mockCtx);

        expect(createQuote).toHaveBeenCalledTimes(2);
        expect(mockCtx.replyWithMarkdown).toHaveBeenCalledWith(expect.stringContaining("Completed: 1 Success, 1 Failed"));
        expect(mockCtx.replyWithMarkdown).toHaveBeenCalledWith(expect.stringContaining("API Down"));
    });
});
