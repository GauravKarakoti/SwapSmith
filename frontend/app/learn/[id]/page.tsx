'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen,
  Video,
  FileText,
  Award,
  CheckCircle,
  Circle,
  ChevronRight,
  ChevronLeft,
  Play,
  TrendingUp,
  Zap,
  Shield,
  DollarSign,
  Clock,
  Target,
  Lightbulb,
  ArrowLeft,
  LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface LearningModule {
  id: string
  title: string
  description: string
  duration: string
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced'
  category: 'crypto-basics' | 'swapsmith-features' | 'advanced-trading' | 'security'
  icon: LucideIcon
  topics: Topic[]
}

interface Topic {
  id: string
  title: string
  type: 'guide' | 'video' | 'interactive' | 'quiz'
  duration: string
  content?: string
}

// Map topic IDs to their images (only for topics that have images)
const topicImages: Record<string, string> = {
  'what-is-crypto': '/learning/cryptocurrency.webp',
  'blockchain-explained': '/learning/blockchain.png',
  'wallets-explained': '/learning/cryptowallte.jpg',
  // Getting Started with SwapSmith (swapsmith-intro) images
  'platform-overview': '/learning/swapsmith1.png',
  'first-swap': '/learning/swapsmith2.png',
  'chat-interface': '/learning/gettingstartedswapsmithandchatinterface.png',
  'wallet-connection': '/learning/connectwallet.png',
  // Add connectwallet image to each course (as a generic topic image)
  'connect-wallet': '/learning/connectwallet.png',
}

// Map course IDs to their header images
const courseHeaderImages: Record<string, string> = {
  'crypto-101': '/learning/cryptocurrency1.webp',
  'swapsmith-intro': '/learning/swapsmith1.png',
}

