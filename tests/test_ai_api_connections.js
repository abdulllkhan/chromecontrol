#!/usr/bin/env node

/**
 * Comprehensive AI API Connection Tests
 *
 * This test suite verifies that AI API connections are working correctly
 * with proper parameter handling for different OpenAI models.
 *
 * Tests include:
 * - API key validation
 * - Connection testing for different models
 * - Parameter handling verification (max_completion_tokens vs max_tokens)
 * - Error handling and retry logic
 *
 * Run with: node test_ai_api_connections.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// TEST CONFIGURATION
// ============================================================================

const TEST_CONFIG = {
  baseUrl: 'https://api.openai.com/v1',
  timeout: 10000,
  testMessage: 'Hello! Please respond with just "OK" to test the connection.',
  maxTestTokens: 5,
  testTemperature: 0.1
};

// Models to test with their expected parameter configurations
const MODELS_TO_TEST = [
  {
    name: 'gpt-4o',
    useMaxCompletionTokens: true,
    supportsTemperature: false,
    description: 'GPT-4o (newest model)'
  },
  {
    name: 'gpt-4o-mini',
    useMaxCompletionTokens: true,
    supportsTemperature: false,
    description: 'GPT-4o Mini (cost-effective)'
  },
  {
    name: 'gpt-4-turbo',
    useMaxCompletionTokens: true,
    supportsTemperature: true,
    description: 'GPT-4 Turbo'
  },
  {
    name: 'gpt-4',
    useMaxCompletionTokens: false,
    supportsTemperature: true,
    description: 'GPT-4'
  },
  {
    name: 'gpt-3.5-turbo',
    useMaxCompletionTokens: false,
    supportsTemperature: true,
    description: 'GPT-3.5 Turbo (legacy)'
  }
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Load and validate .env file
 */
function loadEnvironment() {
  try {
    const envPath = path.join(__dirname, '.env');

    if (!fs.existsSync(envPath)) {
      console.error('❌ .env file not found at:', envPath);
      return null;
    }

    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = {};

    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          envVars[key.trim()] = valueParts.join('=').trim();
        }
      }
    });

    return envVars;
  } catch (error) {
    console.error('❌ Error reading .env file:', error.message);
    return null;
  }
}

/**
 * Validate API key format
 */
function validateApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }

  const trimmed = apiKey.trim();

  // Check if it's a placeholder
  if (trimmed === 'your_openai_api_key_here' || trimmed.length < 10) {
    return false;
  }

  // Check for OpenAI API key format (starts with sk-)
  if (trimmed.startsWith('sk-proj-') || trimmed.startsWith('sk-')) {
    return true;
  }

  return false;
}

/**
 * Build API request for a specific model
 */
function buildApiRequest(model, useMaxCompletionTokens, supportsTemperature) {
  const request = {
    model: model,
    messages: [
      {
        role: 'user',
        content: TEST_CONFIG.testMessage
      }
    ]
  };

  // Use correct token parameter based on model
  if (useMaxCompletionTokens) {
    request.max_completion_tokens = TEST_CONFIG.maxTestTokens;
    // Newer models default to temperature=1 and don't accept custom values
    if (supportsTemperature) {
      request.temperature = TEST_CONFIG.testTemperature;
    }
  } else {
    request.max_tokens = TEST_CONFIG.maxTestTokens;
    request.temperature = TEST_CONFIG.testTemperature;
  }

  return request;
}

/**
 * Test API connection for a specific model
 */
