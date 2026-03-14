import { ethers } from 'ethers';
import logger from './logger';
import dotenv from 'dotenv';
dotenv.config();

// Minimal ABI representing the functions we need to call in AgentReputation.sol
const RepABI = [
    "function recordSwap(address agent, bool success) external",
    "function getReputation(address agent) external view returns (uint256 totalSwaps, uint256 successSwaps)",
];

class ReputationService {
    private provider: ethers.Provider | null = null;
    private wallet: ethers.Wallet | null = null;
    private contract: ethers.Contract | null = null;
    private isConfigured = false;

    constructor() {
        this.init();
    }

    private init() {
        // Only attempt setup if the contract address is provided
        const address = process.env['REPUTATION_CONTRACT_ADDRESS'];
        // We expect the bot to have a private key in the environment to make the tx
        // If we have a dedicated REPUTATION_OWNER_PRIVATE_KEY we use it. 
        // Otherwise fallback to something else, but here we require REPUTATION_OWNER_PRIVATE_KEY
        const rpcUrl = process.env['SEPOLIA_RPC_URL'];
        const privateKey = process.env['REPUTATION_OWNER_PRIVATE_KEY']; // The wallet possessing ownership

        if (!address || !rpcUrl || !privateKey) {
            logger.warn('[ReputationService] Missing configuration. On-chain reputation logging is disabled.', {
                hasAddress: !!address,
                hasRpc: !!rpcUrl,
                hasKey: !!privateKey
            });
            return;
        }

        try {
            this.provider = new ethers.JsonRpcProvider(rpcUrl);
            this.wallet = new ethers.Wallet(privateKey, this.provider);
            this.contract = new ethers.Contract(address, RepABI, this.wallet);
            this.isConfigured = true;

            logger.info('[ReputationService] Successfully initialized on-chain connection', {
                address,
                wallet: this.wallet.address,
            });

        } catch (e) {
            logger.error('[ReputationService] Failed to initialize ethers objects', e instanceof Error ? e : new Error(String(e)));
        }
    }

    /**
     * Submits an on-chain transaction to record the outcome of a swap executed by an agent.
     * @param agent Address of the bot or agent completing the swap
     * @param success Boolean indicating swap success (true) or failure/refund (false)
     */
    public async recordSwapOutcome(agent: string, success: boolean): Promise<void> {
        if (!this.isConfigured || !this.contract) {
            logger.debug('[ReputationService] Ignoring recordSwapOutcome (not configured)');
            return;
        }

        try {
            // Broadcast tx
            logger.info(`[ReputationService] Recording swap outcome for agent ${agent} (success=${success})...`);
            const tx = await this.contract['recordSwap']!(agent, success);
            logger.debug(`[ReputationService] Tx broadcasted: ${tx.hash}. Waiting for confirmation...`);

            // Wait for it to land
            const receipt = await tx.wait();
            if (receipt.status === 1) {
                logger.info(`[ReputationService] On-chain reputation updated successfully for agent ${agent}.`);
            } else {
                logger.error(`[ReputationService] Transaction reverted. Hash: ${tx.hash}`);
            }

        } catch (error) {
            logger.error(`[ReputationService] Error interacting with smart contract:`, error instanceof Error ? error : new Error(String(error)));
        }
    }

    /**
     * Retrieves the reputation stats for a given agent address.
     * @param agent Address of the bot/agent to look up
     * @returns Object containing total swaps, successful swaps, and a trust score (percentage)
     */
    public async getReputation(agent: string): Promise<{ total: number; success: number; score: string } | null> {
        if (!this.isConfigured || !this.contract) {
            return null;
        }

        try {
            // contract.getReputation returns [totalSwaps, successSwaps] as BigInts
            const result = await this.contract['getReputation']!(agent);
            
            // Result is usually an array/object with BigInt properties
            const total = BigInt(result[0]); // Ensure BigInt
            const success = BigInt(result[1]); // Ensure BigInt

            let score = "0.0";
            if (total > 0n) {
                // Calculation: (success * 1000n) / total (yields e.g. 985 for 98.5%)
                const basisPoints = (success * 1000n) / total;
                const numericScore = Number(basisPoints) / 10;
                score = numericScore.toFixed(1);
            }

            return { 
                total: Number(total), 
                success: Number(success), 
                score 
            };
        } catch (error) {
            logger.error(`[ReputationService] Failed to fetch reputation for ${agent}:`, error instanceof Error ? error : new Error(String(error)));
            return null;
        }
    }

    /**
     * Helper to get the bot's own wallet address if configured.
     */
    public getBotAddress(): string | null {
        return this.wallet ? this.wallet.address : null;
    }
}

export const reputationService = new ReputationService();
