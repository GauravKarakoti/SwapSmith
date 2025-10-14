import Database from 'better-sqlite3';

const db = new Database('swapsmith.db');

// Define the User interface
export interface User {
  id: number;
  telegram_id: number;
  wallet_address: string;
}

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    telegram_id INTEGER UNIQUE NOT NULL,
    wallet_address TEXT
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY,
    telegram_id INTEGER UNIQUE NOT NULL,
    state TEXT
  );
`);

// --- User Functions ---

export function getUser(telegramId: number): User | null {
  const stmt = db.prepare('SELECT * FROM users WHERE telegram_id = ?');
  // Cast the result to the User type
  return stmt.get(telegramId) as User | null;
}

export function setUserWalletAddress(telegramId: number, walletAddress: string) {
  const stmt = db.prepare(`
    INSERT INTO users (telegram_id, wallet_address) 
    VALUES (?, ?)
    ON CONFLICT(telegram_id) DO UPDATE SET wallet_address = excluded.wallet_address;
  `);
  stmt.run(telegramId, walletAddress);
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
  stmt.run(telegramId, JSON.stringify(state));
}

export function clearConversationState(telegramId: number) {
    const stmt = db.prepare('DELETE FROM conversations WHERE telegram_id = ?');
    stmt.run(telegramId);
}