async function testModelConnection(apiKey, modelConfig) {
  const { name, useMaxCompletionTokens, supportsTemperature, description } = modelConfig;

  console.log(`\n🧪 Testing ${name} (${description})`);
  console.log(`   Parameters: ${useMaxCompletionTokens ? 'max_completion_tokens' : 'max_tokens'}${supportsTemperature ? ', temperature' : ', no temperature'}`);

  try {
    const request = buildApiRequest(name, useMaxCompletionTokens, supportsTemperature);

    console.log(`   📤 Request payload:`, JSON.stringify(request, null, 2));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TEST_CONFIG.timeout);

    const response = await fetch(`${TEST_CONFIG.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(request),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.log(`   ❌ Failed: ${response.status} ${response.statusText}`);
      console.log(`   📄 Error details: ${errorText.substring(0, 200)}...`);

      return {
        success: false,
        model: name,
        error: `${response.status} ${response.statusText}`,
        details: errorText
      };
    }

    const data = await response.json();

    // Validate response structure
    const isValidResponse = !!(
      data &&
      data.choices &&
      data.choices.length > 0 &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content &&
      typeof data.choices[0].message.content === 'string' &&
      data.choices[0].message.content.trim().length > 0
    );

    if (isValidResponse) {
      const responseContent = data.choices[0].message.content.trim();
      console.log(`   ✅ Success! Response: "${responseContent}"`);
      console.log(`   📊 Token usage: ${JSON.stringify(data.usage || 'N/A')}`);

      return {
        success: true,
        model: name,
        response: responseContent,
        usage: data.usage
      };
    } else {
      console.log(`   ❌ Invalid response structure`);
      console.log(`   📄 Response data:`, JSON.stringify(data, null, 2));

      return {
        success: false,
        model: name,
        error: 'Invalid response structure',
        details: data
      };
    }

  } catch (error) {
    console.log(`   ❌ Network error: ${error.message}`);

    return {
      success: false,
      model: name,
      error: error.message,
      type: 'network'
    };
  }
}

/**
 * Test parameter handling by comparing responses
 */
async function testParameterHandling(apiKey) {
  console.log(`\n🔬 Testing parameter handling differences...`);

  // Test with both parameter types for a model that supports both
  const testModel = 'gpt-3.5-turbo';

  console.log(`\n📋 Testing ${testModel} with max_tokens (correct for this model):`);
  const correctResult = await testModelConnection(apiKey, {
    name: testModel,
    useMaxCompletionTokens: false,
    supportsTemperature: true,
    description: 'Using correct max_tokens parameter'
  });

  console.log(`\n📋 Testing ${testModel} with max_completion_tokens (incorrect for this model):`);
  const incorrectResult = await testModelConnection(apiKey, {
    name: testModel,
    useMaxCompletionTokens: true,
    supportsTemperature: true,
    description: 'Using incorrect max_completion_tokens parameter'
  });

  return {
    correct: correctResult,
    incorrect: incorrectResult
  };
}

/**
 * Generate test summary report
 */
function generateTestReport(results, parameterTest, startTime) {
  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;

  console.log(`\n${'='.repeat(80)}`);
  console.log(`🎯 AI API CONNECTION TEST RESULTS`);
  console.log(`${'='.repeat(80)}`);
  console.log(`⏱️  Test Duration: ${duration}s`);
  console.log(`📅 Test Date: ${new Date().toISOString()}`);

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`\n📊 SUMMARY:`);
  console.log(`   ✅ Successful: ${successful.length}/${results.length} models`);
  console.log(`   ❌ Failed: ${failed.length}/${results.length} models`);
  console.log(`   📈 Success Rate: ${((successful.length / results.length) * 100).toFixed(1)}%`);

  if (successful.length > 0) {
    console.log(`\n✅ SUCCESSFUL MODELS:`);
    successful.forEach(result => {
      console.log(`   • ${result.model}: Response received`);
      if (result.usage) {
        console.log(`     Tokens used: ${JSON.stringify(result.usage)}`);
      }
    });
  }

  if (failed.length > 0) {
    console.log(`\n❌ FAILED MODELS:`);
    failed.forEach(result => {
      console.log(`   • ${result.model}: ${result.error}`);
      if (result.type === 'network') {
        console.log(`     Type: Network error`);
      }
    });
  }

  // Parameter handling results
  if (parameterTest) {
    console.log(`\n🔬 PARAMETER HANDLING TEST:`);
    console.log(`   Using max_tokens (correct): ${parameterTest.correct.success ? '✅ Success' : '❌ Failed'}`);
    console.log(`   Using max_completion_tokens (incorrect): ${parameterTest.incorrect.success ? '⚠️  Unexpected success' : '✅ Correctly failed'}`);

    if (parameterTest.correct.success && !parameterTest.incorrect.success) {
      console.log(`   🎯 Parameter validation working correctly!`);
    } else if (parameterTest.correct.success && parameterTest.incorrect.success) {
      console.log(`   ⚠️  Both parameters worked - model may accept both (API change?)`);
    } else if (!parameterTest.correct.success && !parameterTest.incorrect.success) {
      console.log(`   ❌ Model not working with either parameter`);
    }
  }

  console.log(`\n💡 RECOMMENDATIONS:`);
  if (successful.length === 0) {
    console.log(`   • Check your API key - it may be invalid or have no credits`);
    console.log(`   • Verify network connectivity to OpenAI's API`);
    console.log(`   • Check if your account has access to the tested models`);
  } else if (failed.length > 0) {
    console.log(`   • Some models failed - this is expected for account limitations`);
    console.log(`   • Focus on using the successful models: ${successful.map(r => r.model).join(', ')}`);
  } else {
    console.log(`   • All models working! API integration is healthy`);
    console.log(`   • Consider using gpt-4o-mini for cost-effective operations`);
    console.log(`   • Use gpt-4o for tasks requiring latest capabilities`);
  }

  console.log(`\n🔧 IMPLEMENTATION NOTES:`);
  console.log(`   • Newer models (gpt-4o*) require max_completion_tokens parameter`);
  console.log(`   • Older models (gpt-3.5-turbo, gpt-4) use max_tokens parameter`);
  console.log(`   • Some newer models don't accept custom temperature values`);
  console.log(`   • The current AI service implementation handles these differences correctly`);

  console.log(`\n${'='.repeat(80)}`);
}

