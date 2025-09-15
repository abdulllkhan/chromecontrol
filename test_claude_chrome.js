// Test script to verify Claude connection in Chrome extension context
import { AIService } from './src/services/aiService.js';

// Read API key from environment
const CLAUDE_API_KEY = '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';

async function testClaudeConnection() {
  console.log('Testing Claude connection with AIService...\n');

  const config = {
    apiKey: CLAUDE_API_KEY,
    model: 'claude-3-5-haiku-20241022',
    baseUrl: 'https://api.anthropic.com/v1',
    provider: 'auto'
  };

  console.log('Configuration:', {
    ...config,
    apiKey: 'sk-ant-...[REDACTED]'
  });

  try {
    const aiService = new AIService(config);
    console.log('\nDetected provider:', aiService.config.provider);

    const result = await aiService.testConnection();
    console.log('\nTest result:', result ? '✅ SUCCESS' : '❌ FAILED');

    if (result) {
      console.log('\nClaude API is working correctly with AIService!');
    } else {
      console.log('\nClaude API test failed. Check console for error details.');
    }
  } catch (error) {
    console.error('\nError during test:', error);
  }
}

testClaudeConnection();