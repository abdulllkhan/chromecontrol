/**
 * Comprehensive AI Model Testing Suite
 * Tests all GPT-5 and GPT-4o models with correct API parameters
 */

import fetch from 'node-fetch';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load environment variables
config();

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Models to test with their configurations
const MODELS_CONFIG = {
  'gpt-5': {
    name: 'GPT-5 (Latest)',
    useMaxCompletionTokens: true,
    supportsTemperature: false,
    maxTokens: 200000
  },
  'gpt-5-mini': {
    name: 'GPT-5 Mini (Fast)',
    useMaxCompletionTokens: true,
    supportsTemperature: false,
    maxTokens: 150000
  },
  'gpt-5-thinking': {
    name: 'GPT-5 Thinking (Advanced Reasoning)',
    useMaxCompletionTokens: true,
    supportsTemperature: false,
    maxTokens: 200000,
    reasoningEffort: 'medium'
  },
  'gpt-4o': {
    name: 'GPT-4o (Optimized)',
    useMaxCompletionTokens: true,
    supportsTemperature: false,
    maxTokens: 128000
  },
  'gpt-4o-mini': {
    name: 'GPT-4o Mini (Fast)',
    useMaxCompletionTokens: true,
    supportsTemperature: false,
    maxTokens: 128000
  }
};

// Test configuration
const API_KEY = process.env.OPENAI_API_KEY;
const BASE_URL = 'https://api.openai.com/v1';

if (!API_KEY) {
  console.error(`${colors.red}Error: OPENAI_API_KEY not found in .env file${colors.reset}`);
  process.exit(1);
}

console.log(`${colors.cyan}${colors.bright}OpenAI API Model Testing Suite${colors.reset}`);
console.log(`${colors.cyan}Testing with API Key: ${API_KEY.substring(0, 10)}...${colors.reset}\n`);

/**
 * Test a single model
 */
async function testModel(modelId, config) {
  console.log(`${colors.blue}Testing ${config.name} (${modelId})...${colors.reset}`);

  try {
    // Build the request payload based on model configuration
    const requestBody = {
      model: modelId,
      messages: [
        {
          role: 'user',
          content: 'Say "Hello, I am working!" in exactly 5 words.'
        }
      ],
      stream: false
    };

    // Use correct token parameter based on model
    if (config.useMaxCompletionTokens) {
      requestBody.max_completion_tokens = 20;
    } else {
      requestBody.max_tokens = 20;
    }

    // Add temperature only for models that support it
    if (config.supportsTemperature) {
      requestBody.temperature = 0.7;
    }

    // Add reasoning_effort for thinking models
    if (config.reasoningEffort) {
      requestBody.reasoning_effort = config.reasoningEffort;
    }

    console.log(`  Request parameters:`, {
      model: modelId,
      tokenParam: config.useMaxCompletionTokens ? 'max_completion_tokens' : 'max_tokens',
      hasTemperature: config.supportsTemperature,
      reasoningEffort: config.reasoningEffort || 'none'
    });

    const startTime = Date.now();

    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      let errorDetails;
      try {
        errorDetails = JSON.parse(errorText);
      } catch {
        errorDetails = { message: errorText };
      }

      throw new Error(`API Error (${response.status}): ${errorDetails.error?.message || errorDetails.message || 'Unknown error'}`);
    }

    const data = await response.json();

    // Validate response structure
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response structure');
    }

    const content = data.choices[0].message.content;
    const usage = data.usage;

    console.log(`  ${colors.green}✓ Success${colors.reset}`);
    console.log(`    Response: "${content}"`);
    console.log(`    Response time: ${responseTime}ms`);
    console.log(`    Tokens used: ${usage?.total_tokens || 'N/A'} (prompt: ${usage?.prompt_tokens || 'N/A'}, completion: ${usage?.completion_tokens || 'N/A'})`);

    // Check for reasoning tokens if present
    if (data.usage?.completion_tokens_details?.reasoning_tokens) {
      console.log(`    Reasoning tokens: ${data.usage.completion_tokens_details.reasoning_tokens}`);
    }

    return {
      success: true,
      model: modelId,
      responseTime,
      content,
      usage
    };

  } catch (error) {
    console.log(`  ${colors.red}✗ Failed${colors.reset}`);
    console.log(`    Error: ${error.message}`);

    // Provide helpful hints for common errors
    if (error.message.includes('404')) {
      console.log(`    ${colors.yellow}Hint: Model "${modelId}" may not be available yet or may require special access.${colors.reset}`);
    } else if (error.message.includes('401')) {
      console.log(`    ${colors.yellow}Hint: Check your API key is valid and has access to this model.${colors.reset}`);
    } else if (error.message.includes('max_tokens')) {
      console.log(`    ${colors.yellow}Hint: This model may not support the max_tokens parameter. It might need max_completion_tokens instead.${colors.reset}`);
    } else if (error.message.includes('model does not exist')) {
      console.log(`    ${colors.yellow}Hint: Model "${modelId}" is not available. It may be a future release or require special access.${colors.reset}`);
    }

    return {
      success: false,
      model: modelId,
      error: error.message
    };
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log(`${colors.bright}Starting tests for ${Object.keys(MODELS_CONFIG).length} models...${colors.reset}\n`);

  const results = [];

  for (const [modelId, config] of Object.entries(MODELS_CONFIG)) {
    const result = await testModel(modelId, config);
    results.push(result);
    console.log(''); // Add spacing between tests
  }

  // Summary
  console.log(`${colors.bright}${colors.cyan}Test Summary${colors.reset}`);
  console.log('═'.repeat(50));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`${colors.green}Successful: ${successful.length}/${results.length}${colors.reset}`);
  if (successful.length > 0) {
    successful.forEach(r => {
      console.log(`  ✓ ${r.model} (${r.responseTime}ms)`);
    });
  }

  if (failed.length > 0) {
    console.log(`${colors.red}Failed: ${failed.length}/${results.length}${colors.reset}`);
    failed.forEach(r => {
      console.log(`  ✗ ${r.model}: ${r.error}`);
    });
  }

  // Performance comparison
  if (successful.length > 1) {
    console.log(`\n${colors.cyan}Performance Comparison:${colors.reset}`);
    const sorted = [...successful].sort((a, b) => a.responseTime - b.responseTime);
    sorted.forEach((r, idx) => {
      console.log(`  ${idx + 1}. ${r.model}: ${r.responseTime}ms`);
    });
  }

  // Recommendations
  console.log(`\n${colors.yellow}Recommendations:${colors.reset}`);
  if (failed.length > 0) {
    console.log(`• Some models failed. They may not be available yet or require special access.`);
    console.log(`• GPT-5 models are the latest and may require updated API access.`);
    console.log(`• Consider using fallback models like gpt-4o or gpt-4o-mini if GPT-5 is not available.`);
  }
  if (successful.length > 0) {
    const fastest = successful.reduce((prev, current) =>
      prev.responseTime < current.responseTime ? prev : current
    );
    console.log(`• Fastest model: ${fastest.model} (${fastest.responseTime}ms)`);
    console.log(`• For production, implement fallback logic between models.`);
  }

  console.log(`\n${colors.cyan}Note about GPT-5 models:${colors.reset}`);
  console.log(`• GPT-5, GPT-5 Mini, and GPT-5 Thinking are the latest models from OpenAI`);
  console.log(`• They use max_completion_tokens instead of max_tokens`);
  console.log(`• They don't support custom temperature settings`);
  console.log(`• If these models fail, your API key may not have access yet`);
}

// Run tests
runAllTests().catch(error => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});