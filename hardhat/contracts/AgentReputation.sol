// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AgentReputation
 * @notice Trust score system for trading bots executing swaps on behalf of users.
 *         The backend wallet tracks the success and failure rates and stores the aggregated values on-chain.
 */
contract AgentReputation is Ownable {
    // -----------------------------------------------------------------------
    // Struts & State
    // -----------------------------------------------------------------------

    struct Reputation {
        uint256 totalSwaps;
        uint256 successSwaps;
    }

    /// @notice Maps a bot/agent address to their reputation statistics.
    mapping(address => Reputation) public reputations;

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    /// @notice Emitted whenever a bot's swap is recorded.
    event SwapRecorded(address indexed agent, bool success, uint256 newTotal, uint256 newSuccess);

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------

    /**
     * @param initialOwner Address that will own the contract (usually the deployer).
     *                     The owner determines which backend addresses can call recordSwap.
     */
    constructor(address initialOwner) Ownable(initialOwner) {}

    // -----------------------------------------------------------------------
    // Agent Activity Logging
    // -----------------------------------------------------------------------

    /**
     * @notice Records the outcome of a swap executed by an agent.
     * @dev    Only callable by the contract owner (SwapSmith backend wallet).
     * @param agent   Address of the agent/bot that executed the swap.
     * @param success Boolean indicating if the swap was ultimately successful or failed/refunded.
     */
    function recordSwap(address agent, bool success) external onlyOwner {
        require(agent != address(0), "AgentReputation: Agent address cannot be zero");

        Reputation storage rep = reputations[agent];
        
        rep.totalSwaps += 1;
        if (success) {
            rep.successSwaps += 1;
        }

        emit SwapRecorded(agent, success, rep.totalSwaps, rep.successSwaps);
    }

    // -----------------------------------------------------------------------
    // Reading Reputation
    // -----------------------------------------------------------------------

    /**
     * @notice Fetch the reputation of a specific agent.
     * @param agent Address of the agent/bot.
     * @return totalSwaps   Total number of swaps attempted.
     * @return successSwaps Number of successful swaps.
     */
    function getReputation(address agent) external view returns (uint256 totalSwaps, uint256 successSwaps) {
        Reputation storage rep = reputations[agent];
        return (rep.totalSwaps, rep.successSwaps);
    }
}
