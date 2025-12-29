import { Router, Request, Response } from 'express';
import sessionManager from './services/sessionManager';
import db from './services/db';
import groqService from './services/groq';

const router = Router();

// 1. Session Management
router.post('/sessions/create', async (req: Request, res: Response) => {
  try {
    const { client_id, client_name } = req.body;
    if (!client_id) {
        res.status(400).json({ error: 'client_id is required' });
        return;
    }

    // Ensure config exists or create default
    const stmt = db.prepare('INSERT OR IGNORE INTO clients_ia_config (client_id, personality, tone, formality_level, allowed_emojis, products_knowledge, faqs, behavior_rules, active_triggers, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime(\'now\'))');
    stmt.run(client_id, 'Assistente Virtual', 'Amigável', 'casual', '[]', '[]', '[]', '[]', '[]');

    const result = await sessionManager.startSession(client_id);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/sessions/list', (req: Request, res: Response) => {
  try {
    const stmt = db.prepare('SELECT DISTINCT client_id, client_name FROM whatsapp_sessions ORDER BY client_id');
    const sessions = stmt.all() as any[];
    
    res.json({ sessions: sessions.map(s => ({ client_id: s.client_id, client_name: s.client_name || s.client_id })) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/sessions/:client_id/reset', async (req: Request, res: Response) => {
  try {
    const { client_id } = req.params;
    await sessionManager.resetSession(client_id);
    res.json({ success: true, message: 'Sessão resetada com sucesso' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/sessions/:client_id/status', async (req: Request, res: Response) => {
  try {
    const { client_id } = req.params;
    const status = await sessionManager.getSessionStatus(client_id);
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. IA Config
router.post('/ia/config/:client_id', (req: Request, res: Response) => {
  try {
    const { client_id } = req.params;
    const {
      personality, tone, formality, allowed_emojis, products, faqs, triggers
    } = req.body;

    const stmt = db.prepare(`
      INSERT INTO clients_ia_config (
        client_id, personality, tone, formality_level, allowed_emojis, products_knowledge, faqs, active_triggers, last_updated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(client_id) DO UPDATE SET
      personality = excluded.personality,
      tone = excluded.tone,
      formality_level = excluded.formality_level,
      allowed_emojis = excluded.allowed_emojis,
      products_knowledge = excluded.products_knowledge,
      faqs = excluded.faqs,
      active_triggers = excluded.active_triggers,
      last_updated = datetime('now')
    `);

    stmt.run(
      client_id,
      personality,
      tone,
      formality, 
      JSON.stringify(allowed_emojis || []),
      JSON.stringify(products || []),
      JSON.stringify(faqs || []),
      JSON.stringify(triggers || [])
    );

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/ia/config/:client_id', (req: Request, res: Response) => {
  try {
    const { client_id } = req.params;
    const stmt = db.prepare('SELECT * FROM clients_ia_config WHERE client_id = ?');
    const row = stmt.get(client_id) as any;
    
    if (row) {
      row.allowed_emojis = JSON.parse(row.allowed_emojis || '[]');
      row.products_knowledge = JSON.parse(row.products_knowledge || '[]');
      row.faqs = JSON.parse(row.faqs || '[]');
      row.active_triggers = JSON.parse(row.active_triggers || '[]');
    }
    
    res.json(row || {});
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/ia/test/:client_id', async (req: Request, res: Response) => {
  try {
    const { client_id } = req.params;
    const { message } = req.body;
    
    const response = await groqService.generateResponse(client_id, message, { contactName: 'Teste' });
    res.json({ response });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. WhatsApp Controls
router.post('/whatsapp/:client_id/connect', async (req: Request, res: Response) => {
  try {
    const { client_id } = req.params;
    const result = await sessionManager.startSession(client_id);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/whatsapp/:client_id/disconnect', async (req: Request, res: Response) => {
  try {
    const { client_id } = req.params;
    await sessionManager.stopSession(client_id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Webhooks (Simulated reception)
router.post('/webhook/message-received', async (req: Request, res: Response) => {
  try {
    const { client_id, from, message } = req.body;
    // Process with IA
    const response = await groqService.generateResponse(client_id, message, { contactName: 'Webhook User' });
    res.json({ response });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
