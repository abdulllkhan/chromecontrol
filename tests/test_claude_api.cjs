/**
 * Claude API Testing Suite
 * Comprehensive tests for Claude/Anthropic API integration
 */

require('dotenv').config();
const fetch = require('node-fetch');

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

// Claude models to test with their configurations
const CLAUDE_MODELS_CONFIG = {
  // Latest Claude 4 models
  'claude-opus-4-1-20250805': {
    name: 'Claude Opus 4.1 (Latest & Most Powerful)',
    maxTokens: 1000000,
    supportsTemperature: true,
    isLatest: true
  },
  'claude-sonnet-4-20250514': {
    name: 'Claude Sonnet 4 (Best Balance)',
    maxTokens: 1000000,
    supportsTemperature: true,
    isLatest: true
  },

  // Claude 3.5 models (known to work)
  'claude-3-5-haiku-20241022': {
    name: 'Claude 3.5 Haiku (Fast & Economical)',
    maxTokens: 200000,
    supportsTemperature: true,
    isLatest: false
  },
  'claude-3-5-sonnet-20241022': {
    name: 'Claude 3.5 Sonnet (Legacy)',
    maxTokens: 200000,
    supportsTemperature: true,
    isLatest: false
  },
  'claude-3-5-sonnet-20240620': {
    name: 'Claude 3.5 Sonnet (Legacy)',
    maxTokens: 200000,
    supportsTemperature: true,
    isLatest: false
  }
};

// Test configuration
const API_KEY = process.env.CLAUDE_API_KEY;
const BASE_URL = 'https://api.anthropic.com/v1';

if (!API_KEY) {
  console.error(`${colors.red}Error: CLAUDE_API_KEY not found in .env file${colors.reset}`);
  process.exit(1);
}

console.log(`${colors.cyan}${colors.bright}Claude API Testing Suite${colors.reset}`);
console.log(`${colors.cyan}Testing with API Key: ${API_KEY.substring(0, 10)}...${colors.reset}\n`);

/**
 * Test a single Claude model
 */
async function testClaudeModel(modelId, config) {
  console.log(`${colors.blue}Testing ${config.name} (${modelId})...${colors.reset}`);

  try {
    // Build the request payload
    const requestBody = {
      model: modelId,
      max_tokens: 20,
      messages: [
        {
          role: 'user',
          content: 'Say "Hello, I am Claude!" in exactly 5 words.'
        }
      ]
    };

    // Add temperature only for models that support it, avoid for Opus 4.1 if it has restrictions
    if (config.supportsTemperature && modelId !== 'claude-opus-4-1-20250805') {
      requestBody.temperature = 0.7;
    }

    // Build headers
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01'
    };

    // Add beta headers for Claude 4 models
    if (config.isLatest) {
      headers['anthropic-beta'] = 'interleaved-thinking-2025-05-14';
    }

    console.log(`  Request parameters:`, {
      model: modelId,
      maxTokens: requestBody.max_tokens,
      hasTemperature: !!requestBody.temperature,
      hasBetaHeader: !!headers['anthropic-beta']
    });

    const startTime = Date.now();

    const response = await fetch(`${BASE_URL}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      let errorDetails;
      try {
        const errorText = await response.text();
        try {
          errorDetails = JSON.parse(errorText);
        } catch {
          errorDetails = { message: errorText };
        }
      } catch {
        errorDetails = { message: 'Unable to read error response' };
      }

      throw new Error(`API Error (${response.status}): ${errorDetails.error?.message || errorDetails.message || 'Unknown error'}`);
    }

    const data = await response.json();

    // Validate response structure
    if (!data.content || !Array.isArray(data.content) || data.content.length === 0) {
      throw new Error('Invalid response structure - no content array');
    }

    if (!data.content[0] || !data.content[0].text) {
      throw new Error('Invalid response structure - no text in content');
    }

    const content = data.content[0].text;
    const usage = data.usage;

    console.log(`  ${colors.green}✓ Success${colors.reset}`);
    console.log(`    Response: "${content}"`);
    console.log(`    Response time: ${responseTime}ms`);
    console.log(`    Tokens used: ${usage?.input_tokens || 'N/A'} input, ${usage?.output_tokens || 'N/A'} output`);

    // Check for Claude 4 specific features
    if (data.usage?.completion_tokens_details) {
      console.log(`    Advanced token details available`);
    }

    return {
      success: true,
      model: modelId,
      responseTime,
      content,
      usage,
      isLatest: config.isLatest
    };

  } catch (error) {
    console.log(`  ${colors.red}✗ Failed${colors.reset}`);
    console.log(`    Error: ${error.message}`);

    // Provide helpful hints for common errors
    if (error.message.includes('404')) {
      console.log(`    ${colors.yellow}Hint: Model "${modelId}" may not be available yet or may require special access.${colors.reset}`);
    } else if (error.message.includes('401')) {
      console.log(`    ${colors.yellow}Hint: Check your API key is valid and has access to this model.${colors.reset}`);
    } else if (error.message.includes('400')) {
      console.log(`    ${colors.yellow}Hint: Request format may be incorrect for this model.${colors.reset}`);
    } else if (error.message.includes('429')) {
      console.log(`    ${colors.yellow}Hint: Rate limit exceeded. Wait before retrying.${colors.reset}`);
    }

    return {
      success: false,
      model: modelId,
      error: error.message,
      isLatest: config.isLatest
    };
  }
}

/**
 * Test basic API connectivity
 */
async function testBasicConnectivity() {
  console.log(`${colors.bright}${colors.cyan}Testing Basic API Connectivity${colors.reset}`);
  console.log('═'.repeat(50));

  try {
    // Test with the most reliable model first
    const testModel = 'claude-3-5-haiku-20241022';
    const result = await testClaudeModel(testModel, CLAUDE_MODELS_CONFIG[testModel]);

    if (result.success) {
      console.log(`${colors.green}✅ Basic connectivity: WORKING${colors.reset}\n`);
      return true;
    } else {
      console.log(`${colors.red}❌ Basic connectivity: FAILED${colors.reset}\n`);
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}❌ Basic connectivity test failed: ${error.message}${colors.reset}\n`);
    return false;
  }
}

