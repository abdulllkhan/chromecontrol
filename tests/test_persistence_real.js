/**
 * Real-world test of AI configuration persistence
 * This simulates the exact user workflow to test if persistence works
 */

// Test data
const TEST_API_KEY = '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';

// Mock Chrome storage for testing
const mockStorage = {
  data: {},
  local: {
    get: (keys) => {
      console.log('🔍 Chrome storage GET called with:', keys);
      const result = keys === null ? mockStorage.data : 
        (Array.isArray(keys) ? 
          keys.reduce((result, key) => {
            if (key in mockStorage.data) result[key] = mockStorage.data[key];
            return result;
          }, {}) :
          { [keys]: mockStorage.data[keys] }
        );
      console.log('📖 Chrome storage GET result:', result);
      return Promise.resolve(result);
    },
    set: (obj) => {
      console.log('💾 Chrome storage SET called with:', obj);
      Object.assign(mockStorage.data, obj);
      console.log('✅ Chrome storage updated, current data:', mockStorage.data);
      return Promise.resolve();
    },
    clear: () => {
      console.log('🗑️ Chrome storage CLEAR called');
      mockStorage.data = {};
      return Promise.resolve();
    }
  }
};

global.chrome = { storage: mockStorage };

// Simulate the ChromeStorageService
class TestChromeStorageService {
  constructor() {
    this.isInitialized = false;
  }

  async initialize() {
    console.log('🚀 ChromeStorageService.initialize()');
    this.isInitialized = true;
  }

  async getUserPreferences() {
    console.log('📖 ChromeStorageService.getUserPreferences()');
    const result = await chrome.storage.local.get(['userPreferences']);
    const preferences = result.userPreferences || {
      enabledCategories: [],
      customPatterns: [],
      privacySettings: {
        allowDataCollection: false,
        shareAnalytics: false
      },
      automationPermissions: {},
      aiProvider: 'openai',
      theme: 'light'
    };
    console.log('📖 getUserPreferences returning:', preferences);
    return preferences;
  }

  async updateUserPreferences(preferences) {
    console.log('💾 ChromeStorageService.updateUserPreferences()');
    console.log('💾 Preferences to save:', preferences);
    await chrome.storage.local.set({ userPreferences: preferences });
    console.log('✅ updateUserPreferences complete');
    return preferences;
  }
}

// Simulate the React component lifecycle
class MockReactComponent {
  constructor() {
    this.config = null;
    this.formData = {
      apiKey: '',
      model: 'gpt-5',
      maxTokens: 8000,
      temperature: 0.7,
      baseUrl: 'https://api.openai.com/v1'
    };
    this.provider = 'openai';
  }

  // Simulate useEffect[config] 
  useEffectConfig(config) {
    console.log('🔧 useEffect[config] triggered with:', config);
    if (config) {
      console.log('✅ Config exists, updating form data');
      this.formData = {
        apiKey: config.apiKey || '',
        model: config.model || 'gpt-5',
        maxTokens: config.maxTokens || 8000,
        temperature: config.temperature || 0.7,
        baseUrl: config.baseUrl || 'https://api.openai.com/v1'
      };
      console.log('🔧 Form data updated to:', this.formData);
      
      if (config.baseUrl?.includes('anthropic') || config.model?.includes('claude')) {
        this.provider = 'claude';
        console.log('🔧 Provider set to Claude');
      } else {
        this.provider = 'openai';
        console.log('🔧 Provider set to OpenAI');
      }
    } else {
      console.log('❌ Config is null/undefined, form data unchanged');
    }
  }

  // Simulate setting config prop
  setConfigProp(newConfig) {
    console.log('⚡ Component prop changed: config =', newConfig);
    this.config = newConfig;
    this.useEffectConfig(newConfig);
  }
}

