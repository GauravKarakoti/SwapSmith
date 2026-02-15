# Shared Database Schema

This directory contains the centralized database schema and Drizzle configuration used by both the bot and frontend applications.

## Structure

```
shared/
├── schema.ts           # All pgTable definitions
├── drizzle.config.ts   # Drizzle-Kit configuration
├── package.json        # Package configuration
└── README.md          # This file
```

## Schema Organization

### Bot Tables
- `users` - Telegram user information
- `conversations` - Conversation state management
- `orders` - Swap orders from SideShift
- `checkouts` - Checkout sessions
- `addressBook` - Saved wallet addresses
- `watchedOrders` - Orders being monitored
- `dcaSchedules` - Dollar Cost Averaging schedules
- `limitOrders` - Limit order configurations

### Shared Tables
- `coinPriceCache` - Cached cryptocurrency prices
- `userSettings` - User preferences and settings

### Frontend Tables
- `swapHistory` - Swap transaction history
- `chatHistory` - Chat conversation history
- `discussions` - Community discussions

## Usage

### In Bot (`bot/src/services/database.ts`)
```typescript
import { users, orders, /* ... */ } from '../../../shared/schema';
```

### In Frontend (`frontend/lib/database.ts`)
```typescript
import { coinPriceCache, swapHistory, /* ... */ } from '../../shared/schema';
```

## Database Migrations

Run migrations from the shared directory:

```bash
cd shared
npm run db:generate  # Generate migration files
npm run db:migrate   # Apply migrations
npm run db:studio    # Open Drizzle Studio
npm run db:push      # Push schema directly (dev only)
```

## Benefits

✅ **Single Source of Truth**: All table definitions in one place  
✅ **No Duplication**: Schema changes only need to be made once  
✅ **Type Safety**: Shared types ensure consistency  
✅ **Easier Maintenance**: Centralized schema management  
✅ **Clear Organization**: Separate concerns from application logic  

## Adding New Tables

1. Add table definition to `schema.ts`
2. Export the table
3. Run `npm run db:generate` to create migration
4. Import in bot or frontend as needed

## Notes

- This directory should NOT contain application logic
- Only database schema and Drizzle configuration
- Both bot and frontend import from this shared schema
- Migrations are generated and stored in `shared/drizzle/`
