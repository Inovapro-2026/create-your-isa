#!/usr/bin/env node

/**
 * Script de teste para validar integração com Groq e Supabase
 * Execute: node test-integration.js
 */

const PersonalizedIAService = require('./src/services/personalizedIA');

async function testIntegration() {
  console.log('🧪 Iniciando teste de integração...\n');
  
  const iaService = new PersonalizedIAService();
  
  // Testar diferentes cenários
  const testCases = [
    {
      phone: '5511999999999', // João Silva
      message: 'Olá, gostaria de saber mais sobre seus serviços de consultoria'
    },
    {
      phone: '5511888888888', // Maria Santos  
      message: 'Estou com problema no meu sistema, pode me ajudar?'
    },
    {
      phone: '5511777777777', // Cliente não cadastrado
      message: 'Qual é o preço dos seus produtos?'
    },
    {
      phone: '5511999999999',
      message: 'preço' // Trigger de preço
    },
    {
      phone: '5511888888888',
      message: 'Preciso falar com um atendente humano' // Transferência humana
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n📱 Testando: ${testCase.phone}`);
    console.log(`💬 Mensagem: "${testCase.message}"`);
    
    try {
      const result = await iaService.processMessage(testCase.message, testCase.phone);
      
      console.log(`✅ Resposta: "${result.response.substring(0, 100)}..."`);
      console.log(`📊 Fonte: ${result.source}`);
      console.log(`⏱️  Tempo: ${result.processingTime}ms`);
      console.log(`🎯 Cliente ID: ${result.clientId || 'Padrão'}`);
      
      if (result.requiresHumanTransfer) {
        console.log(`👥 Transferência humana solicitada`);
      }
      
      if (result.attachment) {
        console.log(`📎 Anexo: ${result.attachment}`);
      }
      
    } catch (error) {
      console.error(`❌ Erro: ${error.message}`);
    }
    
    console.log('─'.repeat(60));
  }
  
  console.log('\n🎉 Teste de integração concluído!');
}

// Executar teste
if (require.main === module) {
  testIntegration().catch(console.error);
}

module.exports = { testIntegration };