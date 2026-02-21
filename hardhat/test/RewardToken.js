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
    it("should allow owner to mint additional tokens", async function () {
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
