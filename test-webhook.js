// Test webhook message processing
const axios = require('axios');

async function testWebhookProcessing() {
  try {
    console.log('🧪 Testing webhook message processing...');
    
    // Test webhook message reception
    const response = await axios.post('http://localhost:3001/api/webhook/message-received', {
      client_id: 'test_client',
      from: '5511999999999@c.us',
      message: 'Olá, gostaria de saber mais sobre o Produto A'
    });

    console.log('✅ Webhook Test Result:');
    console.log('Response:', response.data.response);
    console.log('Success:', response.data.success);
    
  } catch (error) {
    console.error('❌ Webhook Test Failed:');
    console.error('Error:', error.response?.data || error.message);
  }
}

testWebhookProcessing();