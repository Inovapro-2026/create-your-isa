"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDb = initDb;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const dbPath = path_1.default.resolve(__dirname, '../../database/isa_clients.db');
const dbDir = path_1.default.dirname(dbPath);
if (!fs_1.default.existsSync(dbDir)) {
    fs_1.default.mkdirSync(dbDir, { recursive: true });
}
const db = new better_sqlite3_1.default(dbPath);
// Initialize tables
function initDb() {
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
exports.default = db;
