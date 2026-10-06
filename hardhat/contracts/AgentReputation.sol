// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title AgentReputation
 * @notice Trust score system for trading bots executing swaps on behalf of users.
 *         The backend wallet tracks the success and failure rates and stores the aggregated values on-chain.
 *
 * Security & Gas Optimization features:
 * - Two-step ownership transfer for safer governance transitions.
 * - Custom errors for maximum gas efficiency.
 * - Struct packing (uint64) to fit agent stats into a single storage slot.
 * - Batch recording capabilities to drastically reduce backend gas overhead.
 */
contract AgentReputation is Ownable2Step {
    // -----------------------------------------------------------------------
    // Structs & State
    // -----------------------------------------------------------------------

    /**
     * @dev Using uint64 allows us to pack all three variables into a single 
     *      256-bit storage slot (64 + 64 + 64 = 192 bits).
     *      Max uint64 is ~1.8e19, which is practically infinite for swap counts.
     */
    struct Reputation {
        uint64 totalSwaps;
        uint64 successSwaps;
        uint64 slashCount;
    }

    /// @notice Maps a bot/agent address to their reputation statistics.
    mapping(address => Reputation) public reputations;

    // -----------------------------------------------------------------------
    // Events & Errors
    // -----------------------------------------------------------------------

    event SwapRecorded(address indexed agent, bool success, uint64 newTotal, uint64 newSuccess);
    event AgentSlashed(address indexed agent, uint64 newSlashCount);
    event BatchSwapsRecorded(uint256 count);

    error AgentReputation__InvalidAddress();
    error AgentReputation__ArrayLengthMismatch();

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------

    /**
     * @param initialOwner Address that will own the contract (usually the SwapSmith backend).
     */
    constructor(address initialOwner) Ownable(initialOwner) {}

    // -----------------------------------------------------------------------
    // Agent Activity Logging
    // -----------------------------------------------------------------------

    /**
     * @notice Records the outcome of a swap executed by an agent.
     * @param agent   Address of the agent/bot that executed the swap.
     * @param success Boolean indicating if the swap was ultimately successful.
     */
    function recordSwap(address agent, bool success) public onlyOwner {
        if (agent == address(0)) revert AgentReputation__InvalidAddress();

        Reputation storage rep = reputations[agent];
        
        rep.totalSwaps += 1;
        if (success) {
            rep.successSwaps += 1;
        }

        emit SwapRecorded(agent, success, rep.totalSwaps, rep.successSwaps);
    }

    /**
     * @notice Records multiple swap outcomes in a single transaction to save on gas overhead.
     * @param agents    Array of agent addresses.
     * @param successes Array of booleans indicating swap outcomes.
     */
    function batchRecordSwaps(address[] calldata agents, bool[] calldata successes) external onlyOwner {
        if (agents.length != successes.length) revert AgentReputation__ArrayLengthMismatch();

        for (uint256 i = 0; i < agents.length; i++) {
            recordSwap(agents[i], successes[i]);
        }

        emit BatchSwapsRecorded(agents.length);
    }

    /**
     * @notice Slashes an agent for malicious behavior (e.g., severe slippage, MEV exploitation).
     * @param agent Address of the offending agent/bot.
     */
    function slashAgent(address agent) external onlyOwner {
        if (agent == address(0)) revert AgentReputation__InvalidAddress();

        Reputation storage rep = reputations[agent];
        rep.slashCount += 1;

        emit AgentSlashed(agent, rep.slashCount);
    }

    // -----------------------------------------------------------------------
    // Reading Reputation
    // -----------------------------------------------------------------------

    /**
     * @notice Fetch the reputation of a specific agent.
     * @param agent Address of the agent/bot.
     * @return totalSwaps   Total number of swaps attempted.
     * @return successSwaps Number of successful swaps.
     * @return slashCount   Number of severe infractions.
     */
    function getReputation(address agent) external view returns (uint64 totalSwaps, uint64 successSwaps, uint64 slashCount) {
        Reputation storage rep = reputations[agent];
        return (rep.totalSwaps, rep.successSwaps, rep.slashCount);
    }
}