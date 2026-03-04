# SwapSmith 🤖➡️⇄

**Your Voice-Activated Crypto Trading Assistant.**

SwapSmith allows you to execute complex, cross-chain cryptocurrency swaps using simple natural language. Powered by the SideShift.ai API and OpenAI.

> "Swap half of my MATIC on Polygon for 50 USDC on Arbitrum."

## 🚀 Features

- **Natural Language Interface:** Describe the swap you want in plain English.
- **Cross-Chain Magic:** Seamlessly swap between 200+ assets across 40+ chains.
- **Voice Input:** (Experimental) Use your microphone to command the agent.
- **Secure:** Your keys stay yours. Transactions are only executed after your explicit confirmation.
- **Real-Time Quotes:** Always get the best available rate via SideShift.

## 🛠️ How It Works

1.  **Connect Your Wallet** (e.g., MetaMask).
2.  **Type or Speak** your swap command into the chat.
3.  **Review** the parsed intent and the live quote provided by SideShift.
4.  **Confirm** the transaction directly in your wallet.
5.  **Relax** while SwapSmith handles the complex cross-chain logic in the background.

## 📦 Installation & Setup

### Prerequisites

- Node.js (v18 or higher)
- An OpenAI API key
- A SideShift API key (optional, but recommended for higher rate limits)

### Local Development

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/swapsmith.git
    cd swapsmith
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    ```bash
    # Copy template files
    cp bot/.env.example bot/.env
    cp frontend/.env.example frontend/.env
    cp hardhat/.env.example hardhat/.env
    cp shared/.env.example shared/.env
    
    # Fill in your actual API keys and secrets in each .env file
    # (These are ignored by git for security)
    ```

4.  **Install security pre-commit hook** (prevents accidental secret leaks):
    ```bash
    ./.githooks/install-hooks.sh
    ```
    ⚠️ **Important:** Never commit `.env` files. They contain sensitive credentials.

5.  **Run the development server:**
    ```bash
    npm run dev
    ```

6.  **Open your browser:**
    Navigate to [http://localhost:3000](http://localhost:3000).

## 💡 How to Use

1.  Open the app and connect your Web3 wallet (e.g., MetaMask).
2.  Ensure your wallet is connected to the correct network for the assets you want to swap from.
3.  Type your command into the input box. Examples:
    - `"Swap 0.1 ETH for BTC"`
    - `"Convert all my USDC on Arbitrum to MATIC on Polygon"`
    - `"I need $50 worth of AVAX"`
4.  The AI agent will parse your request and show you a confirmation screen with the details from the SideShift API.
5.  Review the details carefully and click "Confirm".
6.  Sign the transaction in your wallet popup.
7.  Wait for the magic to happen! You can track the swap status directly in the chat.

## 🧠 Technology Stack

- **Frontend:** Next.js, React, Tailwind CSS, Web3.js
- **Backend:** Next.js API Routes, Node.js
- **APIs:** SideShift.ai API, OpenAI GPT-4 API
- **Auth:** Web3 Wallet Connection (MetaMask)

## 🔮 Future Ideas

- Limit Orders & DCA via natural language.
- DeFi Integration (e.g., "Swap and stake").
- On-chain agent reputation system.
- Mobile app with superior voice integration.

## 🐛 Known Issues

- Voice input is highly experimental and may not work in all browsers.
- The agent can sometimes misparse very complex or ambiguous commands.

---

**Built with ❤️ for the SideShift.ai Hackathon.**
