import { create, Whatsapp } from '../index';
import db from './db';
import groqService from './groq';
import path from 'path';
import fs from 'fs';

const SESSIONS_DIR = path.resolve(__dirname, '../../sessions');

export class SessionManager {
  private sessions: Map<string, Whatsapp> = new Map();

  constructor() {
    if (!fs.existsSync(SESSIONS_DIR)) {
      fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    }
  }

  async startSession(clientId: string) {
    const sessionId = `cliente_${clientId}`;
    console.log(`Starting session for ${clientId} (${sessionId})`);

    // Update status in DB
    this.updateSessionStatus(sessionId, clientId, 'connecting');

    try {
      const client = await create({
        session: sessionId,
        folderNameToken: path.join(SESSIONS_DIR, sessionId, 'wpp-session'),
        catchQR: (base64Qr, asciiQR, attempts, urlCode) => {
          console.log(`QR Code generated for ${clientId}`);
          console.log(`QR Code format check - Length: ${base64Qr?.length}, Starts with: ${base64Qr?.substring(0, 50)}`);
          // Verificar se é base64 válido e adicionar prefixo se necessário
          let validBase64 = base64Qr;
          if (base64Qr && !base64Qr.startsWith('data:image')) {
            validBase64 = `data:image/png;base64,${base64Qr}`;
          }
          this.updateSessionQr(sessionId, validBase64);
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
      } catch (e) {
        console.warn('Could not get host device info yet');
      }
      
      this.updateSessionStatus(sessionId, clientId, 'connected');

      return { status: 'created', sessionId };
    } catch (error) {
      console.error(`Error creating session for ${clientId}:`, error);
      this.updateSessionStatus(sessionId, clientId, 'error');
      throw error;
    }
  }

  async getSessionStatus(clientId: string) {
    const sessionId = `cliente_${clientId}`;
    const stmt = db.prepare('SELECT * FROM whatsapp_sessions WHERE session_id = ?');
    const row = stmt.get(sessionId) as any;
    
    // Check if connected in memory
    const client = this.sessions.get(clientId);
    const isConnected = client ? await client.isConnected() : false;

    return {
      dbStatus: row,
      isConnected
    };
  }

  async stopSession(clientId: string) {
    const client = this.sessions.get(clientId);
    if (client) {
      await client.close();
      this.sessions.delete(clientId);
    }
    const sessionId = `cliente_${clientId}`;
    this.updateSessionStatus(sessionId, clientId, 'disconnected');
  }

  async resetSession(clientId: string) {
    await this.stopSession(clientId);
    
    const sessionId = `cliente_${clientId}`;
    const sessionPath = path.join(SESSIONS_DIR, sessionId);
    
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
    }

    const stmt = db.prepare('DELETE FROM whatsapp_sessions WHERE session_id = ?');
    stmt.run(sessionId);
    
    // Clear message history if requested (optional, but per plan "Limpa histórico de mensagens")
    const stmtHist = db.prepare('DELETE FROM message_history WHERE client_id = ?');
    stmtHist.run(clientId);
  }

  private setupMessageListener(client: Whatsapp, clientId: string) {
    client.onMessage(async (message) => {
      if (message.isGroupMsg || message.from === 'status@broadcast') return;

      console.log(`Message received from ${message.from} for client ${clientId}`);

      // Log incoming message
      this.logMessage(clientId, message.from, 'incoming', message.body);

      // Generate AI response
      const startTime = Date.now();
      try {
        const responseText = await groqService.generateResponse(clientId, message.body, {
          contactName: message.sender.pushname || message.sender.formattedName,
        });
        const processingTime = Date.now() - startTime;

        // Send response
        await client.sendText(message.from, responseText);

        // Log outgoing response
        this.logMessage(clientId, message.from, 'outgoing', responseText, true, processingTime);
      } catch (err) {
        console.error('Error in message processing loop:', err);
      }
    });
  }

  private updateSessionStatus(sessionId: string, clientId: string, status: string) {
    const stmt = db.prepare(`
      INSERT INTO whatsapp_sessions (session_id, client_id, status, last_activity)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(session_id) DO UPDATE SET
      status = excluded.status,
      last_activity = excluded.last_activity
    `);
    stmt.run(sessionId, clientId, status);
  }

  private updateSessionQr(sessionId: string, qrCode: string) {
    const stmt = db.prepare(`
      UPDATE whatsapp_sessions 
      SET qr_code = ?, status = 'qr_ready', last_activity = datetime('now')
      WHERE session_id = ?
    `);
    stmt.run(qrCode, sessionId);
  }

  private updateSessionPhoneInfo(sessionId: string, info: any) {
    const stmt = db.prepare(`
      UPDATE whatsapp_sessions 
      SET phone_info = ?, last_activity = datetime('now')
      WHERE session_id = ?
    `);
    stmt.run(JSON.stringify(info), sessionId);
  }

  private logMessage(clientId: string, contactNumber: string, direction: string, content: string, aiUsed: boolean = false, responseTime: number = 0) {
    const stmt = db.prepare(`
      INSERT INTO message_history (client_id, contact_number, message_direction, message_content, ai_used, response_time_ms, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    stmt.run(clientId, contactNumber, direction, content, aiUsed ? 1 : 0, responseTime);
  }
}

export default new SessionManager();
