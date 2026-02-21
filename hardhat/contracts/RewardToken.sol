// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title RewardToken (SMTH)
 * @notice SwapSmith ERC20 reward token.
 *         Users earn points on the SwapSmith rewards page; the backend
 *         (owner wallet) calls rewardUser() to convert those points into
 *         on-chain SMTH tokens.
 *
 * Deployed on Sepolia testnet (free / no mainnet usage).
 */
contract RewardToken is ERC20, Ownable {
    // -----------------------------------------------------------------------
    // Constants
    // -----------------------------------------------------------------------

    /// @notice Initial supply minted to the deployer so it can fund rewards.
    uint256 public constant INITIAL_SUPPLY = 1_000_000 * 10 ** 18;

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    /// @notice Emitted whenever the owner rewards a user with tokens.
    event UserRewarded(address indexed user, uint256 amount);

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------

    /**
     * @param initialOwner  Address that will own the contract (deployer).
     *                      Receives the full initial supply.
     */
    constructor(address initialOwner)
        ERC20("SwapSmith", "SMTH")
        Ownable(initialOwner)
    {
        // Mint 1,000,000 SMTH to the deployer / owner wallet.
        // This treasury is used to fund user rewards.
        _mint(initialOwner, INITIAL_SUPPLY);
    }

    // -----------------------------------------------------------------------
    // Owner functions
    // -----------------------------------------------------------------------

    /**
     * @notice Transfer reward tokens to a user.
     * @dev    Only callable by the contract owner (SwapSmith backend wallet).
     *         The owner must hold enough SMTH to cover the reward.
     * @param user    Recipient address (user's connected wallet).
     * @param amount  Token amount in wei (e.g. 10 * 10**18 for 10 SMTH).
     */
    function rewardUser(address user, uint256 amount) external onlyOwner {
        require(user != address(0), "RewardToken: reward to zero address");
        require(amount > 0, "RewardToken: amount must be > 0");
        require(
            balanceOf(owner()) >= amount,
            "RewardToken: insufficient owner balance"
        );

        _transfer(owner(), user, amount);
        emit UserRewarded(user, amount);
    }

    // -----------------------------------------------------------------------
    // Optional: allow owner to mint more tokens if the treasury runs low
    // -----------------------------------------------------------------------

    /**
     * @notice Mint additional SMTH tokens to the owner treasury.
     * @dev    Only callable by the owner. Allows the treasury to be topped up
     *         without redeploying the contract.
     * @param amount Amount to mint (in wei).
     */
    function mintToTreasury(uint256 amount) external onlyOwner {
        require(amount > 0, "RewardToken: amount must be > 0");
        _mint(owner(), amount);
    }
}
