// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title RewardToken (SMTH)
 * @notice SwapSmith ERC20 reward token with capped supply, tier tracking, and gasless approvals.
 *         Users earn points on the SwapSmith rewards page; the backend
 *         (owner wallet) calls rewardUser() to convert those points into
 *         on-chain SMTH tokens.
 *
 * Security & UX features:
 * - Maximum supply cap to prevent unlimited minting
 * - Two-step ownership transfer for safer governance transitions
 * - Governance-controlled minting cap updates
 * - ERC20Permit for gasless approvals (EIP-2612)
 * - Automatic tier upgrade event emissions based on balances
 * - Custom errors for maximum gas efficiency
 */
contract RewardToken is ERC20, ERC20Permit, ERC20Burnable, Ownable2Step {
    // -----------------------------------------------------------------------
    // Constants
    // -----------------------------------------------------------------------

    /// @notice Initial supply minted to the deployer so it can fund rewards.
    uint256 public constant INITIAL_SUPPLY = 1_000_000 * 10 ** 18;

    /// @notice Tier thresholds mapped to the frontend subscription schema
    uint256 public constant PREMIUM_TIER_THRESHOLD = 10_000 * 10 ** 18;
    uint256 public constant PRO_TIER_THRESHOLD = 50_000 * 10 ** 18;

    // -----------------------------------------------------------------------
    // State Variables
    // -----------------------------------------------------------------------

    /// @notice Current maximum supply cap (can be updated by governance).
    /// @dev Initially set to 10M SMTH (10x initial supply).
    uint256 public mintingCap;

    // -----------------------------------------------------------------------
    // Events & Errors
    // -----------------------------------------------------------------------

    event UserRewarded(address indexed user, uint256 amount);
    event TierUpgraded(address indexed user, string newTier);
    event MaxSupplyReached(uint256 totalSupply, uint256 cap);
    event MintingCapUpdated(uint256 oldCap, uint256 newCap);

    error RewardToken__InvalidAddress();
    error RewardToken__ZeroAmount();
    error RewardToken__InsufficientTreasuryBalance();
    error RewardToken__CapExceeded();
    error RewardToken__InvalidCap();

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------

    /**
     * @param initialOwner  Address that will own the contract (deployer).
     *                      Receives the full initial supply.
     */
    constructor(address initialOwner)
        ERC20("SwapSmith", "SMTH")
        ERC20Permit("SwapSmith")
        Ownable(initialOwner)
    {
        mintingCap = 10_000_000 * 10 ** 18;
        _mint(initialOwner, INITIAL_SUPPLY);
    }

    // -----------------------------------------------------------------------
    // Owner functions
    // -----------------------------------------------------------------------

    /**
     * @notice Transfer reward tokens to a user and track tier upgrades.
     * @dev    Only callable by the contract owner (SwapSmith backend wallet).
     * @param user   Recipient address (user's connected wallet).
     * @param amount Token amount in wei.
     */
    function rewardUser(address user, uint256 amount) external onlyOwner {
        if (user == address(0)) revert RewardToken__InvalidAddress();
        if (amount == 0) revert RewardToken__ZeroAmount();
        if (balanceOf(owner()) < amount) revert RewardToken__InsufficientTreasuryBalance();

        uint256 previousBalance = balanceOf(user);
        _transfer(owner(), user, amount);
        uint256 newBalance = previousBalance + amount;

        // Emit events so the backend can sync the Drizzle user 'plan' enum
        if (previousBalance < PREMIUM_TIER_THRESHOLD && newBalance >= PREMIUM_TIER_THRESHOLD) {
            emit TierUpgraded(user, "premium");
        } else if (previousBalance < PRO_TIER_THRESHOLD && newBalance >= PRO_TIER_THRESHOLD) {
            emit TierUpgraded(user, "pro");
        }

        emit UserRewarded(user, amount);
    }

    // -----------------------------------------------------------------------
    // Treasury & Minting
    // -----------------------------------------------------------------------

    /**
     * @notice Mint additional SMTH tokens to the owner treasury.
     * @param amount Amount to mint (in wei).
     */
    function mintToTreasury(uint256 amount) external onlyOwner {
        if (amount == 0) revert RewardToken__ZeroAmount();
        
        uint256 newTotalSupply = totalSupply() + amount;
        if (newTotalSupply > mintingCap) revert RewardToken__CapExceeded();
        
        _mint(owner(), amount);
        
        if (newTotalSupply == mintingCap) {
            emit MaxSupplyReached(newTotalSupply, mintingCap);
        }
    }

    // -----------------------------------------------------------------------
    // Governance & Views
    // -----------------------------------------------------------------------

    /**
     * @notice Update the minting cap (governance function).
     * @param newCap The new minting cap (in wei).
     */
    function setMintingCap(uint256 newCap) external onlyOwner {
        if (newCap < totalSupply()) revert RewardToken__InvalidCap();
        
        uint256 oldCap = mintingCap;
        mintingCap = newCap;
        
        emit MintingCapUpdated(oldCap, newCap);
    }

    /**
     * @notice Checks the user's current gamification tier based on token holdings.
     */
    function getUserTier(address user) external view returns (string memory) {
        uint256 balance = balanceOf(user);
        if (balance >= PRO_TIER_THRESHOLD) return "pro";
        if (balance >= PREMIUM_TIER_THRESHOLD) return "premium";
        return "free";
    }
}