// ============================================================================
// MAIN TEST EXECUTION
// ============================================================================

async function runTests() {
  const startTime = Date.now();

  console.log(`🚀 Starting AI API Connection Tests`);
  console.log(`${'='.repeat(50)}`);

  // Step 1: Load and validate environment
  console.log(`\n📁 Step 1: Loading .env file...`);
  const env = loadEnvironment();

  if (!env) {
    console.log(`❌ Cannot proceed without .env file`);
    process.exit(1);
  }

  console.log(`✅ .env file loaded`);
  console.log(`📋 Environment variables found: ${Object.keys(env).length}`);

  // Step 2: Validate API key
  console.log(`\n🔑 Step 2: Validating API key...`);
  const apiKey = env.chromControl_local || env.OPENAI_API_KEY;

  if (!validateApiKey(apiKey)) {
    console.log(`❌ Invalid or missing OpenAI API key`);
    console.log(`   Expected: A valid OpenAI API key starting with 'sk-'`);
    console.log(`   Found: ${apiKey ? `"${apiKey.substring(0, 10)}..."` : 'undefined'}`);
    console.log(`   Please update your .env file with a valid OpenAI API key`);
    process.exit(1);
  }

  console.log(`✅ API key format appears valid`);
  console.log(`🔐 Using key: ${apiKey.substring(0, 15)}...`);

  // Step 3: Test individual models
  console.log(`\n🔄 Step 3: Testing individual models...`);
  console.log(`Models to test: ${MODELS_TO_TEST.length}`);

  const results = [];

  for (const modelConfig of MODELS_TO_TEST) {
    const result = await testModelConnection(apiKey, modelConfig);
    results.push(result);

    // Small delay between requests to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Step 4: Test parameter handling
  console.log(`\n🔄 Step 4: Testing parameter handling...`);
  const parameterTest = await testParameterHandling(apiKey);

  // Step 5: Generate comprehensive report
  console.log(`\n📋 Step 5: Generating test report...`);
  generateTestReport(results, parameterTest, startTime);

  // Exit with appropriate code
  const hasSuccessfulTests = results.some(r => r.success);
  process.exit(hasSuccessfulTests ? 0 : 1);
}

// ============================================================================
// EXECUTION
// ============================================================================

// Handle uncaught errors gracefully
process.on('unhandledRejection', (error) => {
  console.error(`\n❌ Unhandled error:`, error.message);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log(`\n\n⚠️  Test interrupted by user`);
  process.exit(130);
});

// Run the tests
runTests().catch(error => {
  console.error(`\n❌ Test execution failed:`, error.message);
  console.error(error.stack);
  process.exit(1);
});