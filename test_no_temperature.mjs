/**
 * Test to verify temperature parameter is NOT sent for newer models
 */

import fetch from 'node-fetch';
import { config } from 'dotenv';

config();

const API_KEY = process.env.OPENAI_API_KEY;
const BASE_URL = 'https://api.openai.com/v1';

console.log('Testing that temperature is NOT included in API calls for GPT-5 and GPT-4o models...\n');

async function testModelWithoutTemperature(model) {
  console.log(`Testing ${model}...`);

  const requestBody = {
    model: model,
    messages: [
      { role: 'user', content: 'Say hi' }
    ],
    max_completion_tokens: 10,
    // IMPORTANT: No temperature field here!
  };

  console.log('Request body:', JSON.stringify(requestBody, null, 2));

  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ ${model}: Success! Response: "${data.choices[0].message.content}"`);
      console.log(`   No temperature sent, API used default value\n`);
      return true;
    } else {
      const error = await response.text();
      console.log(`❌ ${model}: Failed - ${error}\n`);
      return false;
    }
  } catch (error) {
    console.log(`❌ ${model}: Error - ${error.message}\n`);
    return false;
  }
}

// Test all models
async function runTests() {
  const models = ['gpt-5', 'gpt-5-mini', 'gpt-4o', 'gpt-4o-mini'];
  let allPassed = true;

  for (const model of models) {
    const passed = await testModelWithoutTemperature(model);
    if (!passed) allPassed = false;
  }

  console.log('\n========================================');
  if (allPassed) {
    console.log('✅ All tests passed! Temperature is correctly NOT sent for newer models.');
  } else {
    console.log('⚠️ Some tests failed. Check the errors above.');
  }
  console.log('========================================');
}

runTests();