"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionManager = void 0;
const index_1 = require("../index");
const db_1 = __importDefault(require("./db"));
const groq_1 = __importDefault(require("./groq"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const SESSIONS_DIR = path_1.default.resolve(__dirname, '../../sessions');
class SessionManager {
    constructor() {
        this.sessions = new Map();
        if (!fs_1.default.existsSync(SESSIONS_DIR)) {
            fs_1.default.mkdirSync(SESSIONS_DIR, { recursive: true });
        }
    }
    async startSession(clientId) {
        const sessionId = `cliente_${clientId}`;
        console.log(`Starting session for ${clientId} (${sessionId})`);
        // Update status in DB
        this.updateSessionStatus(sessionId, clientId, 'connecting');
        try {
            const client = await (0, index_1.create)({
                session: sessionId,
                folderNameToken: path_1.default.join(SESSIONS_DIR, sessionId, 'wpp-session'),
                catchQR: (base64Qr, asciiQR, attempts, urlCode) => {
                    console.log(`QR Code generated for ${clientId}`);
                    this.updateSessionQr(sessionId, base64Qr);
                },
                statusFind: (statusSession, session) => {
                    console.log(`Status Session for ${clientId}: ${statusSession}`);
                    this.updateSessionStatus(sessionId, clientId, statusSession);
                },
                headless: true,
                devtools: false,
                useChrome: true,
                debug: false,
                logQR: false,
                browserArgs: ['--no-sandbox', '--disable-setuid-sandbox'],
                disableWelcome: true,
                updatesLog: false,
                autoClose: 0,
            });
            this.sessions.set(clientId, client);
            this.setupMessageListener(client, clientId);
            try {
                const device = await client.getHostDevice();
                this.updateSessionPhoneInfo(sessionId, device);
            }
            catch (e) {
                console.warn('Could not get host device info yet');
            }
            this.updateSessionStatus(sessionId, clientId, 'connected');
            return { status: 'created', sessionId };
        }
        catch (error) {
            console.error(`Error creating session for ${clientId}:`, error);
            this.updateSessionStatus(sessionId, clientId, 'error');
            throw error;
        }
    }
    async getSessionStatus(clientId) {
        const sessionId = `cliente_${clientId}`;
        const stmt = db_1.default.prepare('SELECT * FROM whatsapp_sessions WHERE session_id = ?');
        const row = stmt.get(sessionId);
        // Check if connected in memory
        const client = this.sessions.get(clientId);
        const isConnected = client ? await client.isConnected() : false;
        return {
            dbStatus: row,
            isConnected
        };
    }
    async stopSession(clientId) {
        const client = this.sessions.get(clientId);
        if (client) {
            await client.close();
            this.sessions.delete(clientId);
        }
        const sessionId = `cliente_${clientId}`;
        this.updateSessionStatus(sessionId, clientId, 'disconnected');
    }
    async resetSession(clientId) {
        await this.stopSession(clientId);
        const sessionId = `cliente_${clientId}`;
        const sessionPath = path_1.default.join(SESSIONS_DIR, sessionId);
        if (fs_1.default.existsSync(sessionPath)) {
            fs_1.default.rmSync(sessionPath, { recursive: true, force: true });
        }
        const stmt = db_1.default.prepare('DELETE FROM whatsapp_sessions WHERE session_id = ?');
        stmt.run(sessionId);
        // Clear message history if requested (optional, but per plan "Limpa histórico de mensagens")
        const stmtHist = db_1.default.prepare('DELETE FROM message_history WHERE client_id = ?');
        stmtHist.run(clientId);
    }
    setupMessageListener(client, clientId) {
        client.onMessage(async (message) => {
            if (message.isGroupMsg || message.from === 'status@broadcast')
                return;
            console.log(`Message received from ${message.from} for client ${clientId}`);
            // Log incoming message
            this.logMessage(clientId, message.from, 'incoming', message.body);
            // Generate AI response
            const startTime = Date.now();
            try {
                const responseText = await groq_1.default.generateResponse(clientId, message.body, {
                    contactName: message.sender.pushname || message.sender.formattedName,
                });
                const processingTime = Date.now() - startTime;
                // Send response
                await client.sendText(message.from, responseText);
                // Log outgoing response
                this.logMessage(clientId, message.from, 'outgoing', responseText, true, processingTime);
            }
            catch (err) {
                console.error('Error in message processing loop:', err);
            }
        });
    }
    updateSessionStatus(sessionId, clientId, status) {
        const stmt = db_1.default.prepare(`
      INSERT INTO whatsapp_sessions (session_id, client_id, status, last_activity)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(session_id) DO UPDATE SET
      status = excluded.status,
      last_activity = excluded.last_activity
    `);
        stmt.run(sessionId, clientId, status);
    }
    updateSessionQr(sessionId, qrCode) {
        const stmt = db_1.default.prepare(`
      UPDATE whatsapp_sessions 
      SET qr_code = ?, status = 'qr_ready', last_activity = datetime('now')
      WHERE session_id = ?
    `);
        stmt.run(qrCode, sessionId);
    }
    updateSessionPhoneInfo(sessionId, info) {
        const stmt = db_1.default.prepare(`
      UPDATE whatsapp_sessions 
      SET phone_info = ?, last_activity = datetime('now')
      WHERE session_id = ?
    `);
        stmt.run(JSON.stringify(info), sessionId);
    }
    logMessage(clientId, contactNumber, direction, content, aiUsed = false, responseTime = 0) {
        const stmt = db_1.default.prepare(`
      INSERT INTO message_history (client_id, contact_number, message_direction, message_content, ai_used, response_time_ms, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `);
        stmt.run(clientId, contactNumber, direction, content, aiUsed ? 1 : 0, responseTime);
    }
}
exports.SessionManager = SessionManager;
exports.default = new SessionManager();