// ---------------------------------------------------------------------------
// Learning Modules Data
// ---------------------------------------------------------------------------
const learningModules: LearningModule[] = [
  {
    id: 'crypto-101',
    title: 'Cryptocurrency Basics',
    description: 'Learn the fundamental concepts of cryptocurrency, blockchain, and digital assets',
    duration: '30 min',
    difficulty: 'Beginner',
    category: 'crypto-basics',
    icon: DollarSign,
    topics: [
      {
        id: 'what-is-crypto',
        title: 'What is Cryptocurrency?',
        type: 'guide',
        duration: '5 min',
        content: `Cryptocurrency is a digital or virtual form of money that uses cryptography for security. Unlike traditional currencies issued by governments (fiat money), cryptocurrencies operate on decentralized networks based on blockchain technology.

Key Characteristics:
• Decentralized: Not controlled by any central authority like a bank or government
• Secure: Uses advanced cryptographic techniques to secure transactions
• Transparent: All transactions are recorded on a public ledger (blockchain)
• Global: Can be sent anywhere in the world instantly, 24/7
• Limited Supply: Most cryptocurrencies have a maximum supply cap

Popular Cryptocurrencies:
1. Bitcoin (BTC) - The first and most well-known cryptocurrency, created in 2009
2. Ethereum (ETH) - A platform for smart contracts and decentralized applications
3. USDT/USDC - Stablecoins pegged to the US Dollar for price stability
4. And thousands more with different use cases and features

Why Cryptocurrency Matters:
Cryptocurrencies enable peer-to-peer transactions without intermediaries, giving you full control over your money. They offer faster international transfers, lower fees, and financial inclusion for the unbanked. Understanding cryptocurrency is the first step to using SwapSmith effectively for trading and swapping digital assets.`
      },
      {
        id: 'blockchain-explained',
        title: 'Understanding Blockchain',
        type: 'guide',
        duration: '7 min',
        content: `Blockchain is the revolutionary technology that powers cryptocurrencies. Think of it as a digital ledger that everyone can see, but no one can cheat.

How Blockchain Works:
1. Blocks: Transactions are grouped together into blocks
2. Chain: Each block is linked to the previous one, forming a chain
3. Verification: Network participants (miners/validators) verify each block
4. Immutability: Once added, blocks cannot be changed or deleted

Key Components:
• Distributed Ledger: Every participant has a copy of the entire blockchain
• Consensus Mechanism: Rules that ensure all participants agree on the blockchain state
• Cryptographic Hashing: Each block has a unique fingerprint that links it to the previous block
• Nodes: Computers that maintain and validate the blockchain network

Why Blockchain Matters:
✓ Trust Without Intermediaries: No need for banks or third parties
✓ Security: Extremely difficult to hack or manipulate
✓ Transparency: All transactions are publicly verifiable
✓ Efficiency: Faster settlement times compared to traditional systems

Real-World Applications:
- Cryptocurrency transactions (Bitcoin, Ethereum)
- Smart contracts and DeFi (Decentralized Finance)
- Supply chain tracking
- Digital identity verification
- NFTs (Non-Fungible Tokens)

This technology powers all cryptocurrencies you can swap on SwapSmith, ensuring secure and transparent transactions every time.`
      },
      {
        id: 'wallets-explained',
        title: 'Cryptocurrency Wallets',
        type: 'guide',
        duration: '8 min',
        content: `A cryptocurrency wallet is a tool that allows you to store, send, and receive cryptocurrency. Think of it as your digital bank account, but you're the bank!

Types of Wallets:

1. Hot Wallets (Connected to Internet)
   • MetaMask - Popular browser extension wallet
   • Trust Wallet - Mobile app with multi-chain support
   • Coinbase Wallet - User-friendly mobile wallet
   • Pros: Convenient, easy to use, quick access
   • Cons: More vulnerable to hacks

2. Cold Wallets (Offline Storage)
   • Hardware Wallets - Physical devices (Ledger, Trezor)
   • Paper Wallets - Private keys printed on paper
   • Pros: Maximum security, immune to online hacks
   • Cons: Less convenient, can be lost or damaged

Important Wallet Concepts:
• Public Address: Like your account number - safe to share with others
• Private Key: Like your password - NEVER share this with anyone!
• Seed Phrase: 12-24 words that can recover your wallet - keep it extremely safe
• Gas Fees: Transaction costs paid to the network

Wallet Security Best Practices:
✓ Always backup your seed phrase in multiple secure locations
✓ Never share your private key or seed phrase with anyone
✓ Use hardware wallets for large amounts
✓ Enable 2FA (Two-Factor Authentication) when available
✓ Double-check addresses before sending crypto
✓ Beware of phishing scams and fake wallet apps

Using Wallets with SwapSmith:
Connect your wallet (like MetaMask) to SwapSmith to start swapping cryptocurrencies. SwapSmith supports multiple wallet types including MetaMask, WalletConnect, and more. Your funds always remain in your control - SwapSmith never holds your crypto!

Pro Tip: Start with a hot wallet for small amounts to learn, then graduate to a hardware wallet for larger holdings.`
      },
      {
        id: 'crypto-quiz-1',
        title: 'Test Your Crypto Knowledge',
        type: 'quiz',
        duration: '10 min',
      },
    ],
  },
  {
    id: 'swapsmith-intro',
    title: 'Getting Started with SwapSmith',
    description: 'Master the basics of using SwapSmith for cryptocurrency swaps',
    duration: '25 min',
    difficulty: 'Beginner',
    category: 'swapsmith-features',
    icon: Zap,
    topics: [
      {
        id: 'platform-overview',
        title: 'Platform Overview',
        type: 'guide',
        duration: '5 min',
        content: `Welcome to SwapSmith - your intelligent cryptocurrency swap platform that makes exchanging digital assets simple, secure, and efficient.

What Makes SwapSmith Special:

🤖 AI-Powered Assistant
• Chat with our AI to execute swaps using natural language
• Ask questions about cryptocurrencies and get instant answers
• Get personalized recommendations based on market conditions
• Voice commands for hands-free trading (coming soon!)

💱 Smart Swap Engine
• Compare rates across multiple exchanges automatically
• Get the best price for your swaps every time
• Support for 100+ cryptocurrencies
• Low fees with transparent pricing

📈 Real-Time Analytics
• Live price tracking and interactive charts
• Historical data and market trends
• Portfolio performance insights
• Custom price alerts and notifications

🔒 Security First
• Non-custodial (you always control your funds)
• Secure wallet integration
• No KYC required for basic swaps
• Transparent fee structure

Key Features:
1. Terminal Mode - Advanced trading interface for power users
2. Live Prices - Real-time cryptocurrency price tracking
3. Discussions - Community forum to learn and share
4. DCA (Dollar Cost Averaging) - Automated recurring swaps

Ready to start swapping? Let's dive in and explore how to make your first trade!`
      },
      {
        id: 'first-swap',
        title: 'Making Your First Swap',
        type: 'interactive',
        duration: '10 min',
        content: `Follow these simple steps to execute your first cryptocurrency swap on SwapSmith. Don't worry - we'll guide you through every step!

Step 1: Connect Your Wallet
1. Click the "Connect Wallet" button in the top navigation
2. Select your wallet provider (MetaMask, WalletConnect, etc.)
3. Approve the connection request in your wallet
4. Your wallet address will appear once connected

Step 2: Choose Your Swap Pair
1. Select the cryptocurrency you want to swap FROM
2. Select the cryptocurrency you want to receive (TO)
3. Enter the amount you wish to swap
4. SwapSmith will automatically calculate the exchange rate

Step 3: Review the Swap Details
SwapSmith will show you:
• Exchange rate (how much you'll receive)
• Network fees (gas costs)
• SwapSmith service fee (transparent pricing)
• Estimated completion time
• Total amount you'll receive

Step 4: Execute the Swap
1. Click "Swap Now" or use the AI chat: "Swap [amount] [from] to [to]"
2. Review the confirmation details carefully
3. Approve the transaction in your wallet
4. Wait for blockchain confirmation (usually 30 seconds - 5 minutes)

Step 5: Track Your Swap
• View real-time status updates on the screen
• Check transaction history in your profile
• Receive completion notification
• Verify the tokens arrived in your wallet

Pro Tips for Beginners:
✓ Start with small amounts to get comfortable
✓ Check network fees during low-traffic times to save money
✓ Use the AI assistant if you have questions
✓ Enable price alerts for better timing
✓ Double-check the receiving address

Common Questions:
Q: How long does a swap take?
A: Most swaps complete in 30 seconds to 5 minutes, depending on network congestion.

Q: Can I cancel a swap?
A: Once submitted to the blockchain, swaps cannot be cancelled. Always double-check before confirming!

Q: What if something goes wrong?
A: Contact our support team immediately. We're here to help 24/7.`
      },
      {
        id: 'wallet-connection',
        title: 'Connecting Your Wallet',
        type: 'guide',
        duration: '5 min',
        content: `Learning how to securely connect your wallet to SwapSmith is essential for trading. Follow this guide to get started safely.

Supported Wallets:
• MetaMask - Most popular browser extension wallet
• WalletConnect - Connect mobile wallets via QR code
• Coinbase Wallet - Easy-to-use mobile wallet
• Trust Wallet - Multi-chain mobile wallet
• Hardware Wallets - Ledger and Trezor support

How to Connect MetaMask (Most Common):

1. Install MetaMask
   • Visit metamask.io (verify the URL!)
   • Download the browser extension
   • Create a new wallet or import existing one
   • Save your seed phrase securely

2. Connect to SwapSmith
   • Click "Connect Wallet" button
   • Select "MetaMask" from the options
   • Approve the connection request
   • Your address will appear in the top right

3. Select Network
   • Choose the blockchain network (Ethereum, Polygon, BSC, etc.)
   • MetaMask will prompt you to switch networks if needed
   • Different networks have different fees

Using WalletConnect (For Mobile Wallets):

1. Click "Connect Wallet" on SwapSmith
2. Select "WalletConnect"
3. Scan the QR code with your mobile wallet app
4. Approve the connection on your phone
5. Start trading on desktop while wallet stays on mobile

Security Best Practices:

⚠️ NEVER share your:
• Private key
• Seed phrase (12-24 words)
• Password

Always verify:
✓ You're on the real SwapSmith website
✓ The connection request is legitimate
✓ The network and address are correct
✓ Transaction details before approving

Troubleshooting:

Problem: Wallet won't connect
Solution: Refresh page, try different browser, or restart wallet extension

Problem: Wrong network
Solution: Switch networks in your wallet settings

Problem: Transaction stuck
Solution: Try increasing gas fee or wait for network to clear

Disconnecting Your Wallet:
• Click your address in top right corner
• Select "Disconnect"
• Or disconnect from within your wallet app

Remember: SwapSmith is non-custodial, meaning we never hold your funds. Your wallet stays in your control at all times!`
      },
      {
        id: 'chat-interface',
        title: 'Using the AI Chat Interface',
        type: 'video',
        duration: '5 min',
        content: `SwapSmith's AI-powered chat interface makes crypto swapping as easy as having a conversation. No complex forms or confusing menus!

What You Can Do with AI Chat:

💬 Execute Swaps
Simply tell the AI what you want:
• "Swap 0.1 ETH to USDT"
• "Exchange 100 USDT for BTC"
• "Convert all my DAI to USDC"
• "Buy $500 worth of ETH"

The AI understands natural language, so speak normally!

📈 Get Price Information
Ask about any cryptocurrency:
• "What's the current price of Bitcoin?"
• "Show me ETH price chart"
• "Compare BTC and ETH prices"
• "Is Ethereum going up or down?"

🎯 Ask Questions
Get instant help on anything:
• "What is gas fee?"
• "How does DCA work?"
• "Explain liquidity pools"
• "What's the difference between ETH and BTC?"

⚙️ Manage Settings
Control your preferences:
• "Enable price alerts for ETH"
• "Set up DCA for $100 weekly"
• "Show my transaction history"
• "What's my portfolio value?"

Tips for Best Results:

1. Be Specific
   ✗ Bad: "I want Ethereum"
   ✓ Good: "Swap 50 USDT to ETH"

2. Use Common Symbols
   ✓ BTC, ETH, USDT (better than full names)
   ✓ "Bitcoin" also works

3. Confirm Amounts
   • Always double-check numbers before confirming
   • The AI will ask for confirmation on swaps

4. Ask for Clarification
   • "Explain that again"
   • "What do you mean by gas fee?"
   • Don't hesitate to ask follow-up questions!

Sample Conversations:

Example 1 - Simple Swap:
You: "Swap 100 USDT to ETH"
AI: "I'll swap 100 USDT to ETH. Current rate is 1 ETH = $3,000. You'll receive approximately 0.033 ETH. Confirm?"
You: "Yes"
AI: "Swap initiated! Transaction: 0x123..."

Example 2 - Price Check:
You: "What's the price of Bitcoin?"
AI: "Bitcoin (BTC) is currently trading at $65,432.10 USD. Up 2.3% in the last 24 hours."

Example 3 - Learning:
You: "What's slippage?"
AI: "Slippage is the difference between the expected price and the actual execution price. It happens when market prices change during your transaction..."

Advanced Features:

🎯 Multi-step Commands
"Swap 100 USDT to ETH, then set a price alert when ETH reaches $3,500"

🔊 Voice Input (Coming Soon!)
Speak your commands for hands-free trading

📊 Portfolio Analysis
"Analyze my portfolio and suggest improvements"

Safety Tips:
⚠️ The AI will NEVER:
• Ask for your private key or seed phrase
• Request you send crypto to unknown addresses
• Pressure you to make trades

Always verify swap details before confirming. The AI is here to assist, but you're always in control!`
      },
    ],
  },
  {
    id: 'advanced-features',
    title: 'Advanced SwapSmith Features',
    description: 'Master advanced trading features like DCA, price alerts, and terminal mode',
    duration: '40 min',
    difficulty: 'Intermediate',
    category: 'swapsmith-features',
    icon: TrendingUp,
    topics: [
      {
        id: 'terminal-mode',
        title: 'Professional Terminal Mode',
        type: 'guide',
        duration: '10 min',
        content: `Terminal Mode is SwapSmith's advanced interface designed for experienced traders who want maximum control and efficiency. It's like having a professional trading desk at your fingertips.

Why Use Terminal Mode?

⚡ Speed
• Execute trades with keyboard shortcuts
• No clicking through menus
• Batch operations support
• Lightning-fast order placement

📈 Advanced Analytics
• Real-time order book visualization
• Technical indicators (RSI, MACD, Moving Averages)
• Market depth analysis
• Volume and liquidity metrics
• Multiple chart layouts

🛠️ Professional Tools
• Price alerts with custom conditions
• Historical data export (CSV, JSON)
• API access for integrations
• Custom notification rules
• Watchlists and favorites

Getting Started:

1. Navigate to Terminal
   • Click "Terminal" in the main navigation
   • Or press Ctrl+T (Cmd+T on Mac)

2. Familiarize with the Layout
   Left: Order book and recent trades
   Center: Price charts with indicators
   Right: Your orders and positions
   Bottom: Command line interface

3. Learn Basic Commands
   • swap [amount] [from] to [to]
   • price [symbol]
   • chart [symbol] [timeframe]
   • alert [symbol] [condition] [price]
   • history

Keyboard Shortcuts:

Essential Shortcuts:
• S - Quick swap dialog
• P - Price check
• H - View history
• A - Set alert
• Esc - Close dialogs
• Tab - Switch between panels
• / - Focus command line

Example Commands:

// Execute a swap
swap 0.5 ETH to USDT

// Check multiple prices
price BTC ETH SOL

// Set price alert
alert ETH > 3000

// View recent swaps
history last 10

// Export transaction data
export history csv

Advanced Features:

🔄 Multi-Swap Operations
Execute multiple swaps simultaneously:

batch swap
  0.5 ETH to USDT
  100 USDT to BTC
  0.01 BTC to SOL
end

📊 Technical Analysis
• Add indicators: RSI, MACD, Bollinger Bands
• Multiple timeframes: 1m, 5m, 15m, 1h, 4h, 1d
• Drawing tools: trendlines, support/resistance

🔔 Smart Alerts
Set complex conditions:

alert BTC > 70000 AND volume > 1000
alert ETH crosses MA(50)
alert portfolio_value > 10000

Customization:

• Choose color themes (dark, light, matrix)
• Arrange panels to your preference
• Save workspace layouts
• Custom keyboard shortcuts
• Font size and spacing

Pro Tips:

✓ Use watchlists to track favorite pairs
✓ Set up a dedicated monitor for terminal mode
✓ Learn keyboard shortcuts to save time
✓ Start with demo mode to practice
✓ Join our Discord for terminal tips from pros

Safety Reminders:

⚠️ Terminal mode gives you power - use it wisely!
• Double-check command syntax
• Start with small amounts
• Use test mode for new strategies
• Set up fail-safes and stop losses

Ready to trade like a pro? Terminal mode awaits!`
      },
      {
        id: 'dca-strategy',
        title: 'Dollar-Cost Averaging (DCA)',
        type: 'guide',
        duration: '12 min',
        content: `Dollar-Cost Averaging (DCA) is a proven investment strategy that removes emotion from crypto investing. Perfect for beginners and experienced investors alike!

What is DCA?

DCA means investing a fixed amount of money at regular intervals, regardless of the asset's price. Instead of trying to "time the market," you buy consistently over time.

Example:
Instead of investing $1,200 in Bitcoin all at once, you invest $100 every week for 12 weeks. This averages out the price fluctuations.

Why DCA Works:

✅ Reduces Risk
• Smooths out price volatility
• Avoids buying everything at the peak
• Less stressful than trying to time the market

✅ Removes Emotion
• No panic buying or selling
• Automated - set it and forget it
• Consistent discipline

✅ Time in Market > Timing the Market
• Long-term wealth building
• Compound your investments
• Benefit from market dips

✅ Perfect for Beginners
• No complex analysis needed
• Easy to understand and execute
• Lower barrier to entry

DCA vs. Lump Sum:

Lump Sum Investing:
• Invest $1,200 today
• If price is $30k, you get 0.04 BTC
• Risk: What if price crashes tomorrow?

DCA Investing:
• Week 1: $100 at $30k = 0.00333 BTC
• Week 2: $100 at $28k = 0.00357 BTC (bonus!)
• Week 3: $100 at $32k = 0.00312 BTC
• Average price: $30k, but less risk

Setting Up DCA on SwapSmith:

1. Navigate to Your Profile
   Click your profile icon > "DCA Settings"

2. Create New DCA Plan
   • Choose cryptocurrency to accumulate (e.g., BTC, ETH)
   • Select funding source (USDT, USDC, etc.)
   • Set investment amount per cycle

3. Choose Frequency
   • Daily - Best for very active investors
   • Weekly - Most popular option
   • Bi-weekly - Align with paychecks
   • Monthly - Set it and forget it

4. Set Duration
   • Ongoing (until you stop it)
   • Fixed period (e.g., 1 year)
   • Until target amount reached

5. Review and Activate
   • Check summary and fees
   • Ensure wallet has sufficient balance
   • Activate your DCA plan
   • Receive confirmation email

DCA Best Practices:

💵 Amount
• Start with what you can afford to lose
• Only invest disposable income
• $50-$200 per cycle is common
• Increase as you get comfortable

📅 Frequency
• Weekly is most popular
• Match your paycheck schedule
• More frequent = smoother averaging
• Less frequent = lower fees

⏰ Timing
• Pick a consistent day/time
• Avoid major news events if possible
• Some prefer Sunday evenings (lower activity)

📈 Strategy
• Hold for long-term (1+ years)
• Don't panic sell during dips
• Consider taking profits at targets
• Reinvest gains for compound growth

Common DCA Strategies:

1. Simple DCA
   Same amount, same frequency, forever
   Example: $100 of BTC every Monday

2. Tiered DCA
   Increase amount during dips
   Example: $100 normally, $200 if price drops 10%

3. Ladder DCA
   Split across multiple coins
   Example: $50 BTC + $50 ETH weekly

4. Value DCA
   Adjust amount based on price
   Invest more when prices are low

Monitoring Your DCA:

• Check SwapSmith dashboard for stats
• Track average purchase price
• View total accumulated amount
• Monitor portfolio performance
• Receive weekly summary emails

When to Modify DCA:

✓ Increase amount: When income rises
✓ Decrease amount: If budget tightens
✓ Pause: During major life events
✓ Stop: When you reach your goal

Real Example:

John's DCA Journey:
• Started: January 2024
• Amount: $100/week into ETH
• Duration: 1 year (52 weeks)
• Total invested: $5,200
• Average price: $2,400
• ETH accumulated: 2.17 ETH
• Current value: $6,500 (25% gain!)

Remember: DCA is a marathon, not a sprint. Consistency and patience are key to building long-term wealth in crypto!`
      },
      {
        id: 'price-alerts',
        title: 'Setting Up Price Alerts',
        type: 'guide',
        duration: '8 min',
        content: `Never miss a trading opportunity! SwapSmith's price alert system keeps you informed of market movements so you can act fast.

Why Use Price Alerts?

⏰ Perfect Timing
• Get notified when prices hit your targets
• Don't need to watch charts 24/7
• Act on opportunities immediately
• Set buy/sell triggers

📢 Stay Informed
• Track multiple cryptocurrencies
• Monitor market volatility
• Catch trend reversals
• Follow your portfolio

Types of Alerts:

1. 📈 Price Alerts
   Get notified when price crosses a threshold
   • "Alert me when BTC > $70,000"
   • "Alert me when ETH < $2,500"
   • "Alert me when SOL between $100-$150"

2. 📉 Percent Change Alerts
   Track percentage movements
   • "Alert when BTC moves +5% in 24h"
   • "Alert when ETH drops -10%"
   • "Alert on any +20% pump"

3. 📊 Volume Alerts
   Monitor trading activity
   • "Alert when BTC volume > 1B"
   • "Alert on unusual volume spikes"

4. 🎯 Portfolio Alerts
   Track your total value
   • "Alert when portfolio > $10,000"
   • "Alert if portfolio drops 5%"

Setting Up Alerts:

Method 1: Through Price Charts
1. Go to Live Prices page
2. Click on any cryptocurrency
3. Click the bell icon 🔔
4. Set your alert conditions
5. Choose notification method
6. Save alert

Method 2: Using AI Chat
Just ask the AI:
• "Set alert when Bitcoin reaches $70k"
• "Notify me if Ethereum drops below $2500"
• "Alert me when SOL pumps 10%"

Method 3: Terminal Mode
Use commands:

alert BTC > 70000
alert ETH < 2500
alert SOL change > 10%

Notification Options:

📧 Email
• Detailed message with chart
• Best for non-urgent alerts
• Keep permanent record

📱 Push Notifications
• Instant mobile alerts
• Quick glance updates
• Most popular option

🔔 Browser Notifications
• Desktop alerts
• While on SwapSmith
• Requires permission

📢 Telegram/Discord
• Connect your account
• Share with community
• Advanced users

Smart Alert Strategies:

1. 🎯 Support/Resistance Levels
   
   BTC Support: $60,000
   Alert if price < $60,000 (might drop more)
   
   BTC Resistance: $72,000
   Alert if price > $72,000 (might pump)

2. 📉 Buy the Dip
   
   Alert: ETH drops -15% in 24h
   Action: Consider buying the dip

3. 📈 Take Profit
   
   Alert: Portfolio value > $20,000
   Action: Consider taking some profits

4. ⚠️ Stop Loss
   
   Alert: Position drops -10%
   Action: Review and possibly exit

Example Alert Setup:

Scenario: You want to buy ETH if it dips

Current ETH price: $3,000

Alerts to set:
1. Alert if ETH < $2,800 (7% dip - small buy)
2. Alert if ETH < $2,700 (10% dip - bigger buy)
3. Alert if ETH < $2,500 (17% dip - major buy)
4. Alert if ETH > $3,200 (missed the dip)

Managing Your Alerts:

View All Alerts:
• Profile > "My Alerts"
• See active, triggered, and paused alerts
• Edit or delete anytime

Alert History:
• Review past alerts
• See accuracy and timing
• Learn from patterns

Pause Alerts:
• Going on vacation?
• Pause all alerts temporarily
• Resume when ready

Best Practices:

✓ Don't set too many alerts
  • Quality over quantity
  • 5-10 alerts is manageable
  • 100 alerts = notification fatigue

✓ Use realistic targets
  • Based on analysis, not wishes
  • Consider market conditions
  • Research support/resistance

✓ Combine with strategy
  • Have a plan when alert triggers
  • Don't just react emotionally
  • Pre-decide your actions

✓ Test notification channels
  • Ensure you receive alerts
  • Check spam/junk folders
  • Test before relying on them

Advanced Alert Combinations:

Multi-Condition Alerts:

Alert when:
  BTC > $70,000 AND
  Volume > 1B AND
  24h change > +5%
= Strong bullish signal!

Cross-Asset Alerts:

Alert when:
  BTC/ETH ratio > 20
= ETH might be undervalued

Technical Indicator Alerts:

Alert when:
  BTC RSI < 30 (oversold)
= Potential buy opportunity

Pro Tips:

🔥 Set alerts for both directions
  Track upside AND downside moves

📅 Review alerts weekly
  Remove outdated ones
  Add new ones based on market

📊 Use alert analytics
  Track which alerts are most useful
  Refine your strategy over time

Common Mistakes to Avoid:

❌ Too tight alerts
  Price moves 0.1% and you get spammed

❌ Forgetting to act
  Alert triggers, you ignore it
  What's the point?

❌ Alert fatigue
  Too many alerts = you ignore all

✅ Solution: Set meaningful, actionable alerts

Stay ahead of the market with smart price alerts. Set them up now and trade with confidence!`
      },
      {
        id: 'analytics-dashboard',
        title: 'Understanding Analytics',
        type: 'guide',
        duration: '10 min',
        content: `SwapSmith's analytics dashboard gives you powerful insights into your trading performance. Make data-driven decisions and improve your strategy!

Why Analytics Matter:

📈 Track Performance
• See how your portfolio is growing
• Identify winning and losing trades
• Calculate your returns (ROI)
• Compare against benchmarks

🧠 Make Better Decisions
• Spot patterns in your trading
• Learn from mistakes
• Optimize your strategy
• Reduce emotional trading

Dashboard Overview:

Access Analytics:
• Profile > "Analytics Dashboard"
• Or click the chart icon in navigation

Key Sections:

1. 📊 Portfolio Overview
   • Total portfolio value
   • 24h change ($ and %)
   • All-time high/low
   • Asset allocation pie chart

2. 📈 Performance Metrics
   • Total return (ROI)
   • Win rate percentage
   • Average trade size
   • Best/worst performing assets

3. 📉 Trade History
   • All your swaps listed
   • Profit/loss per trade
   • Fees paid over time
   • Export to CSV

4. 📊 Charts & Graphs
   • Portfolio value over time
   • Asset allocation changes
   • Trading volume by day
   • Profit/loss trends

Key Metrics Explained:

Total Return (ROI):

ROI = (Current Value - Initial Investment) / Initial Investment × 100

Example:
Invested: $1,000
Current: $1,500
ROI = ($1,500 - $1,000) / $1,000 × 100 = 50%

Win Rate:

Win Rate = (Profitable Trades / Total Trades) × 100

Example:
Total trades: 20
Profitable: 14
Win Rate = 14/20 × 100 = 70%

Average Trade Size:

Avg = Total Trading Volume / Number of Trades

Example:
Total volume: $5,000
Trades: 10
Average = $5,000 / 10 = $500 per trade

Sharpe Ratio:

Measures risk-adjusted returns
Higher = Better risk/reward balance
> 1.0 = Good
> 2.0 = Very good
> 3.0 = Excellent

Using Analytics to Improve:

🔍 Identify Patterns

Question: When do you trade best?
• Look at time-of-day patterns
• Day-of-week analysis
• Market condition correlations

Example Discovery:
"I notice my best trades happen on Monday mornings when I'm fresh and focused."

🎯 Asset Performance

Question: Which assets perform best for you?
• Sort by ROI
• Compare hold times
• Identify your strengths

Example Discovery:
"I'm better at trading ETH than BTC. Maybe I should focus there."

💸 Fee Analysis

Question: Are fees eating your profits?
• Total fees paid
• Average fee per trade
• Fee as % of profit

Example Discovery:
"I'm paying $50 in fees monthly. I should batch smaller trades."

📅 Timing Analysis

Question: When should you trade?
• Success rate by time period
• Market volatility correlation
• Volume patterns

Example Discovery:
"Trades during high volatility have lower success rate. I should wait for stability."

Advanced Analytics Features:

1. 🔬 Compare Strategies
   • DCA vs. Lump sum
   • Different holding periods
   • Various asset mixes

2. 📈 Benchmark Comparison
   • Your returns vs. BTC
   • Your returns vs. ETH
   • Your returns vs. market average

3. 📊 Portfolio Simulation
   • What if scenarios
   • Backtesting strategies
   • Risk modeling

4. 📅 Custom Reports
   • Monthly performance summaries
   • Tax reporting data
   • Detailed trade logs

Reading Your Dashboard:

Green Numbers = Good
• Positive returns
• Portfolio growing
• Above benchmarks

Red Numbers = Needs Attention
• Losses or drawdowns
• Below expectations
• Time to review strategy

Gray Numbers = Neutral
• Breaking even
• Market-matching returns
• Consider optimization

Actionable Insights:

The analytics dashboard provides suggestions:

✨ "Your ETH trades have 80% win rate. Consider increasing allocation."

⚠️ "You've paid $200 in fees this month. Consider larger, less frequent trades."

📈 "Your portfolio is up 15% vs. market's 10%. Great job!"

📉 "You tend to sell winners too early. Consider longer hold times."

Exporting Data:

For Tax/Records:
• Export all trades to CSV
• Filter by date range
• Include fees and gas costs
• Share with accountant

For Analysis:
• Export to Excel/Google Sheets
• Create custom charts
• Deeper statistical analysis
• Build trading journal

Setting Goals:

Use analytics to set realistic goals:

🎯 Monthly Return Target
"Based on my 3-month average of 5%, I'll aim for 6% this month."

🎯 Win Rate Goal
"My win rate is 60%. I'll study and aim for 65%."

🎯 Portfolio Size
"Growing at $500/month. Goal: $20k by year end."

Best Practices:

✓ Review analytics weekly
  • Monday mornings work well
  • Fresh week, fresh perspective

✓ Keep a trading journal
  • Note why you made each trade
  • Review alongside analytics
  • Learn from patterns

✓ Set up automated reports
  • Weekly email summaries
  • Monthly performance reviews
  • Quarterly strategy assessments

✓ Share with accountability partner
  • Discuss your stats
  • Get outside perspective
  • Stay motivated

Common Mistakes:

❌ Ignoring the data
  "I feel like I'm doing well"
  → Check the numbers!

❌ Over-optimizing
  Too much analysis, not enough action
  Balance is key

❌ Cherry-picking data
  Only looking at wins
  → Face your losses too

❌ Not acting on insights
  See the problem, don't fix it
  → Use analytics to improve!

Remember: What gets measured gets managed. Use analytics to become a better trader!`
      },
    ],
  },
  {
    id: 'security-best-practices',
    title: 'Security Best Practices',
    description: 'Learn how to keep your crypto safe from scams, hacks, and common security threats',
    duration: '35 min',
    difficulty: 'Intermediate',
    category: 'security',
    icon: Shield,
    topics: [
      {
        id: 'wallet-security',
        title: 'Securing Your Wallet',
        type: 'guide',
        duration: '12 min',
        content: `Your wallet security is paramount in crypto. Unlike banks that can reverse fraud, crypto transactions are irreversible. Follow these essential security practices to protect your assets.

The Golden Rules:

1️⃣ NEVER Share Your Seed Phrase
• Not with support staff
• Not with family or friends
• Not with anyone, ever!
• SwapSmith will NEVER ask for it

2️⃣ NEVER Share Your Private Key
• This is your ultimate password
• Anyone with it can steal everything
• Keep it offline and secure

3️⃣ Double-Check All Addresses
• One wrong character = lost funds
• Use copy/paste, never type
• Verify first and last characters

Securing Your Seed Phrase:

Best Practices:
✓ Write it down on paper (not digital!)
✓ Make 2-3 copies
✓ Store in different secure locations
✓ Use a fireproof/waterproof safe
✓ Consider splitting between locations

NEVER:
❌ Save in phone notes
❌ Email to yourself
❌ Store in cloud (Google Drive, etc.)
❌ Take a photo of it
❌ Share with "support" who DM you

Password Security:

Create Strong Passwords:
• Minimum 16 characters
• Mix: uppercase, lowercase, numbers, symbols
• Unique for each exchange/wallet
• Never reuse passwords

Password Manager:
✓ Use: 1Password, Bitwarden, LastPass
✓ Generates strong passwords
✓ Stores encrypted
✓ One master password to remember

2FA (Two-Factor Authentication):

Always Enable 2FA!

Best: Hardware Keys
• YubiKey, Titan Key
• Physical device required
• Most secure option
• ~$50 investment

Good: Authenticator Apps
• Google Authenticator
• Authy (has backup)
• Microsoft Authenticator
• Changes every 30 seconds

AVOID: SMS 2FA
• Can be SIM-swapped
• Less secure
• Better than nothing though

Hardware Wallet Guide:

Why Hardware Wallets?
• Private keys never touch internet
• Immune to computer viruses
• Physical confirmation required
• Best for large amounts ($1,000+)

Popular Options:
1. Ledger Nano X ($150)
   • Bluetooth connectivity
   • Large storage
   • Mobile app

2. Trezor Model T ($200)
   • Touchscreen
   • Open source
   • Many coins supported

3. Ledger Nano S Plus ($80)
   • Budget option
   • No Bluetooth
   • Still very secure

Using Hardware Wallets:
1. Buy ONLY from official website
2. Verify device hasn't been tampered
3. Generate new seed phrase on device
4. Write down seed phrase securely
5. Set strong PIN
6. Test with small amount first

Hot Wallet Security:

If Using MetaMask/Trust Wallet:

✓ Use on dedicated browser profile
✓ Only install from official sources
✓ Keep browser extensions minimal
✓ Lock wallet when not using
✓ Review permissions regularly

Browser Security:
• Use Chrome/Brave/Firefox (updated)
• Install: uBlock Origin (ad blocker)
• Avoid suspicious websites
• Check URL carefully (phishing!)

Device Security:

💻 Computer
✓ Keep OS updated
✓ Use antivirus software
✓ Don't download sketchy files
✓ Consider dedicated "crypto computer"

📱 Phone
✓ Enable face/fingerprint lock
✓ Keep iOS/Android updated
✓ Don't jailbreak/root
✓ Install apps only from official stores

Common Attack Vectors:

1. 🎣 Phishing
   Fake websites that look real
   • Always check URL
   • Bookmark real sites
   • Don't click email links

2. 📧 Email Scams
   "Your wallet is compromised!"
   • Ignore panic emails
   • Verify sender address
   • Don't click links

3. 💬 Discord/Telegram Scams
   Fake "support" DMs you
   • Real support never DMs first
   • Block and report
   • Use official channels only

4. 💰 Fake Giveaways
   "Send 1 ETH, get 2 back!"
   • Too good to be true = scam
   • No legit giveaway asks for crypto first

Best Security Practices:

🛡️ Multi-Wallet Strategy
• Hot wallet: Small amounts for trading
• Cold wallet: Large amounts for hodling
• Exchange: Minimal, only during swaps

Example:
• MetaMask: $500 (active trading)
• Ledger: $10,000 (long-term holds)
• SwapSmith: $0 (swap and withdraw)

🔍 Regular Security Audits
Monthly checklist:
☐ Change important passwords
☐ Review connected apps/sites
☐ Check recent transactions
☐ Update software/firmware
☐ Verify backup locations

📚 Education
• Stay informed on new scams
• Follow security experts
• Join community discussions
• Share knowledge with others

Emergency Procedures:

If You Think You're Compromised:

1. IMMEDIATELY move funds to new wallet
2. Don't wait to investigate
3. Create new wallet with new seed
4. Transfer everything ASAP
5. Then figure out what happened

If You Lost Seed Phrase:
• If wallet still accessible: CREATE NEW WALLET
• Transfer funds to new wallet
• Generate and secure new seed
• Never use compromised wallet again

If Funds Were Stolen:
1. Document everything
2. Report to local authorities
3. Report to exchange if applicable
4. Warn community
5. Learn and move forward

Recovery Planning:

Test Your Backup:
• Create test wallet
• Use seed phrase to restore
• Verify it works
• Do this before you need it!

Inheritance Planning:
• Consider how family can access if you die
• Safe deposit box for seed phrase?
• Trust attorney with instructions?
• Dead man's switch services exist

Remember: In crypto, you are the bank. Security is YOUR responsibility. These practices might seem paranoid, but they protect your future wealth!`
      },
      {
        id: 'swapsmith-security',
        title: 'SwapSmith Security Features',
        type: 'guide',
        duration: '8 min',
        content: `SwapSmith takes security seriously. Learn about our built-in security features and how we protect your assets while giving you full control.

Core Security Principles:

1. 🔒 Non-Custodial
We NEVER hold your crypto:
• Your funds stay in your wallet
• You maintain full control
• We can't access your assets
• No exchange risk

How it works:
• You approve each transaction
• Funds move wallet-to-wallet
• SwapSmith facilitates, doesn't hold
• Your keys, your crypto

2. 🔍 Smart Contract Security
All contracts are:
• Audited by third-party firms
• Open source and verifiable
• Tested extensively
• Updated regularly

Audit Partners:
✓ CertiK
✓ Trail of Bits
✓ OpenZeppelin
✓ Bug bounty program

3. 🔐 Secure Connection
• HTTPS encryption
• SSL certificate
• No man-in-the-middle attacks
• Regular security scans

SwapSmith Security Features:

🛡️ Transaction Preview
Before confirming:
• See exact amounts
• View all fees
• Check destination address
• Estimate gas costs
• Review exchange rate

🔔 Price Protection
• Slippage limits
• Price impact warnings
• Max transaction size alerts
• Front-running protection

⏱️ Transaction Timeout
• Swaps expire if not confirmed
• Prevents stale price execution
• You control deadline

📊 Rate Verification
• Compare multiple sources
• Show best available rate
• Highlight suspicious rates
• Historical rate comparison

Wallet Connection Security:

What SwapSmith CAN Do:
✓ View your public address
✓ Show your token balances
✓ Request transaction signatures
✓ Display transaction history

What SwapSmith CANNOT Do:
❌ Access your private keys
❌ Move funds without permission
❌ See your seed phrase
❌ Make transactions for you

Permission Model:

When you connect wallet:
1. You grant "view" permission
   • See balances
   • Display address
   
2. For each swap, you approve:
   • Specific amount
   • Specific tokens
   • One-time only

3. You can revoke anytime:
   • Disconnect wallet
   • Revoke token approvals
   • Change wallets

Smart Contract Interactions:

Token Approvals:

What happens:
1. You approve SwapSmith to spend X tokens
2. SwapSmith can swap up to X amount
3. Approval persists until revoked

Best practice:
✓ Approve only needed amount
✓ Revoke old approvals periodically
✓ Use: revoke.cash to check approvals

Unlimited Approvals:
⚠️ Some sites ask for "unlimited"
• More convenient (one approval)
• But higher risk if contract hacked
• SwapSmith recommends: limited approvals

Monitoring & Alerts:

📧 Email Notifications
• Large transaction alerts
• New wallet connection
• Unusual activity detection
• Security updates

📱 Push Notifications
• Swap initiated
• Swap completed
• Failed transactions
• Price alerts triggered

📈 Activity Dashboard
• All transactions logged
• IP address tracking
• Device fingerprinting
• Unusual pattern detection

Anti-Phishing Measures:

✓ Official Domain: swapsmith.io
• Bookmark it!
• Check URL every time
• Look for SSL lock icon

✓ Verified Social Media
• Twitter: @SwapSmithOfficial ✓
• Discord: Official server only
• Telegram: Verified group

✓ No Cold DMs
• Support never messages first
• We don't DM on Twitter/Discord
• Report imposters

What SwapSmith Will NEVER Ask:

❌ Your seed phrase
❌ Your private key
❌ Your password
❌ To send crypto to "verify"
❌ To download suspicious software
❌ To click links in unsolicited emails

If someone claiming to be SwapSmith asks for these: IT'S A SCAM!

Reporting Security Issues:

Found a vulnerability?
📧 security@swapsmith.io

Bug Bounty Program:
• Responsible disclosure
• Rewards up to $50,000
• Help make SwapSmith safer

Experienced a scam?
• Report immediately
• We'll investigate
• Warn community if needed

Privacy Practices:

What We Collect:
• Wallet address (public)
• Transaction history (on-chain)
• IP address (for security)
• Device info (anti-fraud)

What We DON'T Collect:
• Personal identity (no KYC for basic use)
• Private keys (never!)
• Seed phrases (impossible)
• More than necessary

Data Protection:
• Encrypted in transit (HTTPS)
• Encrypted at rest
• Regular security audits
• GDPR compliant
• No selling to third parties

Best Practices When Using SwapSmith:

✓ Always verify URL
✓ Use bookmark, not Google search
✓ Enable all available security features
✓ Review transactions before signing
✓ Disconnect wallet when done
✓ Use hardware wallet for large amounts
✓ Keep software updated
✓ Report suspicious activity

Regular Security Updates:

We continuously improve:
• Monthly security patches
• Quarterly audits
• Yearly penetration testing
• Instant critical fixes

Stay informed:
• Read our security blog
• Follow @SwapSmithSecurity
• Join Discord #security channel
• Subscribe to security newsletter

Your Responsibilities:

SwapSmith provides tools, but YOU must:
✓ Secure your wallet
✓ Protect your seed phrase
✓ Verify transactions
✓ Use strong passwords
✓ Enable 2FA
✓ Stay vigilant

Think of SwapSmith as a secure vault. We build the vault, but you must:
1. Keep your combination safe
2. Lock it when you leave
3. Check who you let in

Together, we keep your crypto safe!`
      },
      {
        id: 'common-scams',
        title: 'Recognizing & Avoiding Scams',
        type: 'guide',
        duration: '15 min',
        content: `The crypto space offers incredible opportunities, but also attracts scammers. Learn to protect yourself by recognizing common scams and red flags.

Why Scams Succeed:
• Irreversible transactions
• Anonymity of scammers
• Complexity confuses newcomers
• FOMO (Fear of Missing Out)
• Greed overrides caution

Top 10 Crypto Scams:

1. 🎭 Fake Support Scams

How it works:
• You post question in Discord/Telegram
• "Support" DMs you within seconds
• Asks for seed phrase to "fix" issue
• Or sends you to fake website
• Steals your funds

Red flags:
🚩 DMs from "support"
🚩 Urgency ("fix now or lose funds!")
🚩 Asks for seed phrase/private key
🚩 Poor grammar

How to avoid:
✓ Real support NEVER DMs first
✓ Use official support channels only
✓ NEVER share seed phrase
✓ Verify account is official

2. 🎣 Phishing Websites

How it works:
• Fake site looks identical to real one
• URLslightly different (swapsmlth.com)
• You connect wallet
• Fake site drains your funds

Red flags:
🚩 URL misspellings
🚩 No HTTPS/SSL
🚩 Came from email/ad link
🚩 Asks to "verify" with seed phrase

How to avoid:
✓ Bookmark real sites
✓ Check URL character by character
✓ Look for SSL padlock
✓ Use hardware wallet for approvals
  
Real vs Fake:
✓ swapsmith.io (REAL)
❌ swapsmlth.io (FAKE - missing 'i')
❌ swap-smith.io (FAKE - extra dash)
❌ swapsmith.com (FAKE - wrong TLD)

3. 📈 Pump and Dump Schemes

How it works:
• Group buys unknown token
• Price pumps artificially
• They hype it on social media
• You buy at peak
• They sell, price crashes
• You're left with worthless tokens

Red flags:
🚩 "100x guaranteed!"
🚩 Telegram/Discord pump groups
🚩 Unknown token suddenly trending
🚩 "Buy now before it's too late!"
🚩 Celebrity endorsements (usually fake)

How to avoid:
✓ Research before buying
✓ Avoid "get rich quick" promises
✓ Don't FOMO into unknown tokens
✓ Stick to established projects initially
✓ If it sounds too good to be true, it is

4. 🎁 Fake Giveaways

How it works:
• "Elon Musk is giving away Bitcoin!"
• "Send 1 ETH, get 2 back!"
• You send crypto
• Receive nothing
• Scammer disappears

Red flags:
🚩 Too good to be true offer
🚩 Asks you to send crypto first
🚩 Impersonates celebrity
🚩 Time pressure ("only 100 spots!")
🚩 Unverified social media account

How to avoid:
✓ Legit giveaways NEVER ask for crypto first
✓ Verify social media accounts (blue check)
✓ If unsure, it's a scam
✓ No billionaire is doubling your crypto

5. 💧 Rug Pulls

How it works:
• New project with big promises
• Developers hype it up
• You invest
• Devs drain liquidity/abandon project
• Token becomes worthless

Famous examples:
• Squid Game Token (2021)
• AnubisDAO ($60M stolen)
• Countless small projects

Red flags:
🚩 Anonymous team
🚩 No audit
🚩 Locked liquidity not verified
🚩 Unrealistic promises
🚩 Heavy marketing, no product
🚩 Copy-paste white paper

How to avoid:
✓ Research team background
✓ Check for contract audit
✓ Verify liquidity is locked
✓ Start with established projects
✓ Never invest more than you can lose

6. 💼 Romance/Pig Butchering Scams

How it works:
• Scammer befriends you (dating apps, social media)
• Builds trust over weeks/months
• Introduces you to "amazing crypto opportunity"
• Fake platform shows profits
• You invest more and more
• Can't withdraw
• Scammer disappears

Red flags:
🚩 Online romance, never meet
🚩 Too interested in your finances
🚩 Shares investment "secrets"
🚩 Platform you've never heard of
🚩 Pressures you to invest more

How to avoid:
✓ Be wary of online relationships
✓ Never mix romance and finance
✓ Use only established platforms
✓ If pressured, it's a scam

7. 🎭 Impersonation Scams

How it works:
• Scammer impersonates someone you trust
• Friend's hacked account
• Fake exchange email
• Pretends to be SwapSmith
• Tricks you into sending crypto

Red flags:
🚩 Unusual request from "friend"
🚩 Email from slight misspelling
🚩 Urgency
🚩 Asks to be paid in crypto

How to avoid:
✓ Verify through different channel
✓ Call friend directly
✓ Check email address carefully
✓ SwapSmith never asks for crypto payments

8. 📱 Fake Wallet Apps

How it works:
• Fake app in app store
• Looks like real wallet
• You download and use it
• Steals your seed phrase
• Drains your funds

Red flags:
🚩 Low number of downloads
🚩 Poor reviews
🚩 Recent publish date
🚩 Different developer name

How to avoid:
✓ Download only from official website
✓ Verify developer is legitimate
✓ Check reviews and ratings
✓ Use official links from project site

9. 💻 Malware/Clipboard Hijackers

How it works:
• Malware infects your computer
• Replaces crypto addresses when you copy/paste
• You send to scammer's address instead
• Lose funds

How to avoid:
✓ Use antivirus software
✓ Don't download suspicious files
✓ Always verify address after pasting
✓ Check first/last characters
✓ Use hardware wallet

10. 🎲 Cloud Mining Scams

How it works:
• "Invest in our mining operation"
• "Guaranteed returns!"
• Shows fake profits
• Can't withdraw
• Site disappears

How to avoid:
✓ Mining is rarely profitable for individuals
✓ If passive income guaranteed, it's a scam
✓ Do extensive research
✓ Stick to known platforms

Universal Red Flags:

🚩 Guaranteed returns
🚩 "Risk-free" investment
🚩 Pressure to act now
🚩 Asks for seed phrase/private key
🚩 Too good to be true
🚩 Requests payment in crypto
🚩 Poor grammar/spelling
🚩 Unsolicited contact
🚩 No verification possible
🚩 Complex explanation (to confuse you)

Self-Defense Tactics:

1. 🧠 Slow Down
   • Scammers use urgency
   • Take time to think
   • Sleep on big decisions
   • No legit opportunity disappears overnight

2. 🔍 Research
   • Google "[project name] scam"
   • Check Reddit/Twitter discussions
   • Look for warning signs
   • Verify team members

3. 💬 Ask Community
   • Post in official Discord/Telegram
   • Ask in r/cryptocurrency
   • Get second opinions
   • Listen to warnings

4. 🧑‍🏫 Educate Yourself
   • Learn about crypto basics
   • Understand warning signs
   • Stay updated on new scams
   • Follow security accounts

5. 🛡️ Use Security Tools
   • Hardware wallet for large amounts
   • Antivirus software
   • Password manager
   • 2FA everywhere

If You're Scammed:

1. Don't panic (but act quickly)
2. Move remaining funds immediately
3. Document everything:
   • Screenshots
   • Transaction hashes
   • Scammer addresses
   • Communication logs

4. Report:
   • Local police (IC3.gov in US)
   • FTC/FBI
   • Platform where scam occurred
   • Warn community

5. Learn and move forward
   • Understand what happened
   • Don't chase the money
   • Don't fall for "recovery" scams
   • Help others avoid same mistake

Recovery Scams:

⚠️ After being scammed, beware:
• "We can recover your funds"
• "Pay us and we'll get it back"
• This is a new scam!
• Crypto transactions are final

Trust Your Gut:

If something feels wrong:
• It probably is
• Walk away
• No FOMO
• Better safe than sorry

"In crypto, paranoia is justified. Better to miss an opportunity than lose everything to a scam."

Stay safe, stay skeptical, and verify everything!`
      },
    ],
  },
  {
    id: 'trading-strategies',
    title: 'Trading Strategies & Tips',
    description: 'Learn effective strategies for cryptocurrency trading',
    duration: '45 min',
    difficulty: 'Advanced',
    category: 'advanced-trading',
    icon: Target,
    topics: [
      {
        id: 'market-analysis',
        title: 'Basic Market Analysis',
        type: 'guide',
        duration: '15 min',
        content: `Market analysis helps you make informed trading decisions instead of gambling. Learn the fundamentals of analyzing cryptocurrency markets.

Two Main Types of Analysis:

1. Fundamental Analysis (FA)
Studying the "why" behind price

2. Technical Analysis (TA)
Studying price patterns and charts

Fundamental Analysis:

What to Research:

💡 Project Basics
• What problem does it solve?
• Is there real demand?
• Who are the competitors?
• What's unique about it?

Example:
"Ethereum enables smart contracts that Bitcoin can't do. Unique value proposition = good fundamental."

👥 Team & Community
• Who's building it?
• Track record of team?
• Open source?
• Active development?
• Size of community?

Red flags:
🚩 Anonymous team
🚩 No GitHub activity
🚩 Dead community

Green flags:
✓ Known, respected team
✓ Regular updates
✓ Active Discord/GitHub

💰 Tokenomics
• Max supply (is there a cap?)
• Circulating supply
• Inflation rate
• Token distribution
• Unlock schedule

Good Example:
Bitcoin: 21M max supply, deflationary

Bad Example:
Unlimited supply, 50% held by team

📈 Adoption & Usage
• Number of users
• Transaction volume
• Partnerships
• Real-world use cases

Metrics to check:
• Active addresses
• Daily transactions
• Total Value Locked (for DeFi)
• Developer activity

Technical Analysis Basics:

📉 Reading Charts

Candlestick Explained:

Green candle = Price went up
  |  <- High
  ■  <- Close (top)
  ■  <- Open (bottom)
  |  <- Low

Red candle = Price went down
  |  <- High
  ■  <- Open (top)
  ■  <- Close (bottom)
  |  <- Low

Timeframes:
• 1m, 5m, 15m = Day trading
• 1h, 4h = Swing trading
• 1d, 1w = Long-term investing

Beginners: Start with 1d charts

📊 Support & Resistance

Support = Price floor (buyers step in)
Resistance = Price ceiling (sellers step in)

How to identify:
1. Look for areas where price bounced multiple times
2. Previous highs = resistance
3. Previous lows = support

Trading strategy:
• Buy near support
• Sell near resistance
• If price breaks resistance = new support

Example:
BTC bounced at $60k three times
= $60k is strong support
Consider buying if it dips to $60k again

📈 Trend Analysis

Three types of trends:

1. Uptrend 📈
   • Higher highs
   • Higher lows
   • Green candles dominate
   Strategy: Buy and hold

2. Downtrend 📉
   • Lower highs
   • Lower lows
   • Red candles dominate
   Strategy: Stay in stablecoins or short

3. Sideways (Range) ↔️
   • Bouncing between levels
   • No clear direction
   Strategy: Range trade or wait

"The trend is your friend"
= Don't fight the overall direction

Common Indicators:

1. Moving Averages (MA)
Average price over X days

• MA(50) = 50-day average
• MA(200) = 200-day average

How to use:
• Price > MA = Bullish
• Price < MA = Bearish
• MA(50) crosses above MA(200) = Golden Cross (bullish!)
• MA(50) crosses below MA(200) = Death Cross (bearish!)

2. RSI (Relative Strength Index)
Measures overbought/oversold

• 0-30 = Oversold (might bounce)
• 30-70 = Normal
• 70-100 = Overbought (might pullback)

Strategy:
• RSI < 30 = Consider buying
• RSI > 70 = Consider selling

Warning: Can stay overbought in strong trends!

3. MACD (Moving Average Convergence Divergence)
Momentum indicator

• MACD crosses above signal = Bullish
• MACD crosses below signal = Bearish
• Divergence = Trend might reverse

4. Volume
Number of coins traded

Key principle:
• High volume + price increase = Strong move
• High volume + price decrease = Strong dump
• Low volume + price move = Weak move

"Price moves on whispers, but confirms on volume"

Chart Patterns:

Common patterns to recognize:

1. Head and Shoulders
       /\
      /  \  
   /\    /\  
   = Bearish reversal

2. Double Top
   /\  /\
      \/
   = Bearish reversal

3. Double Bottom
      /\
   \/  \/
   = Bullish reversal

4. Triangle
   Price squeezing = Big move coming
   (Could go either way)

Combining FA + TA:

Best approach:
1. Use FA to pick WHAT to buy
2. Use TA to decide WHEN to buy

Example:
• FA says: "Ethereum has strong fundamentals"
• TA says: "Wait for pullback to $3,000 support"
• Action: Set alert, buy if it dips to $3,000

Market Sentiment:

Gauge market emotion:

🟢 Greed (Everyone buying)
• Social media very bullish
• "This time is different!"
• Friends asking about crypto
• Fear of Missing Out (FOMO)

= Often near top, be cautious

🔴 Fear (Everyone selling)
• Panic selling
• "Crypto is dead" headlines
• Nobody talking about crypto

= Often near bottom, opportunity

Fear & Greed Index:
• 0-25 = Extreme Fear (buy signal)
• 75-100 = Extreme Greed (sell signal)

"Be greedy when others are fearful, and fearful when others are greedy" - Warren Buffett

Common Mistakes:

❌ Analysis Paralysis
  Spending hours analyzing, never buying
  → Sometimes just start small

❌ cherry-picking Data
  Only seeing what confirms your bias
  → Look for opposing views

❌ Overtrading
  Trading every tiny movement
  → Patience pays

❌ Ignoring Risk
  Great analysis, terrible position sizing
  → Risk management comes first!

Beginners Checklist:

Before buying any crypto:
☐ Read project website
☐ Check team background
☐ Review tokenomics
☐ Look at chart (trend?)
☐ Check support/resistance levels
☐ Assess risk/reward
☐ Determine position size
☐ Set stop loss

Resources:

📈 Charts: TradingView.com
📊 Data: CoinGecko, CoinMarketCap
👥 Community: CryptoTwitter, Reddit
📚 Learning: Investopedia, YouTube

Practice:

• Paper trade first (fake money)
• Keep a trading journal
• Review your analysis
• Learn from mistakes
• Start small with real money

Remember: Analysis reduces risk, but never eliminates it. No one can predict the future perfectly!`
      },
      {
        id: 'risk-management',
        title: 'Risk Management',
        type: 'guide',
        duration: '12 min',
        content: `Risk management is MORE important than picking winning trades. You can be right 60% of the time and still lose money with poor risk management. Master these principles to protect your capital.

The Golden Rule:

"Never risk more than you can afford to lose"

Sounds obvious, but most beginners ignore it!

Position Sizing:

How much should you invest per trade?

The 1-5% Rule:
• Never risk more than 5% of portfolio on single trade
• Conservative: 1-2%
• Moderate: 3-4%
• Aggressive: 5%

Example:
Portfolio: $10,000

Conservative:
$10,000 × 2% = $200 per trade

Aggressive:
$10,000 × 5% = $500 per trade

Why this matters:

Bad strategy:
Put $5,000 into one trade
2 losses in a row = You're done

Good strategy:
Put $500 into each trade
10 trades possible
Even if 5 lose, 5 might win

Diversification:

Don't put all eggs in one basket!

Sample Portfolio Allocation:

40% - Bitcoin (Safe, established)
30% - Ethereum (Solid, proven)
20% - Top 10 altcoins (Medium risk)
10% - Small caps (High risk, high reward)

Adjust based on risk tolerance:

Conservative:
50% BTC, 30% ETH, 15% top alts, 5% small caps

Aggressive:
20% BTC, 30% ETH, 30% top alts, 20% small caps

Never:
❌ 100% in one coin
❌ 80% in meme coins
❌ Entire portfolio in unknown projects

Stop Loss Strategy:

A stop loss automatically sells if price drops to your limit.

Why use stop losses?
• Prevents catastrophic losses
• Removes emotion
• Protects during sleep/work
• Enforces discipline

How to set stop loss:

Method 1: Percentage
• Common: 5-10% below entry

Example:
Buy ETH at $3,000
Stop loss at $2,700 (10% down)
= Max loss: $300

Method 2: Technical levels
• Below support level

Example:
Buy BTC at $65,000
Support is at $63,000
Stop loss at $62,500
= Gives support room to hold

Method 3: Dollar amount
• "I'm willing to lose $200"

Calculate position size:
Entry: $3,000
Stop: $2,800
Risk: $200

Position size = $200 / ($3,000 - $2,800)
= $200 / $200 = 1 ETH max

Risk/Reward Ratio:

Always calculate before trading!

Formula:
Reward / Risk

Example:
Buy at: $3,000
Stop loss: $2,700 (Risk = $300)
Target: $3,900 (Reward = $900)

Ratio = $900 / $300 = 3:1

✓ Good trade! (Minimum 2:1 recommended)

Another example:
Buy at: $3,000
Stop loss: $2,700 (Risk = $300)
Target: $3,300 (Reward = $300)

Ratio = $300 / $300 = 1:1

❌ Bad trade! Not worth the risk

Rule of thumb:
• Minimum 2:1 ratio
• Ideal 3:1 or better
• 1:1 = gambling

Why 2:1 matters:

With 2:1 ratio:
• Win 40% of trades
• Still profitable!

Math:
10 trades, $100 risk each
6 losses: -$600
4 wins: +$800 (2:1 reward)
Net: +$200 profit

Emotional Risk Management:

🧠 Psychology is HUGE

FOMO (Fear of Missing Out):
Symptom: "Everyone's buying, I must too!"
Cure: Stick to your plan, there's always another opportunity

FUD (Fear, Uncertainty, Doubt):
Symptom: Panic selling on red day
Cure: If fundamentals unchanged, hold or even buy

Revenge Trading:
Symptom: Lost money, trying to "win it back"
Cure: Take a break, stick to strategy

Greed:
Symptom: "Just a little more profit..."
Cure: Set targets, take profits

Rules for Emotional Control:

1. Never trade when emotional
   • Angry?
   • Drunk?
   • Depressed?
   • overly excited?
   Wait 24 hours

2. Set rules BEFORE trading
   • Entry price
   • Stop loss
   • Take profit
   • Position size
   Don't change mid-trade

3. Take breaks after losses
   • Lost 2 trades in a row?
   • Stop for the day
   • Review what went wrong
   • Come back tomorrow

4. Journal your trades
   • Why did you enter?
   • How did you feel?
   • What was the result?
   • Learn patterns

The 50/50 Rule:

When in doubt about a trade:
• Only enter with 50% of intended amount

If it goes well:
• Add the other 50%

If it goes badly:
• You only risked half

Portfolio Heat:

Total risk across all positions

Rule: Max 20% portfolio heat

Example:
4 trades, 5% risk each = 20% total

❌ DON'T open 5th trade
✓ Wait for one to close first

Why? If all go against you:
Max loss = 20% portfolio
Still have 80% to recover

Taking Profits:

Many forget to cash out!

Strategies:

1. Percentage Targets
   25% up = Sell 25%
   50% up = Sell another 25%
   100% up = Sell another 25%
   Let rest ride

2. Tiered Exits
   Target 1: $3,300 (Sell 33%)
   Target 2: $3,600 (Sell 33%)
   Target 3: $4,000 (Sell 33%)

3. Trailing Stop
   Follows price up
   If drops X%, auto sell
   Locks in profits

Don't be greedy:
"Pigs get slaughtered"

Better to:
✓ Take 50% profit
than
❌ Hold for 100% and lose it all

Rebalancing:

Periodically adjust portfolio:

Example:
Started: 50% BTC, 50% ETH

After 3 months:
BTC pumped: Now 70% BTC, 30% ETH

Rebalance:
Sell some BTC, buy ETH
Back to 50/50

Why?
• Takes profit from winners
• Buys dips in losers
• Maintains risk level

Frequency:
• Monthly (active)
• Quarterly (moderate)
• Yearly (passive)

Bear Market Risk Management:

When market crashes:

✓ DO:
• Reduce position sizes
• Increase cash/stablecoin %
• DCA small amounts
• Focus on quality projects
• Learn and research

❌ DON'T:
• Panic sell everything
• Try to catch every falling knife
• Use leverage
• Invest rent money

"In a bear market, capital preservation > making money"

Leverage Warning:

⚠️ Most beginners should AVOID leverage

What is leverage?
Borrowing to trade bigger

10x leverage:
$1,000 becomes $10,000 buying power

Sounds great?
• 10% gain = $1,000 profit (100%!)

The problem:
• 10% loss = $1,000 loss (100% of capital!)
• Liquidated (lose everything)

Stats: 90% of leverage traders lose money

If you must use leverage:
• Start with 2x max
• Use stop losses
• Risk tiny amounts ($50)
• Expect to lose it

Risk Management Checklist:

Before EVERY trade:

☐ Position size calculated (1-5% rule)
☐ Stop loss set
☐ Take profit targets defined
☐ Risk/reward ratio > 2:1
☐ Portfolio heat < 20%
☐ Not trading on emotion
☐ Have written plan

☐ Can afford to lose this amount

If any unchecked: DON'T TRADE

Final Wisdom:

"Rule #1: Don't lose money
Rule #2: Don't forget rule #1"
- Warren Buffett

In crypto:
• Protect your capital FIRST
• Profits second
• Survive to trade another day
• Compound small wins

Remember: Making money is easy. KEEPING money requires discipline!`
      },
      {
        id: 'portfolio-diversification',
        title: 'Portfolio Diversification',
        type: 'guide',
        duration: '10 min',
        content: `"Don't put all your eggs in one basket" - This old wisdom is especially true in crypto. Learn how to build a balanced, diversified portfolio that can weather market storms.

Why Diversify?

🛡️ Reduce Risk
• If one coin crashes, others might hold
• Different coins have different cycles
• Portfolio less volatile overall

Example:
100% Bitcoin: If BTC drops 30%, you lose 30%

Diversified:
• BTC drops 30%: -15% (50% allocation)
• ETH sideways: 0% (30% allocation)
• SOL up 20%: +4% (20% allocation)
Total: -11% (Much better!)

💰 Capture Different Opportunities
• Different sectors perform at different times
• Increase chance of holding winners
• DeFi might pump while NFTs dump

Portfolio Tiers:

Tier 1: Foundation (50-70%)
Large-cap, established coins

• Bitcoin (BTC)
• Ethereum (ETH)

Why?
✓ Most stable
✓ Highest liquidity
✓ Time-tested
✓ Benchmark for market

Risk level: Low 🟢

Tier 2: Growth (20-30%)
Top 10-50 coins, proven projects

• Solana (SOL)
• Cardano (ADA)
• Polygon (MATIC)
• Chainlink (LINK)
• Avalanche (AVAX)

Why?
✓ Higher growth potential than BTC/ETH
✓ Still relatively safe
✓ Established communities

Risk level: Medium 🟡

Tier 3: Moonshots (5-15%)
Smaller caps, higher risk/reward

• New DeFi projects
• Emerging Layer 1s
• Promising NFT platforms

Why?
• 10x-100x potential
• Early adopter advantage

But also:
• Could go to zero
• Less liquidity
• Higher volatility

Risk level: High 🔴

Tier 4: Stablecoins (5-20%)
USDT, USDC, DAI

Why?
✓ Buy dips quickly
✓ Safe haven in crashes
✓ Earn yield (staking)
✓ Reduce portfolio volatility

Risk level: Very Low ⚪

Sample Portfolios:

Conservative (Lower risk, steady growth):

50% Bitcoin
30% Ethereum
10% Top altcoins (SOL, ADA)
10% Stablecoins

Expected: 30-50% annual return
Max drawdown: ~40%

Moderate (Balanced):

35% Bitcoin
25% Ethereum
25% Top altcoins
10% Small caps
5% Stablecoins

Expected: 50-100% annual return
Max drawdown: ~60%

Aggressive (High risk, high reward):

25% Bitcoin
25% Ethereum
30% Top altcoins
15% Small caps
5% Stablecoins

Expected: 100-300% annual return
Max drawdown: ~80%

Degen (Not recommended):

10% Bitcoin
10% Ethereum
30% Altcoins
50% Moonshots

Expected: 🚀 or 💥
Max drawdown: Up to 95%

Sector Diversification:

Don't just diversify coins - diversify SECTORS:

💎 Store of Value
• Bitcoin
• Digital gold

When it pumps:
• Fear in traditional markets
• Inflation concerns
• Macro uncertainty

🛠️ Smart Contract Platforms
• Ethereum, Solana, Cardano
• Build apps on them

When they pump:
• DeFi boom
• NFT craze
• Developer activity

💸 DeFi (Decentralized Finance)
• Uniswap, Aave, Compound
• Financial apps

When it pumps:
• High yields available
• Innovation in finance
• TradFi looking shaky

🇿 Layer 2 Solutions
• Polygon, Arbitrum, Optimism
• Scaling Ethereum

When they pump:
• High ETH gas fees
• Need for cheap transactions

🎮 Gaming/Metaverse
• Axie Infinity, Decentraland
• Play-to-earn

When it pumps:
• Gaming trends
• Metaverse hype

🔗 Oracles
• Chainlink
• Connect blockchain to real world

When it pumps:
• Smart contract growth
• DeFi expansion

🔒 Privacy Coins
• Monero, Zcash
• Anonymous transactions

When they pump:
• Privacy concerns
• Government overreach

Sample Sector Portfolio:

30% Store of Value (BTC)
25% Smart Contracts (ETH, SOL)
15% DeFi (UNI, AAVE)
10% Layer 2 (MATIC)
10% Gaming (AXS)
10% Stablecoins

Geographic Diversification?

Mostly irrelevant in crypto (it's global!)

But consider:
• Asian-focused projects (near Korea/China)
• US-based vs international teams
• Regulatory-friendly vs rebellious

Rebalancing Strategy:

When to rebalance:

Time-based:
• Monthly (active traders)
• Quarterly (moderate)
• Annually (long-term)

Threshold-based:
• If any position > 40% or < 5%
• Rebalance back to targets

How to rebalance:

1. Check current allocation
2. Compare to target
3. Sell what's over, buy what's under

Example:
Target: 50% BTC, 50% ETH

After bull run:
Actual: 70% BTC, 30% ETH

Action:
Sell 20% worth of BTC
Buy ETH with proceeds
Back to 50/50

Benefits:
✓ Takes profit from winners
✓ Buys more losers (at discount)
✓ "Buy low, sell high" automatically

Correlation Matters:

Correlation = How closely two assets move together

+1.0 = Perfect correlation (move identically)
0.0 = No correlation
-1.0 = Perfect inverse correlation

Most crypto is correlated (0.7-0.9 with BTC)

= When BTC dumps, most alts dump too

True diversification would include:
• Stocks
• Gold
• Real estate
• Bonds

But this course is crypto-focused!

Within crypto:
• Stablecoins (0 correlation)
• Different sectors (lower correlation)
• Varying market caps

Mistakes to Avoid:

❌ Over-Diversification
  20+ coins you can't track
  → Diluted returns
  → Stick to 5-15 coins

❌ Fake Diversification
  5 meme coins = NOT diversified
  → Choose different sectors

❌ NEVER Rebalancing
  Started 50/50 BTC/ETH
  Now 90% BTC, 10% ETH
  → Too concentrated!

❌ Chasing Pumps
  Selling losers, buying what just pumped
  → Opposite of rebalancing

❌ Ignoring Stablecoins
  100% volatile assets
  → No dry powder for dips

How Many Coins?

Too few ( <3 ):
• Too concentrated
• High risk

Too many ( >20 ):
• Can't track all
• Diluted returns
• Like an index fund

Sweet spot: 7-12 coins
• Manageable
• Diversified enough
• Room for winners to shine

Building Your Portfolio:

Step by step:

1. Determine risk tolerance
   • Sleep test: Can you sleep if portfolio drops 50%?
   • Age factor: Young = more risk OK
   • Financial situation: Spare money only

2. Choose portfolio type
   • Conservative, Moderate, or Aggressive

3. Pick your coins
   • Research each one
   • Understand what you own

4. Set target allocations
   • Write them down!
   • BTC: 40%, ETH: 30%, etc.

5. Buy gradually (DCA)
   • Don't buy all at once
   • Spread over weeks/months

6. SET calendar reminder
   • Review monthly/quarterly
   • Rebalance if needed

7. STICK to the plan
   • Emotions will try to stop you
   • Trust the process

Taxation Note:

Rebalancing = Selling = Taxable event

Consider:
• Tax-loss harvesting
• Hold > 1 year (long-term gains)
• Consult tax professional

Portfolio Tracking:

Use tools:
• CoinGecko portfolio
• Delta app
• Blockfolio
• Simple spreadsheet

Track:
• Total value
• % allocation
• Cost basis
• Profit/loss

Final Thoughts:

"Diversification is the only free lunch in investing"

In crypto:
• Reduces risk without sacrificing returns
• Helps you sleep better
• Increases chance of holding winners
• Protects against unknown unknowns

Start diversified, stay disciplined, rebalance regularly!`
      },
      {
        id: 'advanced-strategies',
        title: 'Advanced Trading Strategies',
        type: 'guide',
        duration: '8 min',
        content: `Ready to level up your trading? These advanced strategies require more knowledge and experience. Only attempt after mastering the basics!

⚠️ Warning: Advanced strategies carry higher risk. Start small and practice thoroughly.

Dollar-Cost Averaging (DCA):

Already covered basics, here's advanced:

Dynamic DCA:
Adjust amount based on market conditions

RSI < 30 (oversold): Buy 2x normal
RSI 30-70 (normal): Buy 1x normal
RSI > 70 (overbought): Buy 0.5x normal

Benefits:
• Buy more when cheap
• Buy less when expensive
• Better average price

Value DCA:
Buy more when price drops

Price -10%: Add $150 (vs $100 normal)
Price -20%: Add $200
Price -30%: Add $300

Caution: Need larger reserves!

Swing Trading:

Hold for days/weeks (vs months)

Strategy:
1. Identify trend (uptrend preferred)
2. Wait for pullback to support
3. Enter with confirmation
4. Set target at resistance
5. Exit, repeat

Example:
ETH in uptrend, $3000-$3500 range

• Buy: $3,000 (support)
• Sell: $3,450 (resistance)
• Profit: 15%
• Repeat weekly = 60% monthly (if perfect)

Tools needed:
• Technical analysis skills
• Time to watch charts
• Discipline to take profits

Risk:
• Trend reversal
• Fake breakout
• Trading fees eat profits

Breakout Trading:

Buy when price breaks resistance

Setup:

Price consolidating: $3,000-$3,200
Waiting, waiting...
Breaks $3,200 with volume!
Buy: $3,250 (confirmation)
Target: $3,500-$3,700

Confirmation needed:
✓ High volume
✓ Strong candle
✓ Re-test of breakout (optional)

False breakouts happen!
• Use stop loss below breakout level
• Don't chase FOMO pumps

Mean Reversion:

"What goes up must come down"
"What goes down must bounce"

Strategy:
Buy oversold assets expecting return to average

Example:
ETH normally $3,000
Flash crash to $2,500
Buy, expecting recovery to $3,000

Indicators:
• RSI < 30
• Price far below MA(200)
• Extreme fear sentiment

Risk:
• "Falling knife" - keeps dropping
• Fundamental change (it should be lower)

News Trading:

Trade based on events:

Positive catalysts:
• Exchange listings
• Partnerships announced
• Major upgrades
• Institutional adoption

Negative catalysts:
• Hacks
• Regulatory crackdowns
• Team departures

Strategy:
"Buy the rumor, sell the news"

Example:
Rumor: "ETH upgrade coming"
• Price pumps on speculation

News: "Upgrade launched!"
• Price dumps (sell-off)

Why? Expectations already priced in!

Tips:
• Act fast (news spreads quickly)
• Verify sources
• Avoid fake news
• Set limit orders before event

Arbitrage:

Buy low on Exchange A
Sell high on Exchange B
Profit from price difference

Simple example:
BTC on Binance: $65,000
BTC on Coinbase: $65,200

Buy Binance, sell Coinbase = $200 profit

Reality check:
• Fees: $50
• Withdrawal time: Risk changes
• Net profit: $150 (still good!)

Types:

1. Spatial arbitrage
   Different exchanges

2. Temporal arbitrage
   Same exchange, different times

3. Triangular arbitrage
   BTC → ETH → USDT → BTC
   Profit from rate differences

Challenges:
• Requires significant capital
• Speed matters (bots compete)
• Transfer fees
• Withdrawal delays

Grid Trading:

Automate buying low, selling high

Setup:

Range: $2,900 - $3,100
Grid: 10 levels, $20 apart

Buy orders:
$2,900, $2,920, $2,940...

Sell orders:
$2,920, $2,940, $2,960...

How it works:
Price bounces in range
• Hits $2,900 → Buy
• Rises to $2,920 → Sell
• Profit: $20
• Repeat automatically!

Best for:
• Sideways markets
• Volatile assets
• Patience

Risk:
• Trend breaks range
• Stuck with heavy bags

Pairs Trading:

Trade correlation between two assets

Example:
BTC and ETH usually move together

Usual ratio: 1 BTC = 15 ETH

Scenario 1:
Ratio becomes 1 BTC = 20 ETH
• BTC over-performing
• Sell BTC, buy ETH
• Expecting reversion to 15

Scenario 2:
Ratio becomes 1 BTC = 12 ETH
• ETH over-performing
• Buy BTC, sell ETH
• Expecting reversion to 15

Advanced technique:
• Market neutral
• Profit from relative movement
• Less directional risk

Yield Farming:

Provide liquidity to DeFi protocols
Earn fees + rewards

Example:
Deposit ETH + USDC to Uniswap pool
Earn:
• Trading fees (0.3%)
• UNI rewards
• Maybe 20-50% APY

Risks:
🚩 Impermanent loss
  • Price divergence = loss
  • Can be significant!

🚩 Smart contract risk
  • Hacks happen
  • Bugs can drain funds

🚩 Rug pulls
  • New project abandons
  • Tokens worthless

Tips:
✓ Use established protocols
✓ Check audits
✓ Understand impermanent loss
✓ Diversify across pools
✓ Monitor regularly

Ladder Strategy:

Spread buys/sells across levels

Buying ladder:

$100 at $3,000
$150 at $2,900
$200 at $2,800
$300 at $2,700

Benefits:
• Average in gradually
• Buy more if cheaper
• Don't miss "the bottom"

Selling ladder:

25% at $3,500
25% at $4,000
25% at $4,500
25% at $5,000

Benefits:
• Take profits gradually
• Don't miss continuation
• Remove emotion

Seasonal Trading:

Crypto has patterns:

"Uptober" - October often bullish
"Moonvember" - November rallies
"Moonuary" - January can pump
"Sell in May, go away" - Summer slow

Based on:
• Tax year timing
• Holiday bonuses
• Institutional calendars

Not guaranteed! But slight edge.

Accumulation/Distribution:

Smart money strategy:

Accumulation Phase:
• Price sideways/down
• Volume increasing
• Smart money buying quietly
• Retail bored/scared

Action: Accumulate with them

Distribution Phase:
• Price high
• Volume increasing
• Smart money selling to retail
• Retail FOMO buying

Action: Sell with smart money

How to identify:
• On-chain data
• Whale watching
• Volume patterns
• Price action

Advanced Risk Management:

Position Sizing Formula:

Risk per trade = 2% of portfolio
Entry: $3,000
Stop: $2,850
Risk per unit: $150

Portfolio: $10,000
Max risk: $200 (2%)

Position size = $200 / $150 = 1.33 ETH

Kelly Criterion:
Optimal bet size based on edge

f = (bp - q) / b

f = fraction of capital
b = odds (reward/risk)
p = probability of winning
q = probability of losing (1-p)

Example:
Win rate: 60%
Risk/Reward: 1:2

f = (2 × 0.6 - 0.4) / 2
f = 0.4 = 40% of capital

Note: Usually too aggressive,
Use 1/4 Kelly = 10% position

Final Tips:

✅ Master basics first
• Don't jump to advanced too soon
• Practice with small amounts

✅ Keep learning
• Markets evolve
• Strategies that worked may not
• Adapt continuously

✅ Track everything
• Trading journal
• What works for YOU
• Personalize strategies

✅ Risk management always
• Fancy strategies won't save you
• Position sizing matters most
• Preserve capital

Remember: The goal isn't to use every strategy. Find 1-2 that fit your style and master them!

Success = Simple strategy + Excellent execution + Discipline`
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function CourseDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { user, isLoading } = useAuth()
  const [selectedTopicIndex, setSelectedTopicIndex] = useState(0)
  const [completedTopics, setCompletedTopics] = useState<Set<string>>(new Set())
  const [showContent, setShowContent] = useState(true)
  const hasLoadedProgress = useRef(false)

  const courseId = params?.id as string
  const course = learningModules.find((m) => m.id === courseId)

  // Load progress from localStorage
  useEffect(() => {
    if (user?.uid && course && !hasLoadedProgress.current) {
      hasLoadedProgress.current = true
      const saved = localStorage.getItem(`learn-progress-${user.uid}`)
      if (saved) {
        try {
          const parsedData = JSON.parse(saved) as string[]
          queueMicrotask(() => setCompletedTopics(new Set(parsedData)))
        } catch (error) {
          console.error('Failed to load learning progress:', error)
        }
      }
    } else if (!user?.uid) {
      hasLoadedProgress.current = false
    }
  }, [user?.uid, course])

  // Mark topic as complete
  const markTopicComplete = async (topicId: string) => {
    const updated = new Set(completedTopics)
    updated.add(topicId)
    setCompletedTopics(updated)
    if (user?.uid && course) {
      // Save to localStorage
      localStorage.setItem(`learn-progress-${user.uid}`, JSON.stringify([...updated]))
      
      // Save to database with Firebase UID
      localStorage.setItem('firebase-uid', user.uid)
      
      try {
        const { authenticatedFetch } = await import('@/lib/api-client')
        
        const response = await authenticatedFetch('/api/rewards/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            courseId: course.id,
            courseTitle: course.title,
            moduleId: topicId,
            totalModules: course.topics.length,
          }),
        })
        
        if (response.ok) {
          const data = await response.json()
          console.log('Progress saved! Rewards data:', data)
          
          // Show a toast notification if you have one
          if (data.progress) {
            console.log(`🎉 Module completed! Check /rewards to see your points.`)
          }
        }
      } catch (error) {
        console.error('Error saving progress to database:', error)
      }
    }
  }

  // Navigate to next topic
  const goToNextTopic = () => {
    if (course && selectedTopicIndex < course.topics.length - 1) {
      setSelectedTopicIndex(selectedTopicIndex + 1)
      setShowContent(false)
      setTimeout(() => setShowContent(true), 100)
    }
  }

  // Navigate to previous topic
  const goToPreviousTopic = () => {
    if (selectedTopicIndex > 0) {
      setSelectedTopicIndex(selectedTopicIndex - 1)
      setShowContent(false)
      setTimeout(() => setShowContent(true), 100)
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner':
        return 'text-green-400 bg-green-500/10 border-green-500/20'
      case 'Intermediate':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
      case 'Advanced':
        return 'text-red-400 bg-red-500/10 border-red-500/20'
      default:
        return 'text-gray-400 bg-gray-500/10 border-gray-500/20'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'guide':
        return <FileText className="w-5 h-5" />
      case 'video':
        return <Video className="w-5 h-5" />
      case 'interactive':
        return <Play className="w-5 h-5" />
      case 'quiz':
        return <Award className="w-5 h-5" />
      default:
        return <BookOpen className="w-5 h-5" />
    }
  }

  const getCourseProgress = (course: LearningModule) => {
    const completed = course.topics.filter((topic) => completedTopics.has(topic.id)).length
    return Math.round((completed / course.topics.length) * 100)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    )
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-4">Course Not Found</h1>
            <p className="text-zinc-400 mb-6">The course you&apos;re looking for doesn&apos;t exist.</p>
            <button
              onClick={() => router.push('/learn')}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            >
              Back to Learning Center
            </button>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  const currentTopic = course.topics[selectedTopicIndex]
  const Icon = course.icon
  const progress = getCourseProgress(course)

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col">
      <Navbar />
      
      {/* Full-page Container with edge gaps */}
      <div className="pt-20 pb-6 px-3 sm:px-6 flex-1 w-full">
        <div className="max-w-[98vw] mx-auto h-full">
          {/* Back Button */}
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => router.push('/learn')}
            className="mb-4 flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-semibold">Back to Learning Center</span>
          </motion.button>

          {/* Course Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-zinc-900/80 to-zinc-900/40 border border-zinc-800 rounded-2xl p-6 sm:p-8 mb-6"
          >
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                <Icon className="w-12 h-12 text-blue-400" />
              </div>
              
              <div className="flex-1">
                <h1 className="text-3xl sm:text-4xl font-black mb-3 bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent">
                  {course.title}
                </h1>
                <p className="text-lg text-zinc-400 mb-4">{course.description}</p>
                
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getDifficultyColor(course.difficulty)}`}>
                    {course.difficulty}
                  </span>
                  <span className="flex items-center gap-1 text-sm text-zinc-500">
                    <Clock className="w-4 h-4" />
                    {course.duration}
                  </span>
                  <span className="flex items-center gap-1 text-sm text-zinc-500">
                    <BookOpen className="w-4 h-4" />
                    {course.topics.length} topics
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Course Progress</span>
                    <span className="text-blue-400 font-bold">{progress}%</span>
                  </div>
                  <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-600"
                    />
                  </div>
                </div>
              </div>

              {/* Course Header Image - Only show if image exists */}
              {courseHeaderImages[course.id] && (
                <div className="w-full md:w-64 h-64 bg-zinc-800/50 border-2 border-zinc-700 rounded-xl overflow-hidden">
                  <Image
                    src={courseHeaderImages[course.id]}
                    alt={course.title}
                    width={256}
                    height={256}
                    className="object-cover w-full h-full"
                  />
                </div>
              )}
            </div>
          </motion.div>

          {/* Main Content Area */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
            {/* Sidebar - Topics List */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="lg:col-span-1"
            >
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 sticky top-24">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-400" />
                  Topics
                </h2>
                
                <div className="space-y-2">
                  {course.topics.map((topic, index) => {
                    const isCompleted = completedTopics.has(topic.id)
                    const isCurrent = index === selectedTopicIndex
                    
                    return (
                      <button
                        key={topic.id}
                        onClick={() => {
                          setSelectedTopicIndex(index)
                          setShowContent(false)
                          setTimeout(() => setShowContent(true), 100)
                        }}
                        className={`w-full p-3 rounded-lg transition-all text-left ${
                          isCurrent
                            ? 'bg-blue-600 shadow-lg shadow-blue-600/20'
                            : 'bg-zinc-800/50 hover:bg-zinc-800'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {isCompleted ? (
                            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                          ) : (
                            <Circle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isCurrent ? 'text-white' : 'text-zinc-600'}`} />
                          )}
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs font-semibold ${isCurrent ? 'text-blue-100' : 'text-zinc-500'}`}>
                                {index + 1}/{course.topics.length}
                              </span>
                              <span className={isCurrent ? 'text-blue-100' : 'text-zinc-500'}>
                                {getTypeIcon(topic.type)}
                              </span>
                            </div>
                            <h3 className={`font-semibold text-sm mb-1 ${isCurrent ? 'text-white' : 'text-zinc-300'}`}>
                              {topic.title}
                            </h3>
                            <p className={`text-xs ${isCurrent ? 'text-blue-200' : 'text-zinc-500'}`}>
                              {topic.duration}
                            </p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </motion.div>

            {/* Main Content Area */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="lg:col-span-3"
            >
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 sm:p-8 min-h-[600px]">
                <AnimatePresence mode="wait">
                  {showContent && (
                    <motion.div
                      key={currentTopic.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      {/* Topic Header */}
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-blue-500/10 rounded-lg">
                              {getTypeIcon(currentTopic.type)}
                            </div>
                            <div>
                              <h2 className="text-2xl sm:text-3xl font-bold text-white">
                                {currentTopic.title}
                              </h2>
                              <p className="text-sm text-zinc-500 mt-1">
                                {currentTopic.duration} • {currentTopic.type}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        {!completedTopics.has(currentTopic.id) && (
                          <button
                            onClick={() => markTopicComplete(currentTopic.id)}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Mark Complete
                          </button>
                        )}
                      </div>

                      {/* Topic Image - Only show if image exists */}
                      {topicImages[currentTopic.id] && (
                        <div className="w-full h-96 bg-zinc-800/50 border-2 border-zinc-700 rounded-xl overflow-hidden mb-8">
                          <Image
                            src={topicImages[currentTopic.id]}
                            alt={currentTopic.title}
                            width={800}
                            height={384}
                            className="object-cover w-full h-full"
                          />
                        </div>
                      )}

                      {/* Topic Content */}
                      {currentTopic.content ? (
                        <div className="space-y-8">
                          <div className="text-zinc-300 text-lg leading-relaxed whitespace-pre-line">
                            {currentTopic.content}
                          </div>
                          
                          <div className="p-6 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                            <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                              <Lightbulb className="w-5 h-5 text-yellow-400" />
                              Key Takeaways
                            </h3>
                            <ul className="space-y-2 text-zinc-400">
                              <li>• Review the main concepts covered in this lesson</li>
                              <li>• Practice what you&apos;ve learned with real examples</li>
                              <li>• Complete all topics to master this course</li>
                            </ul>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <BookOpen className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
                          <p className="text-zinc-500 text-lg">
                            Content for this topic is coming soon!
                          </p>
                          <p className="text-zinc-600 text-sm mt-2">
                            Check back later for detailed lessons and examples.
                          </p>
                        </div>
                      )}

                      {/* Navigation Buttons */}
                      <div className="flex items-center justify-between mt-12 pt-6 border-t border-zinc-800">
                        <button
                          onClick={goToPreviousTopic}
                          disabled={selectedTopicIndex === 0}
                          className={`px-6 py-3 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                            selectedTopicIndex === 0
                              ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                              : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                          }`}
                        >
                          <ChevronLeft className="w-5 h-5" />
                          Previous Topic
                        </button>

                        {selectedTopicIndex < course.topics.length - 1 ? (
                          <button
                            onClick={goToNextTopic}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
                          >
                            Next Topic
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => router.push('/learn')}
                            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
                          >
                            <CheckCircle className="w-5 h-5" />
                            Complete Course
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  )
}
