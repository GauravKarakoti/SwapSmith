// scripts/deploy.js
// Deploy the SwapSmith RewardToken (SMTH) to the configured network.
//
// Usage:
//   Local node:   npx hardhat run scripts/deploy.js --network localhost
//   Sepolia:      npx hardhat run scripts/deploy.js --network sepolia
//
// After deploying to Sepolia, copy the printed contract address into
// frontend/.env.local as NEXT_PUBLIC_REWARD_TOKEN_ADDRESS.

const { ethers } = require("hardhat");

async function main() {
  // -------------------------------------------------------------------------
  // 1. Get the deployer signer
  // -------------------------------------------------------------------------
  const [deployer] = await ethers.getSigners();

  console.log("─".repeat(60));
  console.log("🚀  SwapSmith RewardToken (SMTH) Deployment");
  console.log("─".repeat(60));
  console.log(`Deployer address : ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance : ${ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    throw new Error(
      "Deployer wallet has 0 ETH. " +
      "Fund it with free Sepolia ETH from https://sepoliafaucet.com"
    );
  }

  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;

  // -------------------------------------------------------------------------
  // 2. Deploy RewardToken
  // -------------------------------------------------------------------------
  console.log("\n📄  Deploying RewardToken...");

  const RewardToken = await ethers.getContractFactory("RewardToken");
  // Pass the deployer address as initialOwner (required by OZ Ownable v5)
  const rewardtoken = await RewardToken.deploy(deployer.address);
  await rewardtoken.waitForDeployment();

  const rewardtokencontractAddress = await rewardtoken.getAddress();

  // -------------------------------------------------------------------------
  // 3. Print results
  // -------------------------------------------------------------------------
  console.log("─".repeat(60));
  console.log(`✅  RewardToken deployed!`);
  console.log(`    Contract address : ${rewardtokencontractAddress}`);
  console.log(`    Token name       : ${await rewardtoken.name()} (SMTH)`);
  console.log(`    Token symbol     : ${await rewardtoken.symbol()}`);

  const totalSupply = await rewardtoken.totalSupply();
  console.log(`    Total supply     : ${ethers.formatEther(totalSupply)} SMTH`);

  if (chainId === 11155111n) {
    console.log(
      `\n🔍  View on Etherscan:\n` +
      `    https://sepolia.etherscan.io/address/${rewardtokencontractAddress}`
    );
    console.log(
      `\n📋  Add to frontend/.env:\n` +
      `    NEXT_PUBLIC_REWARD_TOKEN_ADDRESS=${rewardtokencontractAddress}`
    );
  }

  console.log("\n📄  Deploying AgentReputation...");

  const AgentReputation = await ethers.getContractFactory("AgentReputation");
  const agentreputationtoken = await AgentReputation.deploy(deployer.address);
  await agentreputationtoken.waitForDeployment();

  const agentreputationcontractAddress = await agentreputationtoken.getAddress();

  console.log("─".repeat(60));
  console.log(`✅  AgentReputation deployed!`);
  console.log(`    Contract address : ${agentreputationcontractAddress}`);

  if (chainId === 11155111n) {
      console.log(
          `\n🔍  View on Etherscan:\n` +
          `    https://sepolia.etherscan.io/address/${agentreputationcontractAddress}`
      );
      console.log(
          `\n📋  Add to bot/.env:\n` +
          `    REPUTATION_CONTRACT_ADDRESS=${agentreputationcontractAddress}`
      );
  }

  console.log("─".repeat(60));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
