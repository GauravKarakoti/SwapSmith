// scripts/deploy-reputation.js
// Deploy the SwapSmith AgentReputation to the configured network.
//
// Usage:
//   Local node:   npx hardhat run scripts/deploy-reputation.js --network localhost
//   Sepolia:      npx hardhat run scripts/deploy-reputation.js --network sepolia
//
// After deploying to Sepolia, copy the printed contract address into
// bot/.env as REPUTATION_CONTRACT_ADDRESS.

const { ethers } = require("hardhat");

async function main() {
    // -------------------------------------------------------------------------
    // 1. Get the deployer signer
    // -------------------------------------------------------------------------
    const [deployer] = await ethers.getSigners();

    console.log("─".repeat(60));
    console.log("🚀  SwapSmith AgentReputation Deployment");
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
    // 2. Deploy AgentReputation
    // -------------------------------------------------------------------------
    console.log("\n📄  Deploying AgentReputation...");

    const AgentReputation = await ethers.getContractFactory("AgentReputation");
    const token = await AgentReputation.deploy(deployer.address);
    await token.waitForDeployment();

    const contractAddress = await token.getAddress();

    // -------------------------------------------------------------------------
    // 3. Print results
    // -------------------------------------------------------------------------
    console.log("─".repeat(60));
    console.log(`✅  AgentReputation deployed!`);
    console.log(`    Contract address : ${contractAddress}`);

    const network = await ethers.provider.getNetwork();
    const chainId = network.chainId;

    if (chainId === 11155111n) {
        console.log(
            `\n🔍  View on Etherscan:\n` +
            `    https://sepolia.etherscan.io/address/${contractAddress}`
        );
        console.log(
            `\n📋  Add to bot/.env:\n` +
            `    REPUTATION_CONTRACT_ADDRESS=${contractAddress}`
        );
    }
    console.log("─".repeat(60));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
