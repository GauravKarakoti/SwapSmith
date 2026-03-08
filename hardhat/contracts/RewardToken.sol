// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title RewardToken (SMTH)
 * @notice SwapSmith ERC20 reward token with capped supply and secure governance.
 *         Users earn points on the SwapSmith rewards page; the backend
 *         (owner wallet) calls rewardUser() to convert those points into
 *         on-chain SMTH tokens.
 *
 * Security features:
 * - Maximum supply cap to prevent unlimited minting
 * - Two-step ownership transfer for safer governance transitions
 * - Governance-controlled minting cap updates
 *
 * Deployed on Sepolia testnet (free / no mainnet usage).
 */
contract RewardToken is ERC20, Ownable2Step {
    // -----------------------------------------------------------------------
    // Constants
    // -----------------------------------------------------------------------

    /// @notice Initial supply minted to the deployer so it can fund rewards.
    uint256 public constant INITIAL_SUPPLY = 1_000_000 * 10 ** 18;

    // -----------------------------------------------------------------------
    // State Variables
    // -----------------------------------------------------------------------

    /// @notice Current maximum supply cap (can be updated by governance).
    /// @dev Initially set to 10M SMTH (10x initial supply).
    uint256 public mintingCap;

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    /// @notice Emitted whenever the owner rewards a user with tokens.
    event UserRewarded(address indexed user, uint256 amount);

    /// @notice Emitted when minting reaches the maximum supply cap.
    event MaxSupplyReached(uint256 totalSupply, uint256 cap);

    /// @notice Emitted when the minting cap is updated by governance.
    event MintingCapUpdated(uint256 oldCap, uint256 newCap);

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
        // Set initial minting cap to 10M SMTH (10x initial supply).
        mintingCap = 10_000_000 * 10 ** 18;

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
     *         Enforces the minting cap to prevent unlimited token inflation.
     * @param amount Amount to mint (in wei).
     */
    function mintToTreasury(uint256 amount) external onlyOwner {
        require(amount > 0, "RewardToken: amount must be > 0");
        
        uint256 newTotalSupply = totalSupply() + amount;
        require(
            newTotalSupply <= mintingCap,
            "RewardToken: minting would exceed cap"
        );
        
        _mint(owner(), amount);
        
        // Emit event if we've reached the cap
        if (newTotalSupply == mintingCap) {
            emit MaxSupplyReached(newTotalSupply, mintingCap);
        }
    }

    // -----------------------------------------------------------------------
    // Governance functions
    // -----------------------------------------------------------------------

    /**
     * @notice Update the minting cap (governance function).
     * @dev    Only callable by the owner. Allows increasing or decreasing
     *         the maximum supply cap based on platform needs.
     *         The new cap must be at least the current total supply.
     * @param newCap The new minting cap (in wei).
     */
    function setMintingCap(uint256 newCap) external onlyOwner {
        require(
            newCap >= totalSupply(),
            "RewardToken: new cap below current supply"
        );
        
        uint256 oldCap = mintingCap;
        mintingCap = newCap;
        
        emit MintingCapUpdated(oldCap, newCap);
    }
}