// Test the complete user workflow
async function testCompleteUserWorkflow() {
  console.log('🧪 Testing Complete User Workflow for AI Configuration Persistence\n');
  
  try {
    // === STEP 1: User opens popup for first time ===
    console.log('=== STEP 1: First Time User Opens Popup ===');
    const storageService = new TestChromeStorageService();
    await storageService.initialize();

    // Load preferences (should be empty)
    const initialPrefs = await storageService.getUserPreferences();
    const initialAiConfig = initialPrefs?.aiConfig || null;
    
    // Simulate React component mounting
    const mockComponent = new MockReactComponent();
    mockComponent.setConfigProp(initialAiConfig);
    
    console.log('📊 Form state after initial load:');
    console.log('  API Key:', mockComponent.formData.apiKey || '(empty)');
    console.log('  Model:', mockComponent.formData.model);
    console.log('  ✅ EXPECTED: Form should be empty\n');

    // === STEP 2: User enters API key and saves ===
    console.log('=== STEP 2: User Enters API Key and Saves ===');
    const userEnteredConfig = {
      apiKey: TEST_API_KEY,
      model: 'gpt-5',
      maxTokens: 8000,
      temperature: 0.7,
      baseUrl: 'https://api.openai.com/v1'
    };

    console.log('👤 User entered config:', userEnteredConfig);

    // Simulate handleSaveAIConfig
    const currentPrefs = await storageService.getUserPreferences();
    const updatedPrefs = {
      ...currentPrefs,
      aiConfig: userEnteredConfig
    };
    await storageService.updateUserPreferences(updatedPrefs);

    // Simulate React state update
    mockComponent.setConfigProp(userEnteredConfig);
    
    console.log('📊 Form state after save:');
    console.log('  API Key:', mockComponent.formData.apiKey.substring(0, 15) + '...');
    console.log('  Model:', mockComponent.formData.model);
    console.log('  ✅ EXPECTED: Form should show saved values\n');

    // === STEP 3: User closes and reopens popup ===
    console.log('=== STEP 3: User Closes and Reopens Popup ===');
    
    // Simulate popup closing (component unmounts)
    console.log('🔄 Popup closed (component unmounted)');
    
    // Create new instances (simulate fresh popup open)
    const newStorageService = new TestChromeStorageService();
    await newStorageService.initialize();
    
    const newMockComponent = new MockReactComponent();
    
    // Simulate the initialization process
    console.log('🔍 Loading AI configuration from storage (fresh popup)...');
    const reloadedPrefs = await newStorageService.getUserPreferences();
    const reloadedAiConfig = reloadedPrefs?.aiConfig || null;
    
    console.log('📖 Reloaded preferences:', reloadedPrefs);
    console.log('🔧 Reloaded AI Config:', reloadedAiConfig);
    
    // Simulate React state initialization and prop passing
    newMockComponent.setConfigProp(reloadedAiConfig);
    
    console.log('📊 Form state after reload:');
    console.log('  API Key:', newMockComponent.formData.apiKey ? 
      newMockComponent.formData.apiKey.substring(0, 15) + '...' : '(empty)');
    console.log('  Model:', newMockComponent.formData.model);
    
    // === STEP 4: Verify persistence ===
    console.log('\n=== STEP 4: Verify Persistence ===');
    const isPersisted = !!(reloadedAiConfig && reloadedAiConfig.apiKey && 
                           newMockComponent.formData.apiKey);
    
    if (isPersisted) {
      console.log('🎉 SUCCESS: AI configuration persisted correctly!');
      console.log('✅ Storage: Config found in chrome.storage.local');
      console.log('✅ Component: Form populated with saved values');
      
      // Verify exact values
      const configsMatch = 
        reloadedAiConfig.apiKey === userEnteredConfig.apiKey &&
        reloadedAiConfig.model === userEnteredConfig.model &&
        newMockComponent.formData.apiKey === userEnteredConfig.apiKey &&
        newMockComponent.formData.model === userEnteredConfig.model;
      
      console.log('✅ Values match:', configsMatch);
      
    } else {
      console.log('❌ FAILURE: AI configuration did not persist!');
      console.log('❌ Issues found:');
      if (!reloadedAiConfig) {
        console.log('  - No config found in storage');
      }
      if (!newMockComponent.formData.apiKey) {
        console.log('  - Form not populated with saved values');
      }
    }

    // === STEP 5: Debug Info ===
    console.log('\n=== STEP 5: Debug Information ===');
    console.log('🔍 Final storage state:', mockStorage.data);
    console.log('🔧 Final component state:');
    console.log('  - config prop:', newMockComponent.config);
    console.log('  - formData:', newMockComponent.formData);
    console.log('  - provider:', newMockComponent.provider);

    return isPersisted;

  } catch (error) {
    console.error('💥 Test failed with error:', error);
    return false;
  }
}

// Test with edge cases
async function testEdgeCases() {
  console.log('\n🧪 Testing Edge Cases\n');
  
  // Clear storage first
  await chrome.storage.local.clear();
  
  const testCases = [
    {
      name: 'Null config',
      config: null,
      expectFormEmpty: true
    },
    {
      name: 'Empty config object',
      config: {},
      expectFormEmpty: true
    },
    {
      name: 'Partial config (only API key)',
      config: { apiKey: 'test-key' },
      expectFormEmpty: false
    },
    {
      name: 'Full config',
      config: {
        apiKey: 'test-full-key',
        model: 'gpt-4o',
        maxTokens: 4000,
        temperature: 0.5,
        baseUrl: 'https://api.openai.com/v1'
      },
      expectFormEmpty: false
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n--- Testing: ${testCase.name} ---`);
    
    const component = new MockReactComponent();
    component.setConfigProp(testCase.config);
    
    const isEmpty = !component.formData.apiKey;
    const expectEmpty = testCase.expectFormEmpty;
    const result = isEmpty === expectEmpty ? '✅ PASS' : '❌ FAIL';
    
    console.log(`${result} - Expected empty: ${expectEmpty}, Got empty: ${isEmpty}`);
    console.log(`Form API Key: ${component.formData.apiKey || '(empty)'}`);
  }
}

// Run all tests
async function runAllTests() {
  const mainTestPassed = await testCompleteUserWorkflow();
  await testEdgeCases();
  
  console.log('\n📊 FINAL SUMMARY:');
  console.log(`Main workflow test: ${mainTestPassed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log('\nIf the main test passed but real extension still has issues,');
  console.log('the problem is likely in:');
  console.log('1. React component re-rendering timing');
  console.log('2. Chrome extension context differences'); 
  console.log('3. Async state updates not being handled properly');
  
  if (!mainTestPassed) {
    console.log('\n🔧 TROUBLESHOOTING STEPS:');
    console.log('1. Check browser console in extension popup');
    console.log('2. Check chrome://extensions developer tools');
    console.log('3. Use the storage inspector: chrome-extension://[id]/check_storage.html');
    console.log('4. Add more debugging logs to React components');
  }
}

runAllTests().catch(console.error);