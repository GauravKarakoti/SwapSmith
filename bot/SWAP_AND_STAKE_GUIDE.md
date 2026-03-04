# Swap and Stake Feature Guide

## Overview

The "Swap and Stake" feature allows users to execute a two-step DeFi operation in a single command:
1. Swap one asset for another (via SideShift)
2. Automatically stake the received asset in a yield-generating protocol

This eliminates the need for manual steps and provides a seamless DeFi experience.

## Supported Commands

### Basic Syntax

```
swap and stake <amount> <from_asset> to <to_asset>
```

### Examples

1. **Simple swap and stake:**
   ```
   swap and stake 100 ETH to USDC
   ```

2. **Zap syntax:**
   ```
   zap 50 ETH into USDC
   ```

3. **With protocol specification:**
   ```
   swap and stake 100 ETH to USDC on aave
   ```

4. **Stake immediately:**
   ```
   swap 1 ETH to USDC and stake it
   ```

5. **Without explicit amount (uses "all"):**
   ```
   swap and stake my ETH
   ```

## Supported Protocols

The bot integrates with major DeFi yield protocols:

- **Aave V3** (Ethereum, Arbitrum, Polygon)
- **Compound V3** (Ethereum)
- **Lido** (Ethereum - for ETH staking)
- **Yearn** (Ethereum)
- **Morpho Blue** (Ethereum)
- **Euler** (Ethereum)
- **Spark** (Gnosis)

## How It Works

### Step 1: Command Parsing
The bot detects "swap and stake" intent using regex patterns:
- `swap and stake`
- `zap into/to`
- `stake after/then/immediately`
- `swap to stake`

### Step 2: Quote Generation
1. Creates a swap quote via SideShift API
2. Finds the best yield pool for the target asset
3. Calculates estimated APY and annual yield
4. Returns a comprehensive quote with both steps

### Step 3: Order Creation
1. Creates a SideShift swap order
2. Stores stake order in database with status tracking
3. Provides deposit address for the swap

### Step 4: Monitoring
The `stakeOrderWorker` runs every 2 minutes to:
1. Check swap status via SideShift API
2. When swap completes (status: "settled"):
   - Notifies user
   - Provides staking instructions
   - Shows deposit address for the yield protocol

### Step 5: Staking
Currently, the bot provides instructions for manual staking:
- Protocol name and deposit address
- Expected APY and yield
- Link to protocol website

**Future Enhancement:** Auto-staking via smart contracts or wallet integrations.

## Database Schema

### `stakeOrders` Table

```typescript
{
  id: number;
  telegramId: number;
  sideshiftOrderId: string;
  quoteId: string;
  fromAsset: string;
  fromNetwork: string;
  fromAmount: number;
  swapToAsset: string;
  swapToNetwork: string;
  stakeAsset: string;
  stakeProtocol: string;
  stakeNetwork: string;
  settleAmount?: string;
  depositAddress: string;
  depositMemo?: string;
  stakeAddress?: string;
  stakeTxHash?: string;
  swapStatus: 'pending' | 'processing' | 'settled' | 'failed';
  stakeStatus: 'pending' | 'submitted' | 'confirmed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}
```

## User Flow Example

### User Input
```
swap and stake 100 USDC to ETH on lido
```

### Bot Response (Quote)
```
⚡ Swap & Stake Quote

Swap:
• From: 100 USDC (Ethereum)
• To: 0.033 ETH (Ethereum)
• Rate: 1 USDC = 0.00033 ETH

Stake:
• Protocol: Lido
• Asset: ETH
• APY: 4.5%
• Est. Annual Yield: 0.0015 ETH

Steps:
1. Swap 100 USDC to ETH
2. Deposit ETH to Lido for 4.5% APY

Confirm Swap & Stake?
[✅ Yes] [❌ Cancel]
```

