// Test the AI integration with a non-trigger message
const axios = require('axios');

async function testAIIntegration() {
  try {
    console.log('🧪 Testing AI integration with non-trigger message...');
    
    // Test AI response generation with a message that doesn't match triggers
    const response = await axios.post('http://localhost:3001/api/ia/test/test_client', {
      message: 'Qual é o horário de funcionamento da empresa?',
      context: {
        contactName: 'Maria Santos',
        recentMessages: 'Cliente perguntando sobre horário'
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