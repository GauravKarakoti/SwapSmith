<div align="center">

# SwapSmith 🤖⇄💱

### Your Voice-Activated Crypto Trading Assistant

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

Execute complex, cross-chain cryptocurrency swaps using simple natural language.  
Powered by **SideShift.ai API** and **Groq AI**.

[Live Demo](https://swap-smith.vercel.app/) • [Report Bug](https://github.com/GauravKarakoti/SwapSmith/issues) • [Request Feature](https://github.com/GauravKarakoti/SwapSmith/issues)

</div>

---

## 📖 Table of Contents

- [About](#-about)
- [Features](#-features)
- [Demo](#-demo)
- [Architecture](#-architecture)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Frontend Setup](#frontend-setup)
  - [Telegram Bot Setup](#telegram-bot-setup)
- [Usage](#-usage)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Contributing](#-contributing)
- [Roadmap](#-roadmap)
- [Known Issues](#-known-issues)
- [License](#-license)
- [Acknowledgments](#-acknowledgments)

---

## 🎯 About

SwapSmith is a next-generation crypto trading assistant that understands natural language. Simply describe what you want to do, and SwapSmith handles the complex cross-chain logic for you.

> **Example:** *"Swap 0.5 ETH on Ethereum for USDC on Polygon"*

No more navigating complicated DEX interfaces or managing multiple bridges manually!

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🗣️ **Natural Language Interface** | Describe swaps in plain English - no technical knowledge required |
| 🔗 **Cross-Chain Swaps** | Seamlessly swap between **200+ assets** across **40+ blockchains** |
| 🎤 **Voice Input** | Use your microphone to command the agent (Experimental) |
| 🤖 **Telegram Bot** | Execute swaps directly from Telegram |
| 🌐 **Web Interface** | Beautiful, responsive web app with wallet integration |
| 🔒 **Non-Custodial** | Your keys, your crypto - transactions require your explicit confirmation |
| 📊 **Real-Time Quotes** | Always get the best available rates via SideShift.ai |
| 📈 **Yield Scout** | Discover top stablecoin yield opportunities |

---

## 🎬 Demo

### Web Interface
```
🌐 https://swap-smith.vercel.app/
```

### Example Commands

```text
"Swap 0.1 ETH for BTC"
"Convert 100 USDC on Arbitrum to MATIC on Polygon"
"I need $50 worth of AVAX"
"Show me the best stablecoin yields"
"Create a payment link for 50 USDC"
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         SwapSmith                                │
├─────────────────────────────┬───────────────────────────────────┤
│      Frontend (Next.js)     │      Telegram Bot (Node.js)       │
│  • Web3 Wallet Connection   │  • Voice Message Support          │
│  • Chat Interface           │  • Natural Language Processing    │
│  • Transaction Signing      │  • Order Management               │
└──────────────┬──────────────┴──────────────┬────────────────────┘
               │                              │
               ▼                              ▼
        ┌──────────────┐              ┌──────────────┐
        │   Groq AI    │              │  Neon DB     │
        │  (LLM Parse) │              │  (Postgres)  │
        └──────────────┘              └──────────────┘
               │                              │
               └──────────────┬───────────────┘
                              ▼
                    ┌──────────────────┐
                    │  SideShift.ai    │
                    │  (Swap Engine)   │
                    └──────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18 or higher
- **npm** or **yarn**
- **Git**

### Frontend Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/GauravKarakoti/SwapSmith.git
   cd SwapSmith
   ```

2. **Install frontend dependencies**
   ```bash
   cd frontend
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your keys:
   ```env
   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_id
   GROQ_API_KEY=your_groq_api_key
   NEXT_PUBLIC_SIDESHIFT_API_KEY=your_sideshift_key  # Optional
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   ```
   http://localhost:3000
   ```

### Telegram Bot Setup

1. **Navigate to bot directory**
   ```bash
   cd bot
   npm install
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add:
   ```env
   BOT_TOKEN=your_telegram_bot_token
   GROQ_API_KEY=your_groq_api_key
   DATABASE_URL=your_neon_database_url
   WALLETCONNECT_PROJECT_ID=your_walletconnect_id
   MINI_APP_URL=https://swapsmithminiapp.netlify.app/
   ```

3. **Set up the database**
   ```bash
   npm run db:push
   ```

4. **Start the bot**
   ```bash
   npm run dev
   ```

---

## 💡 Usage

### Web App

1. **Connect Wallet** - Click "Connect Wallet" and select your provider (MetaMask, WalletConnect, etc.)
2. **Enter Command** - Type your swap request in natural language
3. **Review Quote** - Check the parsed intent and live quote from SideShift
4. **Confirm** - Sign the transaction in your wallet
5. **Track** - Monitor the swap status in real-time

### Telegram Bot

1. **Start** - Send `/start` to the bot
2. **Swap** - Type commands like `swap 0.1 ETH to USDC on polygon`
3. **Provide Address** - Enter your destination wallet address
4. **Confirm** - Click "Yes" to create the order
5. **Sign** - Use the Mini App to sign the transaction

### Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message and instructions |
| `/history` | View your last 10 orders |
| `/status [id]` | Check order status |
| `/checkouts` | View your payment links |
| `/clear` | Reset conversation state |
| `/website` | Open the web interface |

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| Next.js 16 | React Framework |
| TypeScript | Type Safety |
| Tailwind CSS | Styling |
| Wagmi + Viem | Web3 Integration |
| TanStack Query | Data Fetching |

### Telegram Bot
| Technology | Purpose |
|------------|---------|
| Node.js | Runtime |
| TypeScript | Type Safety |
| Telegraf | Telegram Bot Framework |
| Drizzle ORM | Database ORM |
| Neon | Serverless Postgres |

### APIs & Services
| Service | Purpose |
|---------|---------|
| SideShift.ai | Cross-chain swap execution |
| Groq | LLM for natural language parsing |
| WalletConnect | Wallet connection |

---

## 📁 Project Structure

```
SwapSmith/
├── frontend/                # Next.js web application
│   ├── app/                 # App router pages
│   ├── components/          # React components
│   ├── pages/api/           # API routes
│   └── utils/               # Utility functions
│
├── bot/                     # Telegram bot
│   ├── src/
│   │   ├── bot.ts           # Main bot logic
│   │   └── services/        # API clients & database
│   └── drizzle/             # Database migrations
│
├── public/                  # Static assets
├── CONTRIBUTING.md          # Contribution guidelines
├── CODE_OF_CONDUCT.md       # Community guidelines
└── README.md                # You are here!
```

---

## 🤝 Contributing

We love contributions! SwapSmith is open source and we welcome developers of all skill levels.

1. **Fork** the repository
2. **Clone** your fork locally
3. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
4. **Commit** your changes (`git commit -m 'Add amazing feature'`)
5. **Push** to your branch (`git push origin feature/amazing-feature`)
6. **Open** a Pull Request

Please read our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

### Good First Issues

Looking for something to work on? Check out our [open issues](https://github.com/GauravKarakoti/SwapSmith/issues) labeled `good first issue` or `help wanted`.

---

## 🐛 Known Issues

| Issue | Status | Workaround |
|-------|--------|------------|
| Voice input browser compatibility | 🔄 In Progress | Use text input |
| Complex command parsing | 🔄 In Progress | Use simpler commands |

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ for the SideShift.ai Hackathon**

⭐ Star this repo if you find it useful!

[Report Bug](https://github.com/GauravKarakoti/SwapSmith/issues) • [Request Feature](https://github.com/GauravKarakoti/SwapSmith/issues)

</div>
