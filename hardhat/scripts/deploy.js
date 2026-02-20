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

  // -------------------------------------------------------------------------
  // 2. Deploy RewardToken
  // -------------------------------------------------------------------------
  console.log("\n📄  Deploying RewardToken...");

  const RewardToken = await ethers.getContractFactory("RewardToken");
  // Pass the deployer address as initialOwner (required by OZ Ownable v5)
  const token = await RewardToken.deploy(deployer.address);
  await token.waitForDeployment();

  const contractAddress = await token.getAddress();

  // -------------------------------------------------------------------------
  // 3. Print results
  // -------------------------------------------------------------------------
  console.log("─".repeat(60));
  console.log(`✅  RewardToken deployed!`);
  console.log(`    Contract address : ${contractAddress}`);
console.log(`    Token name       : ${await token.name()} (SMTH)`);
  console.log(`    Token symbol     : ${await token.symbol()}`);

  const totalSupply = await token.totalSupply();
  console.log(`    Total supply     : ${ethers.formatEther(totalSupply)} SMTH`);

  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;

  if (chainId === 11155111n) {
    console.log(
      `\n🔍  View on Etherscan:\n` +
      `    https://sepolia.etherscan.io/address/${contractAddress}`
    );
    console.log(
      `\n📋  Add to frontend/.env.local:\n` +
      `    NEXT_PUBLIC_REWARD_TOKEN_ADDRESS=${contractAddress}`
    );
  }
  console.log("─".repeat(60));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
