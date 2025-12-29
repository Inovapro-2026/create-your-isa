"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroqService = void 0;
const axios_1 = __importDefault(require("axios"));
const db_1 = __importDefault(require("./db"));
const GROQ_API_KEY = process.env.GROQ_API_KEY || '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';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
class GroqService {
    async getClientConfig(clientId) {
        const stmt = db_1.default.prepare('SELECT * FROM clients_ia_config WHERE client_id = ?');
        const row = stmt.get(clientId);
        if (!row)
            return null;
        // Parse JSON fields
        return {
            ...row,
            allowed_emojis: JSON.parse(row.allowed_emojis || '[]'),
            products_knowledge: JSON.parse(row.products_knowledge || '[]'),
            faqs: JSON.parse(row.faqs || '[]'),
            behavior_rules: JSON.parse(row.behavior_rules || '[]'),
            active_triggers: JSON.parse(row.active_triggers || '[]'),
        };
    }
    buildPrompt(config, userMessage, context) {
        const { personality, tone, formality_level, allowed_emojis, products_knowledge, faqs, behavior_rules } = config;
        let prompt = `Você é a ISA (Inteligência de Suporte Automatizado), assistente da ${config.client_id}.\n\n`;
        prompt += `PERSONALIDADE:\n${personality}\n\n`;
        prompt += `TOM DE VOZ:\n${tone}\n\n`;
        if (products_knowledge.length > 0) {
            prompt += `CONHECIMENTO ESPECÍFICO:\nPRODUTOS/SERVIÇOS:\n`;
            products_knowledge.forEach((p) => {
                prompt += `- ${p.name || p.product_name}: ${p.description} ${p.price ? `(${p.price})` : ''}\n`;
            });
            prompt += `\n`;
        }
        if (faqs.length > 0) {
            prompt += `PERGUNTAS FREQUENTES:\n`;
            faqs.forEach((f) => {
                prompt += `- P: ${f.question} → R: ${f.answer}\n`;
            });
            prompt += `\n`;
        }
        prompt += `REGRAS DE COMPORTAMENTO:\n`;
        behavior_rules.forEach((r, index) => {
            prompt += `${index + 1}. ${r}\n`;
        });
        prompt += `\n`;
        prompt += `CONTEXTO ATUAL:\n`;
        prompt += `- Data: ${new Date().toLocaleDateString('pt-BR')}\n`;
        prompt += `- Horário: ${new Date().toLocaleTimeString('pt-BR')}\n`;
        prompt += `- Cliente em contato: ${context.contactName || 'Cliente'}\n`;
        if (context.recentMessages) {
            prompt += `- Últimas mensagens: ${context.recentMessages}\n`;
        }
        prompt += `\n`;
        prompt += `INSTRUÇÕES FINAIS:\n`;
        prompt += `- Responda em português do Brasil\n`;
        prompt += `- Seja ${formality_level}\n`;
        prompt += `- Use emojis: ${allowed_emojis.length > 0 ? 'SIM' : 'NÃO'} ${allowed_emojis.length > 0 ? `- Permitidos: ${allowed_emojis.join(', ')}` : ''}\n`;
        prompt += `- Se não souber, direcione para atendimento humano\n`;
        prompt += `- Mantenha respostas objetivas mas completas\n\n`;
        prompt += `MENSAGEM DO USUÁRIO: "${userMessage}"`;
        return prompt;
    }
    async generateResponse(clientId, userMessage, context = {}) {
        try {
            const config = await this.getClientConfig(clientId);
            if (!config) {
                throw new Error(`Configuration not found for client ${clientId}`);
            }
            // Check triggers locally first (optimization)
            const trigger = config.active_triggers.find((t) => userMessage.toLowerCase().includes(t.trigger_word.toLowerCase()));
            if (trigger) {
                return trigger.response;
            }
            const prompt = this.buildPrompt(config, userMessage, context);
            const response = await axios_1.default.post(GROQ_API_URL, {
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: prompt }, // Using system role for instructions might be better, or put it all in user message as requested. The prompt structure provided puts it all in one block. I'll stick to the provided structure but put it in 'system' or 'user'. The prompt says "Você é a...". This is usually system prompt.
                    // However, Groq/OpenAI models work well with System prompts.
                    // Let's split: System prompt contains the instructions, User prompt contains the message.
                    // But the template provided is a single block. I will use the template as the system prompt and just the user message as user prompt? 
                    // The template ends with 'MENSAGEM DO USUÁRIO: "[MENSAGEM_RECEBIDA]"'. So it seems it expects everything in one prompt.
                    // I will put the whole constructed string into the 'user' content for simplicity, or 'system' content. 
                    // Let's use 'user' role for the whole block if we follow the template strictly.
                    // Actually, best practice is System: "You are...", User: "Message". 
                    // But to follow the template EXACTLY:
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 1024
            }, {
                headers: {
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            let aiResponse = response.data.choices[0].message.content;
            // Filter emojis if needed (redundant if prompt instructions work, but good as backup)
            if (config.allowed_emojis.length === 0) {
                // Regex to remove emojis
                aiResponse = aiResponse.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
            }
            return aiResponse;
        }
        catch (error) {
            console.error('Error generating Groq response:', error);
            // Fallback
            return 'Desculpe, estou com dificuldades para responder no momento. Um atendente irá ajudá-lo em breve.';
        }
    }
}
exports.GroqService = GroqService;
exports.default = new GroqService();
