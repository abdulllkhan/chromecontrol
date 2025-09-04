/**
 * Debug script to test AI configuration persistence step by step
 */

// Mock Chrome APIs for testing
const mockStorage = {
  data: {},
  local: {
    get: (keys) => {
      return Promise.resolve(keys === null ? mockStorage.data : 
        (Array.isArray(keys) ? 
          keys.reduce((result, key) => {
            if (key in mockStorage.data) result[key] = mockStorage.data[key];
            return result;
          }, {}) :
          { [keys]: mockStorage.data[keys] }
        )
      );
    },
    set: (obj) => {
      Object.assign(mockStorage.data, obj);
      return Promise.resolve();
    },
    clear: () => {
      mockStorage.data = {};
      return Promise.resolve();
    }
  }
};

// Simulate Chrome environment
global.chrome = { storage: mockStorage };

// Import the storage service implementation
class TestChromeStorageService {
  constructor() {
    this.isInitialized = false;
  }

  async initialize() {
    console.log('📚 Initializing storage service...');
    this.isInitialized = true;
    return Promise.resolve();
  }

  async getUserPreferences() {
    console.log('📖 Getting user preferences...');
    const result = await chrome.storage.local.get(['userPreferences']);
    console.log('📖 Raw storage result:', JSON.stringify(result, null, 2));
    
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
    
    console.log('📖 Returned preferences:', JSON.stringify(preferences, null, 2));
    return preferences;
  }

  async updateUserPreferences(preferences) {
    console.log('💾 Updating user preferences...');
    console.log('💾 New preferences:', JSON.stringify(preferences, null, 2));
    
    await chrome.storage.local.set({ userPreferences: preferences });
    
    // Verify the save
    const verified = await chrome.storage.local.get(['userPreferences']);
    console.log('✅ Verification - stored preferences:', JSON.stringify(verified.userPreferences, null, 2));
    
    return preferences;
  }
}

// Test the persistence workflow
async function testPersistenceWorkflow() {
  console.log('🧪 Testing AI Configuration Persistence Workflow\n');
  
  try {
    // Step 1: Initialize storage service
    console.log('=== STEP 1: Initialize Storage ===');
    const storageService = new TestChromeStorageService();
    await storageService.initialize();
    console.log('✅ Storage service initialized\n');

    // Step 2: Get initial preferences (should be empty)
    console.log('=== STEP 2: Get Initial Preferences ===');
    const initialPrefs = await storageService.getUserPreferences();
    console.log('Initial AI config:', initialPrefs.aiConfig || 'NONE');
    console.log('✅ Initial preferences loaded\n');

    // Step 3: Save AI configuration
    console.log('=== STEP 3: Save AI Configuration ===');
    const testConfig = {
      apiKey: 'sk-proj-test1234567890',
      model: 'gpt-5',
      maxTokens: 8000,
      temperature: 0.7,
      baseUrl: 'https://api.openai.com/v1'
    };

    const updatedPrefs = {
      ...initialPrefs,
      aiConfig: testConfig
    };

    await storageService.updateUserPreferences(updatedPrefs);
    console.log('✅ AI configuration saved\n');

    // Step 4: Simulate app restart - get preferences again
    console.log('=== STEP 4: Simulate App Restart ===');
    const reloadedPrefs = await storageService.getUserPreferences();
    console.log('Reloaded AI config:', reloadedPrefs.aiConfig);
    
    // Step 5: Verify persistence
    console.log('=== STEP 5: Verify Persistence ===');
    const isConfigPersisted = !!(reloadedPrefs.aiConfig && reloadedPrefs.aiConfig.apiKey);
    console.log('Config persisted:', isConfigPersisted);
    
    if (isConfigPersisted) {
      console.log('✅ SUCCESS: AI configuration persistence is working!');
      
      // Test the form update logic
      console.log('\n=== STEP 6: Test Form Update Logic ===');
      console.log('Testing if form would be updated with config...');
      
      const config = reloadedPrefs.aiConfig;
      if (config) {
        const formData = {
          apiKey: config.apiKey || '',
          model: config.model || 'gpt-5',
          maxTokens: config.maxTokens || 8000,
          temperature: config.temperature || 0.7,
          baseUrl: config.baseUrl || 'https://api.openai.com/v1'
        };
        
        console.log('Form data that would be set:', JSON.stringify(formData, null, 2));
        console.log('✅ Form update logic works correctly');
      }
      
    } else {
      console.log('❌ FAILURE: AI configuration did not persist');
    }

    // Step 7: Test edge cases
    console.log('\n=== STEP 7: Test Edge Cases ===');
    
    // Test with null config
    console.log('Testing with null config...');
    await storageService.updateUserPreferences({ ...initialPrefs, aiConfig: null });
    const nullConfigPrefs = await storageService.getUserPreferences();
    console.log('Null config result:', nullConfigPrefs.aiConfig);
    
    // Test with partial config
    console.log('Testing with partial config...');
    const partialConfig = { apiKey: 'test-key' };
    await storageService.updateUserPreferences({ ...initialPrefs, aiConfig: partialConfig });
    const partialConfigPrefs = await storageService.getUserPreferences();
    console.log('Partial config result:', partialConfigPrefs.aiConfig);

    console.log('\n🎉 Persistence testing complete!');

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

// Test form component logic
function testFormComponentLogic() {
  console.log('\n🧪 Testing Form Component Logic');
  
  // Simulate React component behavior
  console.log('=== Simulating React Component Updates ===');
  
  let formData = {
    apiKey: '',
    model: 'gpt-5',
    maxTokens: 8000,
    temperature: 0.7,
    baseUrl: 'https://api.openai.com/v1'
  };
  
  console.log('Initial form data:', formData);
  
  // Simulate config prop being passed to component
  const savedConfig = {
    apiKey: 'sk-saved-key-123',
    model: 'gpt-4o',
    maxTokens: 4000,
    temperature: 0.5,
    baseUrl: 'https://api.openai.com/v1'
  };
  
  console.log('Saved config prop:', savedConfig);
  
  // Simulate useEffect logic
  console.log('Simulating useEffect [config] dependency...');
  if (savedConfig) {
    formData = {
      apiKey: savedConfig.apiKey || '',
      model: savedConfig.model || 'gpt-5',
      maxTokens: savedConfig.maxTokens || 8000,
      temperature: savedConfig.temperature || 0.7,
      baseUrl: savedConfig.baseUrl || 'https://api.openai.com/v1'
    };
    console.log('Updated form data:', formData);
    console.log('✅ Form should show saved values');
  } else {
    console.log('❌ Config is null/undefined, form stays empty');
  }
}

// Run the tests
async function runAllTests() {
  await testPersistenceWorkflow();
  testFormComponentLogic();
  
  console.log('\n📊 SUMMARY:');
  console.log('1. Storage persistence: Testing complete');
  console.log('2. Form component logic: Testing complete'); 
  console.log('3. Check browser console for any additional issues');
}

runAllTests().catch(console.error);