### After Confirmation
```
✅ Swap & Stake Order Created!

Order ID: abc123xyz

Step 1: Swap
Send 100 USDC to:
0x1234567890123456789012345678901234567890

Step 2: Stake (Automatic)
Once swap completes, you'll receive ETH in your wallet
Then follow instructions to stake on Lido

Expected APY: 4.50%
Est. Annual Yield: 0.0015 ETH

I'll notify you when each step completes! 🚀
```

### Swap Complete Notification
```
✅ Swap Complete - Ready to Stake!

Order ID: abc123xyz

Received: 0.033 ETH
Protocol: Lido
Network: Ethereum

📋 Next Steps:
1. Your ETH has been sent to your wallet
2. Visit the Lido platform to stake your tokens
3. Deposit address: 0xae7ab96520DE3A18f5e31e70f08B3B58f1dB0c9A

💡 Tip: You can also stake directly through the protocol's website for the best rates!
```

## API Integration

### SideShift Integration
- **Quote Creation:** `createQuote(fromAsset, fromNetwork, toAsset, toNetwork, amount, userIP)`
- **Order Creation:** `createOrder(quoteId, settleAddress, refundAddress, userIP)`
- **Status Polling:** `getOrderStatus(orderId)`

### Yield Protocol Integration
- **Find Best Pool:** `findBestYieldPool(asset, network)`
- **Get Deposit Address:** `getDepositAddress(pool)`
- **Enrich Pool Data:** `enrichPoolWithDepositAddress(pool)`

### Zap Functions
- **Get Quote:** `getZapQuote(fromAsset, fromNetwork, toAsset, toNetwork, amount, userIP, stakeChain?)`
- **Create Transaction:** `createZapTransaction(zapQuote, settleAddress, userIP)`
- **Format Quote:** `formatZapQuote(zapQuote)`

## Testing

Run the test suite:
```bash
npm test -- swap-and-stake.test.ts
```

Test coverage includes:
- Command parsing for various syntaxes
- Protocol detection
- Deposit address resolution
- Quote formatting
- Default values (e.g., USDC when no target specified)

## Future Enhancements

1. **Auto-Staking via Smart Contracts**
   - Deploy a zap contract that receives swapped tokens and stakes automatically
   - Eliminates manual staking step

2. **More Protocols**
   - Curve Finance
   - Convex Finance
   - Uniswap V3 LP positions
   - Balancer pools

3. **Cross-Chain Staking**
   - Swap on one chain, stake on another
   - Bridge integration

4. **Yield Optimization**
   - Automatically find and migrate to higher-yield pools
   - Rebalancing strategies

5. **Unstaking Support**
   - "Unstake and swap" commands
   - Claim rewards and reinvest

## Troubleshooting

### Common Issues

**Issue:** "No yield pool found for [asset] on [network]"
- **Solution:** The asset/network combination isn't supported yet. Try a different network or asset.

**Issue:** "Missing required fields for swap and stake"
- **Solution:** Ensure you specify amount, from asset, and to asset in your command.

**Issue:** Swap completes but staking instructions not received
- **Solution:** Check the `stakeOrders` table in the database. The worker may have encountered an error.

### Debug Mode

Enable detailed logging:
```bash
LOG_LEVEL=debug npm start
```

Check worker logs:
```bash
tail -f logs/all.log | grep StakeWorker
```

## Security Considerations

1. **Non-Custodial:** The bot never holds user funds
2. **User Confirmation:** All operations require explicit user approval
3. **Address Validation:** All addresses are validated before use
4. **Rate Limiting:** Prevents abuse and API overuse
5. **Error Handling:** Graceful failures with user notifications

## Contributing

To add support for a new protocol:

1. Add protocol info to `YIELD_PROTOCOLS` in `yield-client.ts`
2. Add deposit address and reward token info
3. Update regex patterns in `parseUserCommand.ts` if needed
4. Add tests to `swap-and-stake.test.ts`
5. Update this documentation

## License

MIT License - See LICENSE file for details
