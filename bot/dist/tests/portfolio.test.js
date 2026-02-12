"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const portfolio_1 = require("../handlers/portfolio");
const db = __importStar(require("../services/database"));
const sideshift_client_1 = require("../services/sideshift-client");
jest.mock('../services/database');
jest.mock('../services/sideshift-client');
describe('confirmPortfolioHandler', () => {
    let mockCtx;
    beforeEach(() => {
        mockCtx = {
            from: { id: 12345 },
            reply: jest.fn(),
            replyWithMarkdown: jest.fn(),
        };
        jest.clearAllMocks();
    });
    it('should handle no state/portfolio gracefully', async () => {
        db.getConversationState.mockResolvedValue(null);
        await (0, portfolio_1.confirmPortfolioHandler)(mockCtx);
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
        db.getConversationState.mockResolvedValue(mockState);
        sideshift_client_1.createQuote.mockResolvedValue({
            id: 'quote_123',
            depositCoin: 'ETH',
            depositAmount: '0.5',
            settleCoin: 'BTC',
            rate: '0.05',
            settleAmount: '0.025'
        });
        await (0, portfolio_1.confirmPortfolioHandler)(mockCtx);
        expect(mockCtx.reply).toHaveBeenCalledWith("🔄 Executing portfolio strategy...");
        expect(sideshift_client_1.createQuote).toHaveBeenCalledTimes(2);
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
        db.getConversationState.mockResolvedValue(mockState);
        // First call succeeds
        sideshift_client_1.createQuote.mockResolvedValueOnce({
            id: 'quote_123',
            depositCoin: 'ETH',
            depositAmount: '0.5',
            settleCoin: 'BTC',
            rate: '0.05',
            settleAmount: '0.025'
        });
        // Second call fails
        sideshift_client_1.createQuote.mockResolvedValueOnce({
            error: { message: "API Down" }
        });
        await (0, portfolio_1.confirmPortfolioHandler)(mockCtx);
        expect(sideshift_client_1.createQuote).toHaveBeenCalledTimes(2);
        expect(mockCtx.replyWithMarkdown).toHaveBeenCalledWith(expect.stringContaining("Completed: 1 Success, 1 Failed"));
        expect(mockCtx.replyWithMarkdown).toHaveBeenCalledWith(expect.stringContaining("API Down"));
    });
});
