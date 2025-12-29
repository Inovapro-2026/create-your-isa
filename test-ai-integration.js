// Test the AI integration through the API
const axios = require('axios');

async function testAIIntegration() {
  try {
    console.log('🧪 Testing AI integration...');
    
    // Test AI response generation
    const response = await axios.post('http://localhost:3001/api/ia/test/test_client', {
      message: 'Olá, como você pode me ajudar hoje?',
      context: {
        contactName: 'João Silva',
        recentMessages: 'Cliente entrou em contato pela primeira vez'
      }
    });

    console.log('✅ AI Response Test Result:');
    console.log('Response:', response.data.response);
    console.log('Success:', response.data.success);
    
  } catch (error) {
    console.error('❌ AI Integration Test Failed:');
    console.error('Error:', error.response?.data || error.message);
  }
}

testAIIntegration();