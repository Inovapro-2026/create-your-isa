const Groq = require('groq-sdk');
const { createClient } = require('@supabase/supabase-js');

// Carregar variáveis de ambiente
require('dotenv').config();

class PersonalizedIAService {
  constructor() {
    // Inicializar Groq
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY || 'gsk_8i7lCq9YnPKw0y2Ei4CJWGdyb3FYt4Gv3o3Lq8yT9q8v3Cq9YnPKw0'
    });
    
    // Inicializar Supabase
    this.supabase = createClient(
      process.env.SUPABASE_URL || 'https://your-project.supabase.co',
      process.env.SUPABASE_KEY || 'your-anon-key'
    );
    
    this.defaultConfig = {
      personality: 'Profissional e prestativa',
      tone: 'Formal mas amigável',
      formality: 'business',
      allowEmojis: false,
      signature: 'Atenciosamente,\nISA 2.5 - InovaPro',
      maxTokens: 1000,
      temperature: 0.7
    };
  }

  // Buscar configurações do cliente no Supabase
  async getClientConfig(phoneNumber) {
    try {
      console.log(`🔍 Buscando configurações para telefone: ${phoneNumber}`);
      
      // Buscar cliente pelo telefone
      const { data: clientData, error: clientError } = await this.supabase
        .from('clients')
        .select('*')
        .eq('whatsapp_phone', phoneNumber)
        .single();
      
      if (clientError || !clientData) {
        console.log(`⚠️ Cliente não encontrado para ${phoneNumber}, usando configuração padrão`);
        return { clientId: null, config: this.defaultConfig };
      }
      
      console.log(`✅ Cliente encontrado: ${clientData.name} (ID: ${clientData.id})`);
      
      // Buscar configurações de IA do cliente
      const { data: iaMemoryData, error: iaMemoryError } = await this.supabase
        .from('ia_memory')
        .select(`
          *,
          ia_memory_products (
            product_name,
            description,
            price,
            features
          ),
          ia_memory_faqs (
            question,
            answer,
            category
          ),
          ia_memory_triggers (
            trigger_word,
            response,
            attachment_url
          )
        `)
        .eq('client_id', clientData.id)
        .eq('is_active', true)
        .single();
      
      if (iaMemoryError || !iaMemoryData) {
        console.log(`⚠️ Configurações IA não encontradas para cliente ${clientData.id}, usando padrão`);
        return { clientId: clientData.id, config: this.defaultConfig };
      }
      
      console.log(`🧠 Configurações IA encontradas: ${iaMemoryData.memory_name}`);
      
      // Montar configuração personalizada
      const personalizedConfig = {
        clientId: clientData.id,
        clientName: clientData.name,
        memoryName: iaMemoryData.memory_name,
        personality: iaMemoryData.personality || this.defaultConfig.personality,
        tone: iaMemoryData.tone || this.defaultConfig.tone,
        formality: iaMemoryData.formality_level || this.defaultConfig.formality,
        allowEmojis: iaMemoryData.allow_emojis || this.defaultConfig.allowEmojis,
        signature: iaMemoryData.custom_signature || this.defaultConfig.signature,
        maxTokens: iaMemoryData.max_tokens || this.defaultConfig.maxTokens,
        temperature: this.getTemperatureByFormality(iaMemoryData.formality_level),
        products: iaMemoryData.ia_memory_products || [],
        faqs: iaMemoryData.ia_memory_faqs || [],
        triggers: iaMemoryData.ia_memory_triggers || [],
        businessHours: {
          start: iaMemoryData.business_hours_start,
          end: iaMemoryData.business_hours_end,
          timezone: iaMemoryData.timezone
        },
        transferRules: {
          enabled: iaMemoryData.enable_human_transfer,
          keywords: iaMemoryData.human_transfer_keywords || [],
          message: iaMemoryData.human_transfer_message
        },
        behaviorRules: {
          responseTime: iaMemoryData.max_response_time,
          fallbackMessage: iaMemoryData.fallback_message,
          enableTyping: iaMemoryData.enable_typing_simulation
        }
      };
      
      console.log(`🎯 Configuração personalizada carregada:`);
      console.log(`   - Personalidade: ${personalizedConfig.personality}`);
      console.log(`   - Tom: ${personalizedConfig.tone}`);
      console.log(`   - Produtos: ${personalizedConfig.products.length}`);
      console.log(`   - FAQs: ${personalizedConfig.faqs.length}`);
      console.log(`   - Triggers: ${personalizedConfig.triggers.length}`);
      
      return personalizedConfig;
      
    } catch (error) {
      console.error(`❌ Erro ao buscar configurações do cliente:`, error);
      return { clientId: null, config: this.defaultConfig };
    }
  }

  // Verificar triggers na mensagem
  checkTriggers(message, triggers) {
    const lowerMessage = message.toLowerCase();
    
    // Verificar se triggers é um array válido
    if (!Array.isArray(triggers) || triggers.length === 0) {
      return { triggered: false };
    }
    
    for (const trigger of triggers) {
      if (trigger && trigger.trigger_word && lowerMessage.includes(trigger.trigger_word.toLowerCase())) {
        console.log(`🎯 Trigger encontrado: "${trigger.trigger_word}"`);
        return {
          triggered: true,
          response: trigger.response,
          attachment: trigger.attachment_url
        };
      }
    }
    
    return { triggered: false };
  }

  // Verificar necessidade de transferência humana
  checkHumanTransfer(message, transferRules) {
    // Verificar se transferRules existe e está configurado
    if (!transferRules || !transferRules.enabled) return false;
    
    const lowerMessage = message.toLowerCase();
    
    // Verificar se keywords existe e é um array
    if (!Array.isArray(transferRules.keywords)) return false;
    
    for (const keyword of transferRules.keywords) {
      if (keyword && lowerMessage.includes(keyword.toLowerCase())) {
        console.log(`👥 Transferência humana solicitada: "${keyword}"`);
        return true;
      }
    }
    
    return false;
  }

  // Construir prompt para Groq
  buildPrompt(userMessage, config) {
    const currentTime = new Date().toLocaleString('pt-BR', { timeZone: config.businessHours?.timezone || 'America/Sao_Paulo' });
    
    let prompt = `Você é a ISA 2.5, assistente virtual da InovaPro.

INFORMAÇÕES DO CLIENTE:
- Cliente: ${config.clientName || 'Cliente'}
- Personalidade: ${config.personality}
- Tom de voz: ${config.tone}
- Nível de formalidade: ${config.formality}

REGRAS DE COMPORTAMENTO:
${config.formality === 'casual' ? '- Use linguagem descontraída e amigável' : '- Mantenha linguagem profissional e formal'}
${config.allowEmojis ? '- Use emojis apropriados para dar vida à conversa' : '- Não use emojis'}
- Seja prestativo e objetivo
- Mantenha respostas concisas e relevantes

BASE DE CONHECIMENTO:
`;

    // Adicionar produtos
    if (config.products && Array.isArray(config.products) && config.products.length > 0) {
      prompt += `PRODUTOS DO CLIENTE:\n`;
      config.products.forEach(product => {
        prompt += `- ${product.product_name}: ${product.description} (R$ ${product.price})\n`;
        if (product.features) {
          prompt += `  Características: ${product.features}\n`;
        }
      });
      prompt += `\n`;
    }

    // Adicionar FAQs
    if (config.faqs && Array.isArray(config.faqs) && config.faqs.length > 0) {
      prompt += `PERGUNTAS FREQUENTES:\n`;
      config.faqs.forEach(faq => {
        prompt += `Q: ${faq.question}\nA: ${faq.answer}\n\n`;
      });
    }

    prompt += `CONTEXTO ATUAL:
- Data/Hora: ${currentTime}
- Horário de atendimento: ${config.businessHours?.start || '09:00'} às ${config.businessHours?.end || '18:00'}

MENSAGEM DO USUÁRIO:
"${userMessage}"

INSTRUÇÕES:
1. Analise a mensagem do usuário
2. Use a personalidade e tom configurados acima
3. Consulte a base de conhecimento fornecida
4. Forneça uma resposta útil e personalizada
5. ${config.allowEmojis ? 'Use emojis se apropriado' : 'Não use emojis'}
6. Assine como: ${config.signature}

RESPOSTA PERSONALIZADA:`;

    return prompt;
  }

  // Obter temperatura baseada na formalidade
  getTemperatureByFormality(formality) {
    switch (formality) {
      case 'casual': return 0.8;
      case 'business': return 0.6;
      case 'formal': return 0.4;
      default: return 0.7;
    }
  }

  // Processar mensagem com IA personalizada
  async processMessage(userMessage, phoneNumber) {
    const startTime = Date.now();
    
    try {
      console.log(`\n🤖 Processando mensagem para ${phoneNumber}: "${userMessage}"`);
      
      // 1. Buscar configurações do cliente
      const { clientId, config } = await this.getClientConfig(phoneNumber);
      
      // 2. Verificar triggers
      const triggers = config.triggers || [];
      const triggerResult = this.checkTriggers(userMessage, triggers);
      if (triggerResult.triggered) {
        console.log(`🎯 Resposta por trigger: ${triggerResult.response}`);
        return {
          response: triggerResult.response,
          attachment: triggerResult.attachment,
          source: 'trigger',
          clientId,
          config
        };
      }
      
      // 3. Verificar transferência humana
      const transferRules = config.transferRules || { enabled: false, keywords: [], message: '' };
      if (this.checkHumanTransfer(userMessage, transferRules)) {
        return {
          response: transferRules.message || 'Estou transferindo você para um de nossos atendentes humanos. Por favor, aguarde um momento.',
          requiresHumanTransfer: true,
          source: 'transfer',
          clientId,
          config
        };
      }
      
      // 4. Construir prompt para Groq
      const prompt = this.buildPrompt(userMessage, config);
      
      // 5. Chamar API Groq
      console.log(`🔍 Enviando para Groq API...`);
      const completion = await this.groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.1-8b-instant',
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        top_p: 1,
        stream: false,
        stop: null
      });
      
      const aiResponse = completion.choices[0]?.message?.content || config.fallbackMessage || 'Desculpe, não consegui processar sua mensagem.';
      
      // 6. Pós-processar resposta
      let finalResponse = aiResponse;
      
      // Adicionar assinatura se não estiver presente
      if (!finalResponse.includes(config.signature.split('\n')[0])) {
        finalResponse += `\n\n${config.signature}`;
      }
      
      // Filtrar emojis se necessário
      if (!config.allowEmojis) {
        finalResponse = finalResponse.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
      }
      
      const processingTime = Date.now() - startTime;
      console.log(`✅ Resposta processada em ${processingTime}ms`);
      console.log(`📄 Resposta: ${finalResponse.substring(0, 100)}...`);
      
      return {
        response: finalResponse,
        source: 'groq',
        clientId,
        config,
        processingTime,
        tokens: completion.usage?.total_tokens || 0
      };
      
    } catch (error) {
      console.error(`❌ Erro no processamento IA:`, error);
      
      return {
        response: this.defaultConfig.fallbackMessage || 'Desculpe, estou temporariamente indisponível. Por favor, tente novamente mais tarde.',
        source: 'error',
        error: error.message,
        fallback: true
      };
    }
  }

  // Registrar mensagem no banco de dados
  async logMessage(clientId, phoneNumber, message, response, metadata = {}) {
    try {
      const { data, error } = await this.supabase
        .from('client_messages')
        .insert({
          client_id: clientId,
          phone_number: phoneNumber,
          message_content: message,
          response_content: response,
          message_type: 'text',
          direction: 'inbound',
          processed_by_ia: true,
          ia_source: metadata.source,
          processing_time_ms: metadata.processingTime,
          tokens_used: metadata.tokens,
          metadata: metadata
        });
      
      if (error) {
        console.error(`❌ Erro ao registrar mensagem:`, error);
      } else {
        console.log(`📝 Mensagem registrada para cliente ${clientId}`);
      }
      
    } catch (error) {
      console.error(`❌ Erro ao registrar mensagem:`, error);
    }
  }
}

module.exports = PersonalizedIAService;