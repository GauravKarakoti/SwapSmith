require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// Pull secrets from .env – never hardcode these values.
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "";
const PRIVATE_KEY     = process.env.PRIVATE_KEY     || "";

if (!SEPOLIA_RPC_URL || !PRIVATE_KEY) {
  console.warn(
    "\n⚠️  Missing SEPOLIA_RPC_URL or PRIVATE_KEY in .env – " +
    "Sepolia deployment will not work until these are set.\n"
  );
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  networks: {
    // -------------------------------------------------------------------
    // Local Hardhat in-process network (default – used for tests)
    // -------------------------------------------------------------------
    hardhat: {
      chainId: 31337,
    },

    // -------------------------------------------------------------------
    // Sepolia testnet (free ETH via faucets – no mainnet)
    // See README for how to obtain free Sepolia ETH.
    // -------------------------------------------------------------------
    sepolia: {
      url:      SEPOLIA_RPC_URL,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId:  11155111,
    },
  },

  // Optional: verify contract on Etherscan (free account required).
  // Set ETHERSCAN_API_KEY in .env to enable.
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },

  // Hardhat gas reporter (useful during local testing)
  gasReporter: {
    enabled:  process.env.REPORT_GAS === "true",
    currency: "USD",
  },
};
