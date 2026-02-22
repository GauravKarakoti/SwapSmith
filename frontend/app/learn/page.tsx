'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion } from 'framer-motion'
import {
  BookOpen,
  FileText,
  TrendingUp,
  Zap,
  Shield,
  DollarSign,
  Clock,
  Target,
  Lightbulb,
  Users,
  AlertCircle,
  LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import FullPageAd from '@/components/FullPageAd'
import { useLearnFullPageAd } from '@/hooks/useAds'

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
  image?: string // Path to learning image
  topics: Topic[]
  completed?: boolean
}

interface Topic {
  id: string
  title: string
  type: 'guide' | 'video' | 'interactive' | 'quiz'
  duration: string
  completed?: boolean
  content?: string
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
    image: '/learning/cryptocurrency.webp',
    topics: [
      {
        id: 'what-is-crypto',
        title: 'What is Cryptocurrency?',
        type: 'guide',
        duration: '5 min',
        content: `
# What is Cryptocurrency?

Cryptocurrency is a digital or virtual form of money that uses cryptography for security. Unlike traditional currencies issued by governments (like USD or EUR), cryptocurrencies operate on decentralized networks based on blockchain technology.

## Key Characteristics:
- **Decentralized**: Not controlled by any central authority
- **Secure**: Uses cryptographic techniques to secure transactions
- **Transparent**: All transactions are recorded on a public ledger
- **Global**: Can be sent anywhere in the world instantly
- **Limited Supply**: Most cryptocurrencies have a maximum supply cap

## Popular Cryptocurrencies:
1. **Bitcoin (BTC)**: The first and most well-known cryptocurrency
2. **Ethereum (ETH)**: A platform for smart contracts and decentralized applications
3. **USDT/USDC**: Stablecoins pegged to the US Dollar
4. **And thousands more...**

Understanding cryptocurrency is the first step to using SwapSmith effectively!
        `
      },
      {
        id: 'blockchain-explained',
        title: 'Understanding Blockchain',
        type: 'guide',
        duration: '7 min',
        content: `
# Understanding Blockchain

A blockchain is a distributed ledger that records all cryptocurrency transactions. Think of it as a digital notebook that everyone can see, but no one can cheat.

## How It Works:
1. **Blocks**: Transactions are grouped into blocks
2. **Chain**: Each block is linked to the previous one, forming a chain
3. **Verification**: Network participants verify each block
4. **Immutability**: Once added, blocks cannot be changed

## Why It Matters:
- Prevents double-spending
- Creates trust without intermediaries
- Enables peer-to-peer transactions
- Provides transparency and security

This technology powers all the cryptocurrencies you can swap on SwapSmith!
        `
      },
      {
        id: 'wallets-explained',
        title: 'Cryptocurrency Wallets',
        type: 'guide',
        duration: '8 min',
        content: `
# Cryptocurrency Wallets

A crypto wallet is a tool that allows you to store, send, and receive cryptocurrency. Think of it as your digital bank account, but you're the bank!

## Types of Wallets:
1. **Hot Wallets** (Connected to internet)
   - MetaMask (Browser extension)
   - Trust Wallet (Mobile app)
   - Coinbase Wallet
   
2. **Cold Wallets** (Offline storage)
   - Hardware wallets (Ledger, Trezor)
   - Paper wallets

## Important Wallet Concepts:
- **Public Address**: Like your account number, safe to share
- **Private Key**: Like your password, NEVER share this!
- **Seed Phrase**: 12-24 words to recover your wallet

## Using Wallets with SwapSmith:
Connect your wallet (like MetaMask) to SwapSmith to start swapping cryptocurrencies. SwapSmith supports multiple wallet types for your convenience.

**Pro Tip**: Always backup your seed phrase and keep it secure!
        `
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
    image: '/learning/gettingstartedswapsmithandchatinterface.png',
    topics: [
      {
        id: 'platform-overview',
        title: 'SwapSmith Platform Overview',
        type: 'guide',
        duration: '5 min',
        content: `
# Welcome to SwapSmith!

SwapSmith is your intelligent cryptocurrency swap platform that makes exchanging digital assets simple, secure, and efficient.

## What Makes SwapSmith Special?

### 🤖 AI-Powered Assistant
- Chat with our AI to execute swaps using natural language
- Ask questions about cryptocurrencies and get instant answers
- Get personalized recommendations based on market conditions

### 💱 Smart Swap Engine
- Compare rates across multiple exchanges
- Get the best price for your swaps automatically
- Support for 100+ cryptocurrencies

### 📊 Real-Time Analytics
- Live price tracking and charts
- Historical data and trends
- Portfolio performance insights

### 🔒 Security First
- Non-custodial (you control your funds)
- Secure wallet integration
- Transparent fee structure

## Key Features:
1. **Terminal Mode**: Advanced trading interface for power users
2. **Live Prices**: Real-time cryptocurrency price tracking
3. **Discussions**: Community forum to learn and share
4. **DCA (Dollar Cost Averaging)**: Automated recurring swaps

Ready to start swapping? Let's dive in!
        `
      },
      {
        id: 'first-swap',
        title: 'How to Make Your First Swap',
        type: 'interactive',
        duration: '8 min',
        content: `
# Making Your First Swap

Follow these simple steps to execute your first cryptocurrency swap on SwapSmith:

## Step 1: Connect Your Wallet
1. Click the "Connect Wallet" button in the top navigation
2. Select your wallet provider (MetaMask, WalletConnect, etc.)
3. Approve the connection request in your wallet
4. Your wallet address will appear once connected

## Step 2: Choose Your Swap Pair
1. Select the cryptocurrency you want to swap FROM
2. Select the cryptocurrency you want to receive (TO)
3. Enter the amount you wish to swap

## Step 3: Review the Swap Details
SwapSmith will show you:
- Exchange rate
- Expected amount to receive
- Network fees
- Estimated completion time

## Step 4: Execute the Swap
1. Click "Swap Now" or use the AI chat to say "Swap [amount] [from] to [to]"
2. Review the confirmation details
3. Approve the transaction in your wallet
4. Wait for blockchain confirmation

## Step 5: Track Your Swap
- View real-time status updates
- Check transaction history in your profile
- Receive completion notification

**Pro Tips:**
- Start with small amounts to get comfortable
- Check network fees during low-traffic times
- Use the AI assistant if you have questions
- Enable price alerts for better timing
        `
      },
      {
        id: 'wallet-connection',
        title: 'Connecting Your Wallet',
        type: 'video',
        duration: '4 min',
      },
      {
        id: 'chat-interface',
        title: 'Using the AI Chat Interface',
        type: 'guide',
        duration: '8 min',
        content: `
# Using the SwapSmith AI Chat Interface

Our AI-powered chat interface makes crypto swapping as easy as having a conversation!

## What You Can Do:

### 💬 Execute Swaps
Simply tell the AI what you want:
- "Swap 0.1 ETH to USDT"
- "Exchange 100 USDT for BTC"
- "Convert all my DAI to USDC"

### 📊 Get Price Information
Ask about any cryptocurrency:
- "What's the current price of Bitcoin?"
- "Show me ETH price chart"
- "Compare BTC and ETH prices"

### 🎓 Ask Questions
Get instant help:
- "What is gas fee?"
- "How does DCA work?"
- "Explain liquidity pools"

### ⚙️ Manage Settings
Control your preferences:
- "Enable price alerts for ETH"
- "Set up DCA for $100 weekly"
- "Show my transaction history"

## Tips for Best Results:
1. **Be Specific**: "Swap 50 USDT to ETH" is better than "I want Ethereum"
2. **Use Common Symbols**: BTC, ETH, USDT instead of full names
3. **Confirm Amounts**: Double-check numbers before confirming
4. **Ask for Help**: The AI is here to guide you!

## Voice Input (Coming Soon!)
Soon you'll be able to speak your commands for hands-free trading!
        `
      },
    ],
  },
  {
    id: 'advanced-features',
    title: 'Advanced SwapSmith Features',
    description: 'Unlock the full potential of SwapSmith with advanced features',
    duration: '40 min',
    difficulty: 'Intermediate',
    category: 'swapsmith-features',
    icon: TrendingUp,
    image: '/learning/pricealerts.png',
    topics: [
      {
        id: 'terminal-mode',
        title: 'Terminal Mode for Power Users',
        type: 'guide',
        duration: '10 min',
        content: `
# SwapSmith Terminal Mode

Terminal Mode is our advanced interface designed for experienced traders who want maximum control and efficiency.

## Features:

### ⚡ Command-Line Interface
Execute swaps using powerful commands:
- Quick syntax for fast trading
- Batch operations support
- Advanced filtering and sorting

### 📊 Advanced Analytics
- Real-time order book visualization
- Technical indicators and charts
- Market depth analysis
- Volume and liquidity metrics

### 🔄 Multi-Swap Operations
- Execute multiple swaps simultaneously
- Set up complex trading strategies
- Automated execution conditions

### 📈 Professional Tools
- Price alerts with custom conditions
- Historical data export
- API access for integrations
- Custom notification rules

## Getting Started with Terminal:
1. Navigate to the Terminal tab
2. Familiarize yourself with the command syntax
3. Start with simple commands
4. Gradually explore advanced features

## Example Commands:
\`\`\`
swap 0.5 ETH to USDT
price BTC
history last 10 swaps
alert when ETH > 3000
\`\`\`

**Note**: Terminal mode requires wallet connection and basic understanding of crypto trading.
        `
      },
      {
        id: 'dca-strategy',
        title: 'Dollar Cost Averaging (DCA)',
        type: 'guide',
        duration: '12 min',
        content: `
# Dollar Cost Averaging (DCA) on SwapSmith

DCA is a smart investment strategy where you buy a fixed dollar amount of a cryptocurrency at regular intervals, regardless of price.

## Why Use DCA?

### Benefits:
- **Reduces Risk**: Smooths out price volatility
- **Removes Emotion**: Automated, no panic buying/selling
- **Builds Discipline**: Consistent investment habit
- **Ideal for Beginners**: No need to time the market

### Example:
Instead of buying $1,200 of Bitcoin once, you buy $100 every week for 12 weeks. This averages out price fluctuations.

## Setting Up DCA on SwapSmith:

1. **Go to Your Profile Settings**
2. **Navigate to DCA Section**
3. **Configure Your Strategy**:
   - Choose cryptocurrency to buy
   - Set investment amount
   - Select frequency (daily, weekly, monthly)
   - Set start date and duration

4. **Review and Activate**
   - Check summary and fees
   - Confirm wallet has sufficient balance
   - Activate your DCA plan

## Best Practices:
- Start with amounts you can comfortably afford
- Choose weekly or monthly for most people
- Review performance quarterly
- Adjust strategy as needed
- Don't stop during market dips!

## Pro Tips:
- Combine DCA with price alerts
- Use stablecoins for consistent amounts
- Track your average buy price
- Set up notifications for DCA executions

**Remember**: DCA is a long-term strategy. Stick with it for best results!
        `
      },
      {
        id: 'price-alerts',
        title: 'Setting Up Price Alerts',
        type: 'interactive',
        duration: '8 min',
        content: `
# Price Alerts & Notifications

Stay informed about market movements with SwapSmith's intelligent alert system.

## Types of Alerts:

### 1. Price Threshold Alerts
Get notified when a cryptocurrency reaches a specific price:
- "Alert me when BTC reaches $50,000"
- "Notify when ETH drops below $2,000"

### 2. Percentage Change Alerts
Track significant price movements:
- "Alert when BTC moves 5% in any direction"
- "Notify on 10% daily gain"

### 3. DCA Execution Alerts
Stay updated on your automated swaps:
- Execution confirmations
- Failed transaction alerts
- Balance warnings

### 4. Portfolio Alerts
Monitor your overall holdings:
- Total value thresholds
- Daily/weekly summaries
- Performance milestones

## How to Set Up Alerts:

### Method 1: Through Profile Settings
1. Go to Profile → Notifications
2. Click "Add New Alert"
3. Select alert type and parameters
4. Choose notification channels (email, in-app)
5. Save your alert

### Method 2: Using AI Chat
Simply tell the AI:
- "Alert me when Bitcoin reaches $45,000"
- "Notify me about 5% ETH price changes"

## Notification Channels:
- ✉️ Email notifications
- 📱 In-app notifications
- 🔔 Browser push notifications (coming soon)

## Managing Alerts:
- View all active alerts in your profile
- Edit or delete alerts anytime
- Pause alerts temporarily
- Set quiet hours

**Pro Tip**: Don't over-alert! Focus on actionable price points relevant to your strategy.
        `
      },
      {
        id: 'analytics-dashboard',
        title: 'Understanding Analytics',
        type: 'guide',
        duration: '10 min',
        content: `
# SwapSmith Analytics Dashboard

Make informed decisions with comprehensive analytics and insights.

## Available Analytics:

### 📊 Price Charts
- Interactive candlestick charts
- Multiple timeframes (1H, 1D, 1W, 1M, 1Y)
- Volume indicators
- Technical analysis tools

### 📈 Portfolio Performance
- Total portfolio value
- Historical performance
- Profit/loss tracking
- Asset allocation breakdown

### 💱 Swap History
- Complete transaction log
- Success/failure rates
- Average swap costs
- Best/worst performing swaps

### 🌐 Market Overview
- Top gainers and losers
- Market cap rankings
- Trading volume leaders
- Trending cryptocurrencies

## How to Use Analytics:

### 1. Access Live Prices Page
View real-time data for all supported cryptocurrencies:
- Current prices
- 24h change percentages
- Market capitalization
- Trading volume

### 2. Individual Asset Analysis
Click any cryptocurrency to see:
- Detailed price charts
- Historical performance
- Price predictions (coming soon)
- Related news and updates

### 3. Portfolio Tracking
Monitor your holdings:
- Current value
- Cost basis
- Unrealized gains/losses
- Performance vs market

## Reading Charts:

### Candlestick Basics:
- **Green Candle**: Price went up
- **Red Candle**: Price went down
- **Wick**: High and low points
- **Body**: Opening and closing prices

### Key Indicators:
- **Moving Averages**: Trend direction
- **Volume Bars**: Trading activity
- **Support/Resistance**: Key price levels

**Remember**: Past performance doesn't guarantee future results. Use analytics as one tool in your decision-making process.
        `
      },
    ],
  },
  {
    id: 'security-best-practices',
    title: 'Security & Best Practices',
    description: 'Learn how to keep your cryptocurrency safe and secure',
    duration: '35 min',
    difficulty: 'Intermediate',
    category: 'security',
    icon: Shield,
    image: '/learning/blockchain.png',
    topics: [
      {
        id: 'wallet-security',
        title: 'Securing Your Wallet',
        type: 'guide',
        duration: '10 min',
        content: `
# Wallet Security Best Practices

Protecting your cryptocurrency starts with securing your wallet. Follow these essential guidelines:

## Critical Security Rules:

### 🔐 Protect Your Seed Phrase
- **Write it down** on paper (never digital)
- **Store in a safe place** (fireproof safe, safety deposit box)
- **Never share** with anyone, including SwapSmith support
- **Never store** on your computer or cloud
- **Make backups** in multiple secure locations

### 🔒 Protect Your Private Keys
- Never enter private keys on websites
- Don't screenshot or photograph them
- Use hardware wallets for large amounts
- Keep separate from seed phrase backup

### 💻 Device Security
- Use antivirus software
- Keep OS and software updated
- Avoid public WiFi for transactions
- Use a dedicated device for large holdings

## Common Attacks to Avoid:

### Phishing
- Double-check URLs (swapsmith.com, not swapsmith-support.com)
- Never click suspicious email links
- Verify official social media accounts
- SwapSmith will NEVER ask for your seed phrase

### Malware
- Only download wallets from official sites
- Scan files before opening
- Use browser extensions from official stores
- Be cautious of fake wallet apps

### Social Engineering
- Don't trust "support" reaching out first
- Verify identities before sharing info
- Be skeptical of "too good to be true" offers
- Research before investing in new projects

## Wallet Security Checklist:
- ✅ Seed phrase backed up safely
- ✅ Strong, unique password
- ✅ Two-factor authentication enabled
- ✅ Device security software updated
- ✅ Regular security audits
- ✅ Separate wallets for different amounts

**Remember**: You are your own bank. Security is your responsibility!
        `
      },
      {
        id: 'swapsmith-security',
        title: 'SwapSmith Security Features',
        type: 'guide',
        duration: '8 min',
        content: `
# How SwapSmith Protects You

SwapSmith is built with security as the top priority. Here's how we keep you safe:

## Non-Custodial Architecture
- **You control your funds**: SwapSmith never holds your cryptocurrency
- **Direct wallet integration**: Swaps happen directly from your wallet
- **No deposits required**: Never send funds to SwapSmith addresses

## Smart Contract Security
- Audited swap protocols
- Transparent fee structure
- Slippage protection
- Transaction simulation before execution

## Data Protection
- Encrypted communications
- Secure authentication (Firebase)
- No sensitive data storage
- Privacy-focused design

## Transaction Safety Features:

### Pre-Swap Verification
Before executing, SwapSmith shows you:
- Exact amounts and rates
- Network fees
- Estimated completion time
- Total cost breakdown

### Confirmation Steps
- Review swap details
- Confirm in chat interface
- Approve in your wallet
- Multi-step prevents accidental swaps

### Failed Transaction Protection
- Automatic refunds for failed swaps
- Clear error messages
- Support for resolution
- Transaction history tracking

## Account Security:

### Authentication
- Secure Firebase authentication
- Email verification required
- Password strength requirements
- Session management

### Profile Protection
- Two-factor authentication option
- Account activity monitoring
- Logout from all devices option
- Profile privacy settings

## Best Practices When Using SwapSmith:

1. **Always verify swap details** before confirming
2. **Start with small test swaps** when learning
3. **Check network fees** during high traffic
4. **Use official SwapSmith URL** only
5. **Enable all security features** in settings
6. **Report suspicious activity** immediately

## What SwapSmith Will NEVER Do:
- ❌ Ask for your seed phrase or private keys
- ❌ Request remote access to your device
- ❌ Promise guaranteed returns
- ❌ Pressure you to swap immediately
- ❌ Contact you asking for funds

**Stay Safe**: If something feels wrong, it probably is. Take your time and verify everything!
        `
      },
      {
        id: 'common-scams',
        title: 'Recognizing and Avoiding Scams',
        type: 'guide',
        duration: '12 min',
        content: `
# Common Crypto Scams and How to Avoid Them

The crypto space has opportunities, but also scammers. Learn to protect yourself:

## Top Scams to Watch For:

### 1. Fake Support Scams
**How it works:**
- Scammers pretend to be customer support
- Reach out via DM after you post questions
- Ask for seed phrase or private keys
- Offer to "help" fix issues remotely

**How to avoid:**
- Real support never DMs first
- Never share seed phrase or keys
- Use official support channels only
- Verify accounts with official badges

### 2. Phishing Websites
**How it works:**
- Fake sites look identical to real ones
- URLs are slightly different (swapsmlth.com)
- Steal credentials and wallet info
- Drain connected wallets

**How to avoid:**
- Bookmark the real SwapSmith URL
- Check URL before connecting wallet
- Look for HTTPS and security indicators
- Use hardware wallet for approvals

### 3. Pump and Dump Schemes
**How it works:**
- Group artificially inflates token price
- Encourage others to buy
- Original group sells at peak
- Late buyers lose money

**How to avoid:**
- Research before buying
- Avoid "guaranteed gains" promises
- Don't FOMO into unknown tokens
- Stick to established cryptocurrencies

### 4. Fake Giveaways
**How it works:**
- Claim to double your crypto
- "Elon Musk is giving away Bitcoin!"
- Ask you to send crypto first
- You never receive anything back

**How to avoid:**
- If it sounds too good to be true, it is
- Legitimate giveaways never ask for crypto first
- Verify social media accounts
- Don't trust random messages

### 5. Rug Pulls
**How it works:**
- New project with big promises
- Developers abandon project
- Take all invested funds
- Token becomes worthless

**How to avoid:**
- Research team background
- Check contract audits
- Look for locked liquidity
- Stick to established projects initially

## Red Flags to Watch For:
🚩 Guaranteed returns or "100% safe"
🚩 Pressure to act immediately
🚩 Requests for seed phrase/private keys
🚩 Too-good-to-be-true offers
🚩 Unverified social media contacts
🚩 Spelling errors in official communications
🚩 Requests to send crypto first
🚩 Unknown tokens with huge promises

## What to Do If Scammed:

1. **Don't panic**, but act quickly
2. **Move remaining funds** to new wallet
3. **Document everything** (screenshots, addresses)
4. **Report to authorities** (IC3.gov, FTC)
5. **Warn others** in community
6. **Learn from experience** to avoid repeat

## SwapSmith Safety Pledge:

We will NEVER:
- Ask for your seed phrase or private keys
- DM you first on social media
- Guarantee investment returns
- Pressure you to swap immediately
- Request cryptocurrency for "verification"

**Stay Vigilant**: In crypto, you're your own bank. That means you're also your own security team!
        `
      },
      {
        id: 'gas-fees',
        title: 'Understanding Gas Fees',
        type: 'guide',
        duration: '5 min',
        content: `
# Understanding Gas Fees

Gas fees are the cost of executing transactions on blockchain networks. Here's what you need to know:

## What Are Gas Fees?

Gas fees are payments made to compensate for the computing energy required to process and validate transactions on a blockchain.

### Think of it like:
- **Mailing a package**: Heavier package = higher postage
- **Complex transaction**: More computation = higher gas fee

## Factors Affecting Gas Fees:

### 1. Network Congestion
- More users = higher fees
- Peak times = expensive
- Low activity = cheaper fees

### 2. Transaction Complexity
- Simple transfer = low fee
- Smart contract interaction = higher fee
- Multiple operations = highest fee

### 3. Gas Price
- You can set how much you're willing to pay
- Higher gas price = faster processing
- Lower gas price = slower (or failed) transaction

## Gas Fees on Different Networks:

| Network | Typical Fee | Speed |
|---------|------------|-------|
| Ethereum | $5-$50 | 15 sec - 5 min |
| Polygon | $0.01-$0.10 | 2-5 sec |
| BSC | $0.10-$1 | 3-5 sec |
| Bitcoin | $1-$10 | 10-60 min |

*Fees vary significantly based on network congestion*

## Tips to Save on Gas Fees:

### 1. Time Your Transactions
- Avoid peak hours (US business hours)
- Weekends often cheaper
- Check gas trackers before swapping

### 2. Use Layer 2 Solutions
- Polygon, Optimism, Arbitrum
- Same security, lower fees
- SwapSmith supports multiple networks

### 3. Batch Transactions
- Combine multiple swaps
- Use DCA for regular purchases
- Plan ahead to minimize transaction count

### 4. Choose the Right Network
- Consider fees when selecting network
- Balance speed vs cost
- Some tokens available on multiple chains

## Gas Fees on SwapSmith:

SwapSmith shows you:
- Estimated gas fee before swap
- Network fee breakdown
- Best network recommendations
- Historical gas price charts

**Pro Tip**: Use the "Live Prices" page to check current gas prices before making swaps. Save money by timing your transactions wisely!
        `
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
    image: '/learning/swapsmith2.png',
    topics: [
      {
        id: 'market-analysis',
        title: 'Basic Market Analysis',
        type: 'guide',
        duration: '15 min',
      },
      {
        id: 'risk-management',
        title: 'Risk Management',
        type: 'guide',
        duration: '12 min',
      },
      {
        id: 'portfolio-diversification',
        title: 'Portfolio Diversification',
        type: 'guide',
        duration: '10 min',
      },
      {
        id: 'advanced-strategies',
        title: 'Advanced Trading Strategies',
        type: 'guide',
        duration: '8 min',
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function LearnPage() {
  const { showAd: showFeatureAd, dismiss: dismissFeatureAd } = useLearnFullPageAd()
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [completedTopics, setCompletedTopics] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const hasLoadedProgress = useRef(false)

  // Load progress from localStorage on mount and when user changes
  useEffect(() => {
    if (user?.uid && !hasLoadedProgress.current) {
      hasLoadedProgress.current = true
      
      // Save Firebase UID for API calls
      localStorage.setItem('firebase-uid', user.uid)
      
      // Load from localStorage first (instant feedback)
      const saved = localStorage.getItem(`learn-progress-${user.uid}`)
      if (saved) {
        try {
          const parsedData = JSON.parse(saved) as string[]
          queueMicrotask(() => setCompletedTopics(new Set(parsedData)))
        } catch (error) {
          console.error('Failed to load learning progress:', error)
        }
      }
      
      // Then load from database (source of truth)
      async function loadDatabaseProgress() {
        try {
          const { authenticatedFetch } = await import('@/lib/api-client')
          const response = await authenticatedFetch('/api/rewards/courses')
          
          if (response.ok) {
            const courses = await response.json()
            // Merge all completed modules from all courses
            const allCompleted = new Set<string>()
            courses.forEach((course: { completedModules?: string[] }) => {
              course.completedModules?.forEach((moduleId: string) => {
                allCompleted.add(moduleId)
              })
            })
            
            setCompletedTopics(allCompleted)
            // Update localStorage with database data
            if (user?.uid) {
              localStorage.setItem(`learn-progress-${user.uid}`, JSON.stringify([...allCompleted]))
            }
          }
        } catch (error) {
          console.error('Error loading progress from database:', error)
        }
      }
      
      loadDatabaseProgress()
    } else if (!user?.uid) {
      hasLoadedProgress.current = false
      queueMicrotask(() => setCompletedTopics(new Set()))
    }
  }, [user?.uid])

  const categories = [
    { id: 'all', label: 'All Modules', icon: BookOpen },
    { id: 'crypto-basics', label: 'Crypto Basics', icon: DollarSign },
    { id: 'swapsmith-features', label: 'SwapSmith Features', icon: Zap },
    { id: 'advanced-trading', label: 'Advanced Trading', icon: TrendingUp },
    { id: 'security', label: 'Security', icon: Shield },
  ]

  const filteredModules = learningModules.filter((module) => {
    const matchesCategory = selectedCategory === 'all' || module.category === selectedCategory
    const matchesSearch =
      !searchQuery ||
      module.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      module.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const getModuleProgress = (module: LearningModule) => {
    const completed = module.topics.filter((topic) => completedTopics.has(topic.id)).length
    return Math.round((completed / module.topics.length) * 100)
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner':
        return 'text-green-400 bg-green-500/10'
      case 'Intermediate':
        return 'text-yellow-400 bg-yellow-500/10'
      case 'Advanced':
        return 'text-red-400 bg-red-500/10'
      default:
        return 'text-gray-400 bg-gray-500/10'
    }
  }



  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col">
      {showFeatureAd && <FullPageAd variant="features" duration={10000} onDismiss={dismissFeatureAd} />}
      <Navbar />
      <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 flex-1 w-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, type: 'spring' }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 border border-blue-500/20 rounded-full mb-4 shadow-lg animate-pulse">
            <BookOpen className="w-4 h-4 text-white drop-shadow" />
            <span className="text-sm font-semibold text-white tracking-wide">Learning Center</span>
          </div>

          <h1 className="text-5xl sm:text-6xl font-black mb-4 bg-gradient-to-r from-cyan-400 via-blue-300 to-purple-400 bg-clip-text text-transparent drop-shadow-lg animate-gradient-x">
            Master Crypto & SwapSmith
          </h1>

          <p className="text-lg text-zinc-300 max-w-2xl mx-auto animate-fade-in">
            Comprehensive guides, tutorials, and resources to help you become a crypto expert
          </p>

          {/* Search Bar */}
          <div className="mt-8 max-w-xl mx-auto">
            <input
              type="text"
              placeholder="Search learning modules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-900 border border-cyan-500/40 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-cyan-400 transition-colors shadow-md"
            />
          </div>
        </motion.div>

        {/* Category Filter */}
<div className="flex flex-wrap gap-4 mb-12 justify-center">
  {categories.map((category) => (
    <button
      key={category.id}
      onClick={() => setSelectedCategory(category.id)}
      className={`relative px-6 py-2 rounded-full font-medium text-sm transition-all duration-300 border
      ${
        selectedCategory === category.id
          ? "bg-gradient-to-r from-indigo-500 to-cyan-500 text-white border-transparent shadow-lg shadow-indigo-500/30 scale-105"
          : "bg-white/5 text-zinc-400 border-white/10 hover:border-indigo-500/40 hover:text-white hover:bg-indigo-500/10 hover:scale-105"
      }`}
    >
      <div className="flex items-center gap-2">
        <category.icon className="w-4 h-4" />
        {category.label}
      </div>
    </button>
  ))}
</div>





        {/* Learning Modules Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-12 max-w-[1800px] mx-auto">
          {filteredModules.map((module, index) => {
            const progress = getModuleProgress(module)
            const Icon = module.icon

            return (
              <motion.div
  key={module.id}
  initial={{ opacity: 0, y: 30 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: index * 0.1 }}
  whileHover={{ y: -8 }}
  className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden transition-all duration-500 hover:border-indigo-500/60 hover:shadow-[0_0_40px_rgba(99,102,241,0.25)] group"
>
  {/* Glow Overlay */}
  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 via-transparent to-cyan-500/0 group-hover:from-indigo-500/10 group-hover:to-cyan-500/10 transition-all duration-500 pointer-events-none"></div>

  {/* Module Image */}
  {module.image && (
    <div className="relative h-52 w-full overflow-hidden">
      <Image
        src={module.image}
        alt={module.title}
        fill
        className="object-cover transition-transform duration-700 group-hover:scale-110"
        sizes="(max-width: 1024px) 100vw, 50vw"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
    </div>
  )}

  {/* Content */}
  <div className="relative p-6">
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-indigo-500/10 rounded-xl group-hover:bg-indigo-500/20 transition">
          <Icon className="w-6 h-6 text-indigo-400 group-hover:text-cyan-400 transition" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white group-hover:text-indigo-300 transition">
            {module.title}
          </h3>
          <p className="text-sm text-zinc-400">
            {module.description}
          </p>
        </div>
      </div>

      <button
        onClick={() => router.push(`/learn/${module.id}`)}
        className="relative px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-500 text-white text-sm font-semibold transition-all duration-300 hover:shadow-[0_0_20px_rgba(99,102,241,0.6)] active:scale-95"
      >
        Start
      </button>
    </div>

    {/* Meta */}
    <div className="flex flex-wrap items-center gap-3 mb-5">
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getDifficultyColor(module.difficulty)}`}>
        {module.difficulty}
      </span>

      <span className="flex items-center gap-1 text-xs text-zinc-400">
        <Clock className="w-3 h-3" />
        {module.duration}
      </span>

      <span className="flex items-center gap-1 text-xs text-zinc-400">
        <FileText className="w-3 h-3" />
        {module.topics.length} topics
      </span>
    </div>

    {/* Progress */}
    <div>
      <div className="flex justify-between text-xs mb-2">
        <span className="text-zinc-500">Progress</span>
        <span className="text-indigo-400 font-semibold">{progress}%</span>
      </div>

      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8 }}
          className="h-full bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400 shadow-[0_0_10px_rgba(99,102,241,0.6)]"
        />
      </div>
    </div>
  </div>
</motion.div>
            )
          })}
        </div>

        {/* No Results */}
        {filteredModules.length === 0 && (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-500">No modules found matching your criteria</p>
          </div>
        )}

        {/* Help Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/20 rounded-xl p-8 text-center"
        >
          <Lightbulb className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
          <h3 className="text-2xl font-bold mb-2">Need More Help?</h3>
          <p className="text-zinc-400 mb-6">
            Join our community discussions or chat with our AI assistant for instant answers
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <button
              onClick={() => router.push('/discussions')}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
            >
              <Users className="w-5 h-5" />
              Join Discussions
            </button>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
            >
              <Zap className="w-5 h-5" />
              Chat with AI
            </button>
          </div>
        </motion.div>
      </div>
      <Footer />
    </div>
  )
}
