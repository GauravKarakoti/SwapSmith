import Database from 'better-sqlite3';
import type { SideShiftOrder } from './sideshift-client'; // Import type
import type { ParsedCommand } from './groq-client'; // Import type

const db = new Database('swapsmith.db');

// Define the User interface
export interface User {
  id: number;
  telegram_id: number;
  wallet_address: string;
  session_topic: string | null; // Add session_topic
}

// Define the Order interface
export interface Order {
  id: number;
  telegram_id: number;
  sideshift_order_id: string;
  quote_id: string;
  from_asset: string;
  from_network: string;
  from_amount: number;
  to_asset: string;
  to_network: string;
  settle_amount: string | number; // Store the expected settle amount
  deposit_address: string;
  deposit_memo: string | null;
  status: 'pending' | 'completed' | 'failed'; // Basic status tracking
  created_at: string;
}

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    telegram_id INTEGER UNIQUE NOT NULL,
    wallet_address TEXT,
    session_topic TEXT
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY,
    telegram_id INTEGER UNIQUE NOT NULL,
    state TEXT
  );
`);

// --- NEW: Create the 'orders' table ---
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY,
    telegram_id INTEGER NOT NULL REFERENCES users(telegram_id),
    sideshift_order_id TEXT UNIQUE NOT NULL,
    quote_id TEXT NOT NULL,
    from_asset TEXT NOT NULL,
    from_network TEXT NOT NULL,
    from_amount REAL NOT NULL,
    to_asset TEXT NOT NULL,
    to_network TEXT NOT NULL,
    settle_amount TEXT NOT NULL,
    deposit_address TEXT NOT NULL,
    deposit_memo TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);


// --- User Functions ---

export function getUser(telegramId: number): User | null {
  const stmt = db.prepare('SELECT * FROM users WHERE telegram_id = ?');
  // Cast the result to the User type
  return stmt.get(telegramId) as User | null;
}

export function setUserWalletAndSession(telegramId: number, walletAddress: string, sessionTopic: string) {
  const stmt = db.prepare(`
    INSERT INTO users (telegram_id, wallet_address, session_topic)
    VALUES (?, ?, ?)
    ON CONFLICT(telegram_id) DO UPDATE SET wallet_address = excluded.wallet_address, session_topic = excluded.session_topic;
  `);
  stmt.run(telegramId, walletAddress, sessionTopic);
}


export function clearUserWallet(telegramId: number) {
    const stmt = db.prepare('UPDATE users SET wallet_address = NULL, session_topic = NULL WHERE telegram_id = ?');
    stmt.run(telegramId);
}


// --- Conversation State Functions ---

export function getConversationState(telegramId: number) {
  const stmt = db.prepare('SELECT state FROM conversations WHERE telegram_id = ?');
  const row = stmt.get(telegramId) as { state: string } | undefined;
  return row ? JSON.parse(row.state) : null;
}

export function setConversationState(telegramId: number, state: any) {
  const stmt = db.prepare(`
    INSERT INTO conversations (telegram_id, state)
    VALUES (?, ?)
    ON CONFLICT(telegram_id) DO UPDATE SET state = excluded.state;
  `);
  console.log('Setting state for', telegramId, 'to', state);
  stmt.run(telegramId, JSON.stringify(state));
}

export function clearConversationState(telegramId: number) {
    const stmt = db.prepare('DELETE FROM conversations WHERE telegram_id = ?');
    stmt.run(telegramId);
}

// --- NEW: Order Log Functions ---

export function createOrderEntry(
  telegramId: number, 
  parsedCommand: ParsedCommand, 
  order: SideShiftOrder, 
  settleAmount: string | number,
  quoteId: string
) {
  const stmt = db.prepare(`
    INSERT INTO orders (
      telegram_id, sideshift_order_id, quote_id, 
      from_asset, from_network, from_amount, 
      to_asset, to_network, settle_amount,
      deposit_address, deposit_memo
    ) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    telegramId,
    order.id,
    quoteId,
    parsedCommand.fromAsset,
    parsedCommand.fromChain,
    parsedCommand.amount,
    parsedCommand.toAsset,
    parsedCommand.toChain,
    settleAmount.toString(),
    order.depositAddress.address,
    order.depositAddress.memo || null
  );
}

export function getUserHistory(telegramId: number): Order[] {
  const stmt = db.prepare('SELECT * FROM orders WHERE telegram_id = ? ORDER BY created_at DESC LIMIT 10');
  return stmt.all(telegramId) as Order[];
}

// TODO: Add a function like updateOrderStatus(sideshift_order_id, new_status)
// This would likely be called from a webhook handler, which is a more advanced feature.