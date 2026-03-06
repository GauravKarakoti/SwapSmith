# Real-Time Price Alerts System

## Overview

The Price Alerts System replaces hardcoded mock data with a fully functional real-time cryptocurrency price monitoring and notification system.

## Features

### 1. User-Configurable Price Alerts
- Set price alerts for any cryptocurrency
- Define threshold values (e.g., "alert me when BTC > $50,000")
- Support for both "greater than" (gt) and "less than" (lt) conditions
- Multiple alerts per user
- Enable/disable alerts without deleting them

### 2. Real-Time Price Monitoring
- Automated price checking every 5 minutes
- Fetches real prices from cached database (updated every 6 hours)
- Triggers email notifications when thresholds are crossed
- Automatically deactivates alerts after triggering (prevents spam)

### 3. Database Integration
- Uses existing `priceAlerts` table in schema
- Stores user preferences persistently
- Tracks alert status (active/triggered)
- Links to `coinPriceCache` for real-time data

## Architecture

### Components

1. **Price Alert Monitor** (`frontend/lib/price-alert-monitor.ts`)
   - Cron job running every 5 minutes
   - Checks all active alerts against current prices
   - Triggers notifications when conditions are met
   - Logs all activities for debugging

2. **Notification Scheduler** (`frontend/lib/notification-scheduler.ts`)
   - Removed hardcoded mock data
   - Fetches real price data from database
   - Integrates with user's active price alerts
   - Sends personalized email notifications

3. **API Endpoints** (`frontend/app/api/price-alerts/route.ts`)
   - `GET /api/price-alerts` - List user's alerts
   - `POST /api/price-alerts` - Create new alert
   - `DELETE /api/price-alerts?id={alertId}` - Delete alert
   - `PATCH /api/price-alerts` - Toggle alert active status

### Database Schema

The system uses the existing `priceAlerts` table:

```typescript
{
  id: number;
  userId: string;
  telegramId?: number;
  coin: string;
  network: string;
  name: string;
  targetPrice: numeric;
  condition: 'gt' | 'lt';
  isActive: boolean;
  triggeredAt?: timestamp;
  createdAt: timestamp;
}
```

## Usage

### Starting the Price Alert Monitor

```typescript
import { startPriceAlertMonitor } from '@/lib/price-alert-monitor';

// Start monitoring (typically in app initialization)
startPriceAlertMonitor();
```

### Creating a Price Alert via API

```typescript
POST /api/price-alerts
Authorization: Bearer <firebase-token>

{
  "coin": "BTC",
  "network": "bitcoin",
  "name": "Bitcoin",
  "targetPrice": "50000",
  "condition": "gt"  // or "lt"
}
```

### Managing Alerts

```typescript
// Get all alerts
GET /api/price-alerts
Authorization: Bearer <firebase-token>

// Toggle alert
PATCH /api/price-alerts
Authorization: Bearer <firebase-token>
{
  "alertId": 123,
  "isActive": false
}

// Delete alert
DELETE /api/price-alerts?id=123
Authorization: Bearer <firebase-token>
```

## Configuration

### Environment Variables

No additional environment variables required. The system uses:
- Existing `DATABASE_URL` for database access
- Existing email configuration for notifications

### Cron Schedule

- **Price Alert Monitor**: Every 5 minutes (`*/5 * * * *`)
- **Price Refresh**: Every 6 hours (`0 */6 * * *`)

You can adjust these in the respective files.

## Logging

All operations are logged using the structured Winston logger:

```typescript
logger.info('[Price Alert Monitor] Alert triggered', {
  alertId: 123,
  coin: 'BTC',
  condition: 'gt',
  targetPrice: 50000,
  currentPrice: 51000
});
```

## Security

- All API endpoints require Firebase authentication
- User can only access/modify their own alerts
- Input validation on all endpoints
- SQL injection protection via Drizzle ORM

## Testing

### Manual Testing

```typescript
import { triggerManualAlertCheck } from '@/lib/price-alert-monitor';

// Manually trigger alert check
await triggerManualAlertCheck();
```

### Test Scenarios

1. Create alert with BTC > $50,000
2. Wait for price to cross threshold
3. Verify email notification sent
4. Confirm alert is deactivated
5. Re-enable alert and test again

## Migration from Mock Data

### Before (Hardcoded)
```typescript
const mockPrice = '45,231.50';
const mockChange = '+2.34';
await sendPriceAlertEmail(email, name, 'Bitcoin', mockPrice, mockChange);
```

### After (Real Data)
```typescript
const priceData = await getCachedPrice('BTC', 'bitcoin');
const currentPrice = parseFloat(priceData.usdPrice);
const priceChange = calculateChange(currentPrice, targetPrice);
await sendPriceAlertEmail(email, name, coinName, currentPrice, priceChange);
```

## Future Enhancements

1. **Push Notifications** - Add browser/mobile push notifications
2. **Telegram Integration** - Send alerts via Telegram bot
3. **Advanced Conditions** - Support percentage changes, moving averages
4. **Alert History** - Track all triggered alerts
5. **Batch Alerts** - Group multiple alerts in single email
6. **Custom Frequencies** - Let users choose check frequency
7. **Price Charts** - Include price charts in email notifications

## Troubleshooting

### Alerts Not Triggering

1. Check if price alert monitor is running:
   ```typescript
   // Should see log: "[Price Alert Monitor] Monitor started"
   ```

2. Verify price cache is populated:
   ```typescript
   const price = await getCachedPrice('BTC', 'bitcoin');
   console.log(price); // Should have usdPrice
   ```

3. Check alert conditions:
   ```typescript
   const alerts = await getAllActivePriceAlerts();
   console.log(alerts); // Should show active alerts
   ```

### Email Not Sending

1. Verify email service configuration
2. Check user has valid email address
3. Review email service logs

### Performance Issues

1. Reduce check frequency if needed
2. Add database indexes on frequently queried columns
3. Implement caching for user alerts

## Related Files

- `shared/schema.ts` - Database schema definitions
- `frontend/lib/database.ts` - Database query functions
- `frontend/lib/email.ts` - Email sending functions
- `frontend/lib/logger.ts` - Structured logging
- `frontend/lib/price-refresh-cron.ts` - Price cache updates

## Support

For issues or questions:
1. Check logs for error messages
2. Verify database connectivity
3. Ensure price cache is updating
4. Review API endpoint responses
