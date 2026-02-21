# SwapSmith Token (SMTH) – Complete Step-by-Step Setup Guide

> **Goal:** Deploy the `SwapSmith` ERC20 token on Sepolia testnet for free,
> then send real SMTH to a MetaMask wallet so you can see it on-chain.

Everything here is **completely free**. No credit card. No mainnet.

---

## Prerequisites checklist

| Requirement                | Minimum version | Check command                                   |
| -------------------------- | --------------- | ----------------------------------------------- |
| Node.js                    | v18+            | `node -v`                                       |
| npm                        | v9+             | `npm -v`                                        |
| MetaMask browser extension | any             | Install from [metamask.io](https://metamask.io) |
| Git                        | any             | `git -v`                                        |

---

## PART 1 – Local machine setup

### Step 1 – Install Node dependencies

Open a terminal in the `hardhat/` folder:

```bash
cd hardhat
npm install
```

You should see a `node_modules/` folder created. The install takes ~30 seconds.

---

### Step 2 – Verify everything compiles and tests pass

```bash
npx hardhat test
```

Expected output:

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
      ...

  15 passing
```

> If you see **15 passing**, your environment is correct. Nothing was sent to
> any network — all tests run locally in memory.

---

## PART 2 – Create your deployer wallet in MetaMask

### Step 3 – Install MetaMask

1. Go to **[metamask.io](https://metamask.io)** → Download → add to Chrome / Firefox.
2. Open MetaMask and click **Create a new wallet**.
3. Follow the on-screen steps and **save your 12-word Secret Recovery Phrase**
   somewhere safe (even for a testnet wallet).

> **Use a dedicated wallet for this.** Do not reuse a wallet that holds
> real ETH or mainnet tokens.

---

### Step 4 – Add the Sepolia testnet to MetaMask

1. Open MetaMask.
2. Click the **network selector** at the top (shows "Ethereum Mainnet" by default).
3. Click **Add a network** → **Add a network manually**.
4. Fill in:

   | Field              | Value                                               |
   | ------------------ | --------------------------------------------------- |
   | Network name       | `Sepolia Testnet`                                   |
   | New RPC URL        | `https://rpc.sepolia.org` (free, no account needed) |
   | Chain ID           | `11155111`                                          |
   | Currency symbol    | `ETH`                                               |
   | Block explorer URL | `https://sepolia.etherscan.io`                      |

5. Click **Save** → Switch to **Sepolia Testnet**.

---

### Step 5 – Export your wallet private key

You need the private key to deploy contracts from the terminal.

1. In MetaMask → click the **three-dot menu (⋮)** next to your account name.
2. Select **Account details**.
3. Click **Show private key**.
4. Enter your MetaMask password.
5. **Copy the full 64-character hex string** (starts without `0x` shown but
   you will add `0x` when pasting into `.env`).

> ⚠️ Never share your private key with anyone. Never commit it to Git.

---

## PART 3 – Get a free Alchemy RPC endpoint

Using Alchemy's free tier gives you a reliable, fast Sepolia node.

### Step 6 – Create a free Alchemy account

1. Go to **[dashboard.alchemy.com](https://dashboard.alchemy.com)**.
2. Click **Sign Up** → create a free account (no credit card).
3. After login, click **Create new app**.
4. Fill in:
   - **Name:** SwapSmith
   - **Chain:** Ethereum
   - **Network:** Ethereum Sepolia
5. Click **Create app**.

### Step 7 – Copy the RPC URL

1. Click **API key** on your new app.
2. Under **HTTPS**, copy the full URL. It looks like:
   ```
   https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
   ```
3. Keep this tab open — you'll need it in the next step.

---

## PART 4 – Configure the project

### Step 8 – Create your `.env` file

Inside `hardhat/`:

```bash
cp .env.example .env
```

Open `.env` in a text editor and fill it in:

```dotenv
# Paste your Alchemy URL from Step 7
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# Paste your MetaMask private key (with 0x prefix)
PRIVATE_KEY=0xYOUR64CHARHEXKEYHERE

# Optional – leave blank for now
ETHERSCAN_API_KEY=
REPORT_GAS=false
```

Save the file. Double-check:

- `SEPOLIA_RPC_URL` is the full Alchemy HTTPS URL.
- `PRIVATE_KEY` starts with `0x` and is exactly 66 characters total.

---

## PART 5 – Get free Sepolia ETH

You need about **0.05 ETH** to pay gas for the deployment. It costs nothing.

### Step 9 – Fund your wallet from a faucet

Try these in order (each is free, some require a login):

| Faucet                      | Amount       | Sign-in required       | Link                                                                                           |
| --------------------------- | ------------ | ---------------------- | ---------------------------------------------------------------------------------------------- |
| **Alchemy Sepolia Faucet**  | 0.5 ETH/day  | Alchemy account (free) | [sepoliafaucet.com](https://sepoliafaucet.com)                                                 |
| **Google Web3 Faucet**      | 0.05 ETH/day | Google account         | [cloud.google.com/…/faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia) |
| **Chainlink Faucet**        | 0.1 ETH/day  | GitHub account         | [faucets.chain.link/sepolia](https://faucets.chain.link/sepolia)                               |
| **PoW Faucet** (no sign-in) | ~0.05 ETH    | None (mine in browser) | [sepolia-faucet.pk910.de](https://sepolia-faucet.pk910.de)                                     |
| **Infura Faucet**           | 0.5 ETH/day  | Infura account         | [infura.io/faucet/sepolia](https://www.infura.io/faucet/sepolia)                               |

**How to use a faucet:**

1. Copy your **MetaMask wallet address** (the `0x…` address at the top of MetaMask).
2. Paste it into the faucet site.
3. Click **Send** / **Request**.
4. Wait 1–3 minutes.
5. Check your MetaMask — you should see `0.5 ETH` (or similar) appear under Sepolia.

### Step 10 – Verify your balance

In your terminal:

```bash
npx hardhat console --network sepolia
```

Then type:

```js
const [deployer] = await ethers.getSigners();
const bal = await ethers.provider.getBalance(deployer.address);
ethers.formatEther(bal); // should show e.g. "0.5"
```

Press `Ctrl+C` twice to exit the console.

---

## PART 6 – Deploy the contract to Sepolia

### Step 11 – Deploy RewardToken

```bash
npm run deploy:sepolia
```

or equivalently:

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

**Expected output:**

```
────────────────────────────────────────────────────────────
🚀  SwapSmith RewardToken (SMTH) Deployment
────────────────────────────────────────────────────────────
Deployer address : 0xYourWalletAddress
Deployer balance : 0.5 ETH

📄  Deploying RewardToken...
────────────────────────────────────────────────────────────
✅  RewardToken deployed!
    Contract address : 0xDEPLOYED_CONTRACT_ADDRESS
    Token name       : SwapSmith (SMTH)
    Token symbol     : SMTH
    Total supply     : 1000000.0 SMTH

🔍  View on Etherscan:
    https://sepolia.etherscan.io/address/0xDEPLOYED_CONTRACT_ADDRESS

📋  Add to frontend/.env.local:
    NEXT_PUBLIC_REWARD_TOKEN_ADDRESS=0xDEPLOYED_CONTRACT_ADDRESS
────────────────────────────────────────────────────────────
```

> 📌 **Copy and save `0xDEPLOYED_CONTRACT_ADDRESS`.**
> You need it for every step that follows.

**This takes 15–60 seconds** while Sepolia mines the transaction.

---

## PART 7 – See the token in your MetaMask wallet

After deployment, you (the deployer) already hold all 1,000,000 SMTH.
MetaMask just doesn't know about the token yet — you need to import it.

### Step 12 – Import the SMTH token into MetaMask

1. Open MetaMask → make sure you're on **Sepolia Testnet**.
2. Scroll to the bottom of the Assets tab → click **Import tokens**.
3. Select **Custom token**.
4. Fill in:

   | Field                  | Value                                        |
   | ---------------------- | -------------------------------------------- |
   | Token contract address | `0xDEPLOYED_CONTRACT_ADDRESS` (from Step 11) |
   | Token symbol           | `SMTH` (auto-filled)                         |
   | Token decimals         | `18` (auto-filled)                           |

5. Click **Next** → **Import**.

You should immediately see:

```
SwapSmith (SMTH)
1,000,000 SMTH
```

in your MetaMask assets list. 🎉

---

## PART 8 – Send SMTH to another wallet (test the reward flow)

This simulates the rewards page calling `rewardUser()` to send tokens to a user.

### Step 13 – Send tokens via the Hardhat console

```bash
npx hardhat console --network sepolia
```

In the console, run these one by one:

```js
// 1. Load contract
const Token = await ethers.getContractFactory("RewardToken");
const token = await Token.attach("0xDEPLOYED_CONTRACT_ADDRESS");

// 2. Confirm your balance (should be 1,000,000 SMTH)
const [owner] = await ethers.getSigners();
ethers.formatEther(await token.balanceOf(owner.address));

// 3. Send 10 SMTH to any address (replace with the recipient's wallet)
const RECIPIENT = "0xRECIPIENT_WALLET_ADDRESS";
const tx = await token.rewardUser(RECIPIENT, ethers.parseEther("10"));
await tx.wait();
console.log("Done! Tx hash:", tx.hash);

// 4. Verify recipient received tokens
ethers.formatEther(await token.balanceOf(RECIPIENT));
// → "10.0"
```

Press `Ctrl+C` twice to exit.

### Step 14 – See the transaction on Etherscan

Go to:

```
https://sepolia.etherscan.io/address/0xDEPLOYED_CONTRACT_ADDRESS
```

Click the **Token Transfers** tab. You'll see the `rewardUser` transfer recorded on-chain.

---

## PART 9 – Connect to your frontend

### Step 15 – Add the contract address to frontend

Open `frontend/.env.local` (create it if it doesn't exist) and add:

```env
# The SMTH token contract address on Sepolia
NEXT_PUBLIC_REWARD_TOKEN_ADDRESS=0xDEPLOYED_CONTRACT_ADDRESS

# Owner wallet private key used by the backend to call rewardUser()
# This is the same key as in hardhat/.env
REWARD_TOKEN_OWNER_PRIVATE_KEY=0xYOUR_PRIVATE_KEY
```

> ⚠️ `REWARD_TOKEN_OWNER_PRIVATE_KEY` is a **server-side** variable only.
> It should never start with `NEXT_PUBLIC_` because that would expose it
> to the browser.

### Step 16 – Update the `/api/rewards/claim` route

The existing claim API (`frontend/app/api/rewards/claim/route.ts`) should use the
owner key to send a signed `rewardUser()` transaction. Pseudocode:

```ts
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
const ownerWallet = new ethers.Wallet(
  process.env.REWARD_TOKEN_OWNER_PRIVATE_KEY!,
  provider,
);
const tokenAbi = ["function rewardUser(address user, uint256 amount) external"];
const token = new ethers.Contract(
  process.env.NEXT_PUBLIC_REWARD_TOKEN_ADDRESS!,
  tokenAbi,
  ownerWallet,
);

// Send tokens to the user
const tx = await token.rewardUser(
  userWalletAddress,
  ethers.parseEther(smthAmount),
);
await tx.wait();
```

The token ABI and deployed address are the only things needed — no SDK, no extra library.

---

## PART 10 – Optional: verify contract source on Etherscan

This makes the contract source readable on Sepolia Etherscan (free badge ✔).

### Step 17 – Get a free Etherscan API key

1. Go to **[etherscan.io/register](https://etherscan.io/register)** → create a free account.
2. After login → **API Keys** → **Add** → name it "SwapSmith".
3. Copy the key and add it to `hardhat/.env`:
   ```dotenv
   ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY
   ```

### Step 18 – Verify the contract

```bash
npx hardhat verify --network sepolia 0xDEPLOYED_CONTRACT_ADDRESS 0xYOUR_DEPLOYER_ADDRESS
```

The second argument is your **deployer wallet address** (the `initialOwner` constructor argument).

After ~30 seconds you'll see:

```
Successfully verified contract RewardToken on the block explorer.
https://sepolia.etherscan.io/address/0xDEPLOYED_CONTRACT_ADDRESS#code
```

---

## Quick-reference command cheat sheet

| Task                               | Command                                                  |
| ---------------------------------- | -------------------------------------------------------- |
| Run tests (local, no network)      | `npx hardhat test`                                       |
| Compile contracts                  | `npx hardhat compile`                                    |
| Open interactive console (Sepolia) | `npx hardhat console --network sepolia`                  |
| Deploy to Sepolia                  | `npm run deploy:sepolia`                                 |
| Deploy to local node               | `npm run deploy:local`                                   |
| Start local blockchain node        | `npm run node`                                           |
| Verify on Etherscan                | `npx hardhat verify --network sepolia <ADDRESS> <OWNER>` |
| Clean build artifacts              | `npx hardhat clean`                                      |

---

## Troubleshooting

### "Missing SEPOLIA_RPC_URL or PRIVATE_KEY"

Your `.env` file is missing or the variables are empty. Re-read Step 8.

### "Deployer wallet has 0 ETH"

You haven't funded the wallet yet. Go back to Step 9 and use a faucet.

### "nonce too low" or "replacement fee too low"

A previous transaction is stuck. Wait 2 minutes and try again, or increase `gasPrice`.

### Token not showing in MetaMask

Make sure MetaMask is set to **Sepolia Testnet** (not Mainnet). Then repeat Step 12.

### "OwnableUnauthorizedAccount" error

You are calling `rewardUser()` from the wrong wallet. Only the deployer wallet (owner) can call it.

### Transaction pending for > 5 minutes

Sepolia can be slow. Check [sepolia.etherscan.io](https://sepolia.etherscan.io) for network congestion. You can speed up the tx in MetaMask → **Speed Up**.

---

## Cost summary

| Item                    | Cost               |
| ----------------------- | ------------------ |
| Node.js / npm           | Free               |
| MetaMask                | Free               |
| Alchemy account + RPC   | Free               |
| Sepolia ETH (faucet)    | Free               |
| Contract deployment gas | Free (testnet ETH) |
| Etherscan API key       | Free               |
| Token transfers         | Free (testnet ETH) |
| **Total**               | **$0**             |
