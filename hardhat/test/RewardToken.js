// test/RewardToken.js
// Hardhat / Mocha / Chai tests for the SwapSmith RewardToken (SMTH).
//
// Run: npx hardhat test
//
// Tests run against the in-process Hardhat network (no Sepolia needed).

const { expect }                = require("chai");
const { ethers }                = require("hardhat");
const { loadFixture }           = require("@nomicfoundation/hardhat-toolbox/network-helpers");

// ---------------------------------------------------------------------------
// Shared fixture – deploy once, snapshot & reuse for each test.
// ---------------------------------------------------------------------------
async function deployRewardTokenFixture() {
  const [owner, user1, user2] = await ethers.getSigners();

  const RewardToken = await ethers.getContractFactory("RewardToken");
  const token = await RewardToken.deploy(owner.address);
  await token.waitForDeployment();

  return { token, owner, user1, user2 };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe("RewardToken (SMTH)", function () {

  // ─── Deployment ────────────────────────────────────────────────────────────

  describe("Deployment", function () {
    it("should deploy successfully and have a valid address", async function () {
      const { token } = await loadFixture(deployRewardTokenFixture);
      const address = await token.getAddress();
      expect(address).to.be.a("string").and.match(/^0x[0-9a-fA-F]{40}$/);
    });

    it("should set the correct token name and symbol", async function () {
      const { token } = await loadFixture(deployRewardTokenFixture);
      expect(await token.name()).to.equal("SwapSmith");
      expect(await token.symbol()).to.equal("SMTH");
    });

    it("should set the deployer as the owner", async function () {
      const { token, owner } = await loadFixture(deployRewardTokenFixture);
      expect(await token.owner()).to.equal(owner.address);
    });
  });

  // ─── Total supply ──────────────────────────────────────────────────────────

  describe("Total Supply", function () {
    it("should mint exactly 1,000,000 SMTH to the deployer on construction", async function () {
      const { token, owner } = await loadFixture(deployRewardTokenFixture);

      const expectedSupply = ethers.parseEther("1000000");

      expect(await token.totalSupply()).to.equal(expectedSupply);
      expect(await token.balanceOf(owner.address)).to.equal(expectedSupply);
    });

    it("INITIAL_SUPPLY constant should match 1,000,000 * 10^18", async function () {
      const { token } = await loadFixture(deployRewardTokenFixture);
      expect(await token.INITIAL_SUPPLY()).to.equal(ethers.parseEther("1000000"));
    });
  });

  // ─── rewardUser() ─────────────────────────────────────────────────────────

  describe("rewardUser()", function () {
    it("should transfer tokens from owner to a user", async function () {
      const { token, owner, user1 } = await loadFixture(deployRewardTokenFixture);

      const rewardAmount = ethers.parseEther("100"); // 100 SMTH

      await expect(token.connect(owner).rewardUser(user1.address, rewardAmount))
        .to.changeTokenBalances(
          token,
          [owner, user1],
          [-rewardAmount, rewardAmount]
        );
    });

    it("should emit a UserRewarded event", async function () {
      const { token, owner, user1 } = await loadFixture(deployRewardTokenFixture);

      const rewardAmount = ethers.parseEther("50");

      await expect(token.connect(owner).rewardUser(user1.address, rewardAmount))
        .to.emit(token, "UserRewarded")
        .withArgs(user1.address, rewardAmount);
    });

    it("should revert if called by a non-owner", async function () {
      const { token, user1, user2 } = await loadFixture(deployRewardTokenFixture);

      const rewardAmount = ethers.parseEther("10");

      await expect(
        token.connect(user1).rewardUser(user2.address, rewardAmount)
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("should revert when rewarding the zero address", async function () {
      const { token, owner } = await loadFixture(deployRewardTokenFixture);

      await expect(
        token.connect(owner).rewardUser(ethers.ZeroAddress, ethers.parseEther("10"))
      ).to.be.revertedWith("RewardToken: reward to zero address");
    });

    it("should revert when amount is zero", async function () {
      const { token, owner, user1 } = await loadFixture(deployRewardTokenFixture);

      await expect(
        token.connect(owner).rewardUser(user1.address, 0n)
      ).to.be.revertedWith("RewardToken: amount must be > 0");
    });

    it("should allow rewarding multiple users sequentially", async function () {
      const { token, owner, user1, user2 } = await loadFixture(deployRewardTokenFixture);

      await token.connect(owner).rewardUser(user1.address, ethers.parseEther("200"));
      await token.connect(owner).rewardUser(user2.address, ethers.parseEther("300"));

      expect(await token.balanceOf(user1.address)).to.equal(ethers.parseEther("200"));
      expect(await token.balanceOf(user2.address)).to.equal(ethers.parseEther("300"));
      expect(await token.balanceOf(owner.address)).to.equal(ethers.parseEther("999500"));
    });
  });

  // ─── mintToTreasury() ─────────────────────────────────────────────────────

  describe("mintToTreasury()", function () {
    it("should allow owner to mint additional tokens within cap", async function () {
      const { token, owner } = await loadFixture(deployRewardTokenFixture);

      const mintAmount = ethers.parseEther("500000");
      await token.connect(owner).mintToTreasury(mintAmount);

      expect(await token.totalSupply()).to.equal(ethers.parseEther("1500000"));
      expect(await token.balanceOf(owner.address)).to.equal(ethers.parseEther("1500000"));
    });

    it("should revert if called by a non-owner", async function () {
      const { token, user1 } = await loadFixture(deployRewardTokenFixture);

      await expect(
        token.connect(user1).mintToTreasury(ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("should revert if minting would exceed the cap", async function () {
      const { token, owner } = await loadFixture(deployRewardTokenFixture);

      // Try to mint beyond the 10M cap (current supply: 1M, cap: 10M)
      const excessAmount = ethers.parseEther("9000001"); // Would make total 10,000,001

      await expect(
        token.connect(owner).mintToTreasury(excessAmount)
      ).to.be.revertedWith("RewardToken: minting would exceed cap");
    });

    it("should emit MaxSupplyReached event when cap is reached", async function () {
      const { token, owner } = await loadFixture(deployRewardTokenFixture);

      // Mint exactly up to the cap (1M initial + 9M = 10M cap)
      const mintAmount = ethers.parseEther("9000000");
      const expectedTotalSupply = ethers.parseEther("10000000");

      await expect(token.connect(owner).mintToTreasury(mintAmount))
        .to.emit(token, "MaxSupplyReached")
        .withArgs(expectedTotalSupply, expectedTotalSupply);

      expect(await token.totalSupply()).to.equal(expectedTotalSupply);
    });

    it("should not emit MaxSupplyReached if cap is not reached", async function () {
      const { token, owner } = await loadFixture(deployRewardTokenFixture);

      const mintAmount = ethers.parseEther("500000");
      
      const tx = await token.connect(owner).mintToTreasury(mintAmount);
      const receipt = await tx.wait();

      // Check that MaxSupplyReached event was not emitted
      const maxSupplyEvents = receipt.logs.filter(
        log => log.fragment && log.fragment.name === "MaxSupplyReached"
      );
      expect(maxSupplyEvents.length).to.equal(0);
    });
  });

  // ─── setMintingCap() ──────────────────────────────────────────────────────

  describe("setMintingCap()", function () {
    it("should allow owner to increase the minting cap", async function () {
      const { token, owner } = await loadFixture(deployRewardTokenFixture);

      const initialCap = await token.mintingCap();
      const newCap = ethers.parseEther("20000000"); // 20M SMTH

      await expect(token.connect(owner).setMintingCap(newCap))
        .to.emit(token, "MintingCapUpdated")
        .withArgs(initialCap, newCap);

      expect(await token.mintingCap()).to.equal(newCap);
    });

    it("should allow owner to decrease the minting cap to current supply", async function () {
      const { token, owner } = await loadFixture(deployRewardTokenFixture);

      const currentSupply = await token.totalSupply(); // 1M SMTH
      const newCap = currentSupply; // Set cap equal to current supply

      await token.connect(owner).setMintingCap(newCap);
      expect(await token.mintingCap()).to.equal(currentSupply);
    });

    it("should revert if new cap is below current total supply", async function () {
      const { token, owner } = await loadFixture(deployRewardTokenFixture);

      const currentSupply = await token.totalSupply(); // 1M SMTH
      const invalidCap = currentSupply - ethers.parseEther("1"); // Below current supply

      await expect(
        token.connect(owner).setMintingCap(invalidCap)
      ).to.be.revertedWith("RewardToken: new cap below current supply");
    });

    it("should revert if called by a non-owner", async function () {
      const { token, user1 } = await loadFixture(deployRewardTokenFixture);

      await expect(
        token.connect(user1).setMintingCap(ethers.parseEther("15000000"))
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("should allow minting after cap is increased", async function () {
      const { token, owner } = await loadFixture(deployRewardTokenFixture);

      // First, mint up to the original cap
      await token.connect(owner).mintToTreasury(ethers.parseEther("9000000"));
      expect(await token.totalSupply()).to.equal(ethers.parseEther("10000000"));

      // Try to mint more - should fail
      await expect(
        token.connect(owner).mintToTreasury(ethers.parseEther("1"))
      ).to.be.revertedWith("RewardToken: minting would exceed cap");

      // Increase the cap
      await token.connect(owner).setMintingCap(ethers.parseEther("15000000"));

      // Now minting should work
      await token.connect(owner).mintToTreasury(ethers.parseEther("1000000"));
      expect(await token.totalSupply()).to.equal(ethers.parseEther("11000000"));
    });
  });

  // ─── Minting cap ──────────────────────────────────────────────────────────

  describe("Minting Cap", function () {
    it("should initialize with a 10M SMTH minting cap", async function () {
      const { token } = await loadFixture(deployRewardTokenFixture);
      expect(await token.mintingCap()).to.equal(ethers.parseEther("10000000"));
    });

    it("should enforce the minting cap across multiple mints", async function () {
      const { token, owner } = await loadFixture(deployRewardTokenFixture);

      // Mint several times, approaching the cap
      await token.connect(owner).mintToTreasury(ethers.parseEther("3000000"));
      await token.connect(owner).mintToTreasury(ethers.parseEther("3000000"));
      await token.connect(owner).mintToTreasury(ethers.parseEther("2999999"));

      // Total supply should now be 9,999,999 SMTH (1M initial + 8,999,999 minted)
      expect(await token.totalSupply()).to.equal(ethers.parseEther("9999999"));

      // Trying to mint 2 more should fail (would exceed 10M cap)
      await expect(
        token.connect(owner).mintToTreasury(ethers.parseEther("2"))
      ).to.be.revertedWith("RewardToken: minting would exceed cap");

      // Minting exactly 1 more should succeed and reach the cap
      await expect(token.connect(owner).mintToTreasury(ethers.parseEther("1")))
        .to.emit(token, "MaxSupplyReached")
        .withArgs(ethers.parseEther("10000000"), ethers.parseEther("10000000"));
    });
  });

  // ─── Two-step ownership transfer ──────────────────────────────────────────

  describe("Two-step ownership transfer (Ownable2Step)", function () {
    it("should require two steps to transfer ownership", async function () {
      const { token, owner, user1 } = await loadFixture(deployRewardTokenFixture);

      // Step 1: Current owner initiates transfer
      await token.connect(owner).transferOwnership(user1.address);

      // Ownership should not have changed yet
      expect(await token.owner()).to.equal(owner.address);

      // Step 2: New owner accepts ownership
      await token.connect(user1).acceptOwnership();

      // Now ownership should be transferred
      expect(await token.owner()).to.equal(user1.address);
    });

    it("should emit events during two-step ownership transfer", async function () {
      const { token, owner, user1 } = await loadFixture(deployRewardTokenFixture);

      // Step 1 should emit OwnershipTransferStarted
      await expect(token.connect(owner).transferOwnership(user1.address))
        .to.emit(token, "OwnershipTransferStarted")
        .withArgs(owner.address, user1.address);

      // Step 2 should emit OwnershipTransferred
      await expect(token.connect(user1).acceptOwnership())
        .to.emit(token, "OwnershipTransferred")
        .withArgs(owner.address, user1.address);
    });

    it("should revert if non-pending-owner tries to accept ownership", async function () {
      const { token, owner, user1, user2 } = await loadFixture(deployRewardTokenFixture);

      // Initiate transfer to user1
      await token.connect(owner).transferOwnership(user1.address);

      // user2 tries to accept (should fail)
      await expect(
        token.connect(user2).acceptOwnership()
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("should allow canceling ownership transfer by renouncing ownership", async function () {
      const { token, owner, user1 } = await loadFixture(deployRewardTokenFixture);

      // Initiate transfer to user1
      await token.connect(owner).transferOwnership(user1.address);

      // Cancel by renouncing ownership
      await token.connect(owner).renounceOwnership();

      // Ownership should be zero address
      expect(await token.owner()).to.equal(ethers.ZeroAddress);
    });
  });

  // ─── ERC20 standard compliance ────────────────────────────────────────────

  describe("ERC20 standard compliance", function () {
    it("should have 18 decimals", async function () {
      const { token } = await loadFixture(deployRewardTokenFixture);
      expect(await token.decimals()).to.equal(18);
    });

    it("should allow a user to transfer tokens they own", async function () {
      const { token, owner, user1, user2 } = await loadFixture(deployRewardTokenFixture);

      // Give user1 some tokens first
      await token.connect(owner).rewardUser(user1.address, ethers.parseEther("100"));

      // user1 transfers to user2
      await expect(
        token.connect(user1).transfer(user2.address, ethers.parseEther("40"))
      ).to.changeTokenBalances(
        token,
        [user1, user2],
        [-ethers.parseEther("40"), ethers.parseEther("40")]
      );
    });
  });
});
