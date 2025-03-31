// debug-anthropic.js
require('dotenv').config();
const { Anthropic } = require('@anthropic-ai/sdk');

// Check if API key is available
console.log(`API key available: ${process.env.ANTHROPIC_API_KEY ? 'Yes' : 'No'}`);
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ERROR: ANTHROPIC_API_KEY is not set in your environment variables or .env file");
  console.log("Please make sure you have created a .env file with your API key");
  process.exit(1);
}

console.log('Attempting to initialize Anthropic client...');
try {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });
  console.log('Successfully initialized Anthropic client');
  
  console.log('Testing API connection...');
  
  // Simple test message
  const testMessage = async () => {
    try {
      const response = await anthropic.messages.create({
        model: "claude-3-7-sonnet-20250219",
        max_tokens: 100,
        messages: [
          { role: "user", content: "Hello, are you working?" }
        ]
      });
      
      console.log('Received response from Claude:');
      console.log(response.content[0].text);
      console.log('API is working correctly!');
    } catch (error) {
      console.error('Error calling Claude API:');
      console.error(error.message);
      if (error.response) {
        console.error('API Response:', error.response.data);
      }
    }
  };
  
  testMessage();
} catch (error) {
  console.error('Error initializing Anthropic client:');
  console.error(error.message);
}