/**
 * Run all model tests
 */
async function runAllModelTests() {
  console.log(`${colors.bright}${colors.cyan}Testing All Claude Models${colors.reset}`);
  console.log('═'.repeat(50));

  const results = [];

  for (const [modelId, config] of Object.entries(CLAUDE_MODELS_CONFIG)) {
    const result = await testClaudeModel(modelId, config);
    results.push(result);
    console.log(''); // Add spacing between tests
  }

  return results;
}

/**
 * Generate test summary
 */
function generateSummary(results) {
  console.log(`${colors.bright}${colors.cyan}Test Summary${colors.reset}`);
  console.log('═'.repeat(50));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const claude4Models = results.filter(r => r.isLatest);
  const claude4Working = claude4Models.filter(r => r.success);

  console.log(`${colors.green}Successful: ${successful.length}/${results.length}${colors.reset}`);
  if (successful.length > 0) {
    successful.forEach(r => {
      const badge = r.isLatest ? '🆕' : '📜';
      console.log(`  ✓ ${badge} ${r.model} (${r.responseTime}ms)`);
    });
  }

  if (failed.length > 0) {
    console.log(`${colors.red}Failed: ${failed.length}/${results.length}${colors.reset}`);
    failed.forEach(r => {
      const badge = r.isLatest ? '🆕' : '📜';
      console.log(`  ✗ ${badge} ${r.model}: ${r.error}`);
    });
  }

  // Claude 4 specific analysis
  console.log(`\n${colors.cyan}Claude 4 Models Analysis:${colors.reset}`);
  console.log(`Claude 4 models tested: ${claude4Models.length}`);
  console.log(`Claude 4 models working: ${claude4Working.length}`);

  if (claude4Working.length === 0 && claude4Models.length > 0) {
    console.log(`${colors.yellow}⚠️  Claude 4 models are not available yet. Use Claude 3.5 models instead.${colors.reset}`);
  }

  // Performance comparison
  if (successful.length > 1) {
    console.log(`\n${colors.cyan}Performance Comparison:${colors.reset}`);
    const sorted = [...successful].sort((a, b) => a.responseTime - b.responseTime);
    sorted.forEach((r, idx) => {
      const badge = r.isLatest ? '🆕' : '📜';
      console.log(`  ${idx + 1}. ${badge} ${r.model}: ${r.responseTime}ms`);
    });
  }

  // Recommendations
  console.log(`\n${colors.yellow}Recommendations:${colors.reset}`);
  if (successful.length === 0) {
    console.log(`• No models are working. Check your API key and network connection.`);
  } else if (claude4Working.length > 0) {
    console.log(`• ✅ Claude 4 models are available! Use them for best performance.`);
    console.log(`• Recommended: ${claude4Working[0].model}`);
  } else {
    console.log(`• Claude 4 models not available yet. Use Claude 3.5 models:${colors.reset}`);
    const workingClaude35 = successful.filter(r => !r.isLatest);
    if (workingClaude35.length > 0) {
      console.log(`• Recommended: ${workingClaude35[0].model}`);
    }
  }

  if (failed.length > 0) {
    console.log(`• Some models failed. This is normal if they're not available in your region yet.`);
  }
}

/**
 * Main test runner
 */
async function runClaudeTests() {
  console.log(`${colors.bright}Starting Claude API tests...${colors.reset}\n`);

  try {
    // Test basic connectivity first
    const connectivityOk = await testBasicConnectivity();

    if (!connectivityOk) {
      console.log(`${colors.red}Basic connectivity failed. Stopping tests.${colors.reset}`);
      return;
    }

    // Run all model tests
    const results = await runAllModelTests();

    // Generate summary
    generateSummary(results);

  } catch (error) {
    console.error(`${colors.red}Fatal error during testing:${colors.reset}`, error);
  }
}

// Run tests
runClaudeTests().catch(error => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});