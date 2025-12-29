// Simple test script to verify Groq AI integration
const axios = require('axios');

const GROQ_API_KEY = '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';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

async function testGroqAI() {
  try {
    const response = await axios.post(GROQ_API_URL, {
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'Você é um assistente virtual inteligente e prestativo. Responda de forma amigável e profissional.'
        },
        {
          role: 'user',
          content: 'Olá, como você pode me ajudar hoje?'
        }
      ],
      max_tokens: 150,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Groq AI Test Result:');
    console.log('Response:', response.data.choices[0].message.content);
    console.log('Model:', response.data.model);
    console.log('Usage:', response.data.usage);
    
  } catch (error) {
    console.error('❌ Groq AI Test Failed:');
    console.error('Error:', error.response?.data || error.message);
  }
}

testGroqAI();