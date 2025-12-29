import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.resolve(__dirname, '../../database/isa_clients.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db: any = new Database(dbPath);


// Initialize tables
export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients_ia_config (
      client_id TEXT PRIMARY KEY,
      personality TEXT,
      tone TEXT,
      formality_level INTEGER,
      allowed_emojis TEXT,
      products_knowledge TEXT,
      faqs TEXT,
      behavior_rules TEXT,
      active_triggers TEXT,
      last_updated DATETIME
    );

    CREATE TABLE IF NOT EXISTS whatsapp_sessions (
      session_id TEXT PRIMARY KEY,
      client_id TEXT,
      status TEXT,
      qr_code TEXT,
      phone_info TEXT,
      connection_time DATETIME,
      last_activity DATETIME
    );

    CREATE TABLE IF NOT EXISTS message_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id TEXT,
      contact_number TEXT,
      message_direction TEXT,
      message_content TEXT,
      ai_used BOOLEAN,
      response_time_ms INTEGER,
      timestamp DATETIME
    );
  `);
  console.log('Database initialized successfully');
}

export default db;
