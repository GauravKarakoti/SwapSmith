# SwapSmith Reward Token (SMTH) – Hardhat Project

> **Free, testnet-only Ethereum ERC20 token used to convert SwapSmith reward
> points into on-chain SMTH tokens.** No mainnet, no paid services.

---

## Overview

| Item           | Value                               |
| -------------- | ----------------------------------- |
| Contract       | `RewardToken.sol`                   |
| Token name     | SwapSmith                           |
| Symbol         | `SMTH`                              |
| Decimals       | 18                                  |
| Initial supply | 1,000,000 SMTH (minted to deployer) |
| Network        | Sepolia testnet                     |

The owner wallet (your backend service key) calls `rewardUser(address, amount)`
to transfer SMTH from the treasury to a user's wallet whenever they redeem
reward points on the SwapSmith rewards page.

---

## Setup

### 1. Install dependencies

```bash
cd hardhat
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in:

| Variable            | Description                                  |
| ------------------- | -------------------------------------------- |
| `SEPOLIA_RPC_URL`   | Free Alchemy or Infura endpoint for Sepolia  |
| `PRIVATE_KEY`       | Private key of your **dedicated dev wallet** |
| `ETHERSCAN_API_KEY` | (Optional) Verify source on Etherscan        |

> **Security** – Use a dedicated throwaway wallet for dev/testnet work.
> Never put a wallet that holds real ETH in `.env`.

#### Getting a free RPC URL (pick one)

| Provider    | Free tier                  | Link                          |
| ----------- | -------------------------- | ----------------------------- |
| **Alchemy** | 300M compute units / month | https://dashboard.alchemy.com |
| **Infura**  | 100K requests / day        | https://infura.io             |

Create a new app → select **Ethereum Sepolia** → copy the HTTPS URL.

---

## How to Run Tests (local, free, no network needed)

```bash
npm test
# or
npx hardhat test
```

Tests run against Hardhat's built-in in-process EVM — no Sepolia ETH required.

```
  RewardToken (SMTH)
    Deployment
      ✔ should deploy successfully and have a valid address
      ✔ should set the correct token name and symbol
      ✔ should set the deployer as the owner
    Total Supply
      ✔ should mint exactly 1,000,000 SMTH to the deployer on construction
      ✔ INITIAL_SUPPLY constant should match 1,000,000 * 10^18
    rewardUser()
      ✔ should transfer tokens from owner to a user
      ✔ should emit a UserRewarded event
      ✔ should revert if called by a non-owner
      ✔ should revert when rewarding the zero address
      ✔ should revert when amount is zero
      ✔ should allow rewarding multiple users sequentially
    mintToTreasury()
      ✔ should allow owner to mint additional tokens
      ✔ should revert if called by a non-owner
    ERC20 standard compliance
      ✔ should have 18 decimals
      ✔ should allow a user to transfer tokens they own
```

---

## How to Run a Local Hardhat Node

> Only needed if you want to test a full local blockchain. Tests do **not**
> require this.

```bash
# Terminal 1 – start the local node
npx hardhat node

# Terminal 2 – deploy to it
npm run deploy:local
```

---

## How to Deploy to Sepolia (free testnet)

### Step 1 – Get free Sepolia ETH

You need a small amount of Sepolia ETH to pay gas fees (usually < 0.01 ETH).

| Faucet                 | Link                                                              | Notes                               |
| ---------------------- | ----------------------------------------------------------------- | ----------------------------------- |
| Alchemy Sepolia Faucet | https://sepoliafaucet.com                                         | 0.5 ETH/day, requires Alchemy login |
| Google Sepolia Faucet  | https://cloud.google.com/application/web3/faucet/ethereum/sepolia | 0.05 ETH/day                        |
| Chainlink Faucet       | https://faucets.chain.link/sepolia                                | 0.1 ETH/day                         |
| Infura Faucet          | https://www.infura.io/faucet/sepolia                              | Free with Infura account            |
| PoW Faucet             | https://sepolia-faucet.pk910.de                                   | Mine for ETH (no sign-up)           |

Send the ETH to the wallet whose private key is in your `.env`.

### Step 2 – Deploy

```bash
npm run deploy:sepolia
# or
npx hardhat run scripts/deploy.js --network sepolia
```

Example output:

```
────────────────────────────────────────────────────────────
🚀  SwapSmith RewardToken (SMTH) Deployment
────────────────────────────────────────────────────────────
Deployer address : 0xYourWalletAddress
Deployer balance : 0.5 ETH

📄  Deploying RewardToken...
────────────────────────────────────────────────────────────
✅  RewardToken deployed!
    Contract address : 0xDeployedContractAddress
    Token name       : SwapSmith
    Token symbol     : SMTH
    Total supply     : 1000000.0 SMTH

🔍  View on Etherscan:
    https://sepolia.etherscan.io/address/0xDeployedContractAddress

📋  Add to frontend/.env.local:
    NEXT_PUBLIC_REWARD_TOKEN_ADDRESS=0xDeployedContractAddress
────────────────────────────────────────────────────────────
```

### Step 3 – Add contract address to frontend

Open `frontend/.env.local` and add:

```env
NEXT_PUBLIC_REWARD_TOKEN_ADDRESS=0xDeployedContractAddress
REWARD_TOKEN_OWNER_PRIVATE_KEY=<same key as PRIVATE_KEY in hardhat/.env>
```

### Step 4 – (Optional) Verify on Etherscan

```bash
npx hardhat verify --network sepolia <CONTRACT_ADDRESS> <DEPLOYER_ADDRESS>
```

---

## Project Structure

```
hardhat/
├── contracts/
│   └── RewardToken.sol      # ERC20 SMTH token contract
├── scripts/
│   └── deploy.js            # Deployment script
├── test/
│   └── RewardToken.js       # Mocha / Chai tests
├── .env.example             # Env variable template (copy → .env)
├── .gitignore
├── hardhat.config.js        # Hardhat configuration
├── package.json
└── README.md
```

---

## Integration with SwapSmith Rewards Page

The flow is:

```
User earns points on rewards page
        ↓
Backend converts points → SMTH amount
(e.g. 100 points = 1 SMTH = 1 * 10^18 wei)
        ↓
Backend wallet calls:
  rewardToken.rewardUser(userWalletAddress, amountInWei)
        ↓
User receives SMTH in their wallet
```

The backend API (`/api/rewards/claim`) should:

1. Verify the user's pending token balance.
2. Sign and send a `rewardUser` transaction using the owner private key.
3. Record the transaction hash in the database.

---

## Cost Summary

| Item                   | Cost                    |
| ---------------------- | ----------------------- |
| Alchemy/Infura RPC     | Free                    |
| Sepolia ETH            | Free (faucets)          |
| Contract deployment    | Free (testnet gas only) |
| Running tests          | Free (local EVM)        |
| Etherscan verification | Free                    |
| **Total**              | **$0**                  |
