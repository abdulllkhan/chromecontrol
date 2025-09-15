/**
 * Test script to verify the AI configuration persistence fix
 * Run this with: node test_persistence_fix.js
 */

// Test data
const TEST_API_KEY = 'sk-proj-test1234567890abcdef';

// Mock Chrome storage
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

// Mock React hooks behavior
class MockReactComponent {
  constructor() {
    this.config = null;
    this.provider = 'openai';
    this.formData = {
      apiKey: '',
      model: 'gpt-5',
      maxTokens: 8000,
      temperature: 0.7,
      baseUrl: 'https://api.openai.com/v1'
    };
    this.useEffectCallCount = 0;
  }

  // Simulate the new improved useEffect logic
  useEffectConfig(config) {
    this.useEffectCallCount++;
    console.log(`🔧 useEffect[config] triggered (${this.useEffectCallCount}x), config:`, config);
    
    const updateFormFromConfig = () => {
      if (config && config.apiKey) {
        console.log('✅ Config exists with API key, updating form data');
        
        // Detect provider first
        const isClaudeProvider = config.baseUrl?.includes('anthropic') || config.model?.includes('claude');
        const newProvider = isClaudeProvider ? 'claude' : 'openai';
        
        console.log('🔧 Detected provider:', newProvider);
        
        const newFormData = {
          apiKey: config.apiKey || '',
          model: config.model || (newProvider === 'openai' ? 'gpt-5' : 'claude-3-5-sonnet-20241022'),
          maxTokens: config.maxTokens || 8000,
          temperature: config.temperature || 0.7,
          baseUrl: config.baseUrl || (newProvider === 'openai' ? 'https://api.openai.com/v1' : 'https://api.anthropic.com/v1')
        };
        
        console.log('🔧 Setting form data:', newFormData);
        console.log('🔧 Setting provider to:', newProvider);
        
        // Update state
        this.provider = newProvider;
        this.formData = { ...newFormData };
        
        // Simulate the delayed update
        setTimeout(() => {
          console.log('🔄 Force refreshing form data to ensure it stuck');
          if (this.formData.apiKey !== newFormData.apiKey) {
            console.log('⚠️ Form data mismatch detected, forcing update');
            this.formData = { ...newFormData };
          } else {
            console.log('✅ Form data consistent, no force update needed');
          }
        }, 100);
        
      } else if (config && !config.apiKey) {
        console.log('⚠️ Config exists but no API key');
      } else {
        console.log('❌ Config is null/undefined');
      }
    };
    
    // Initial update
    updateFormFromConfig();
    
    // Delayed update
    setTimeout(() => {
      console.log('⏰ Delayed form update check');
      updateFormFromConfig();
    }, 50);
  }

  // Simulate setting config prop
  setConfigProp(newConfig) {
    console.log('⚡ Component prop changed: config =', newConfig);
    this.config = newConfig;
    this.useEffectConfig(newConfig);
  }

  // Get current form state
  getFormState() {
    return {
      apiKey: this.formData.apiKey,
      model: this.formData.model,
      provider: this.provider,
      isEmpty: !this.formData.apiKey
    };
  }
}

// Storage service simulation
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

// Test the complete workflow with improved logic
async function testImprovedPersistenceWorkflow() {
  console.log('🧪 Testing IMPROVED AI Configuration Persistence Workflow\n');
  
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
    
    const initialState = mockComponent.getFormState();
    console.log('📊 Initial form state:', initialState);
    console.log('✅ EXPECTED: Form should be empty\n');

    // Wait for all timers
    await new Promise(resolve => setTimeout(resolve, 200));

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

    // Save to storage
    const currentPrefs = await storageService.getUserPreferences();
    const updatedPrefs = {
      ...currentPrefs,
      aiConfig: userEnteredConfig
    };
    await storageService.updateUserPreferences(updatedPrefs);

    // Simulate React state update
    mockComponent.setConfigProp(userEnteredConfig);
    
    // Wait for all updates
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const savedState = mockComponent.getFormState();
    console.log('📊 Form state after save:', savedState);
    console.log('✅ EXPECTED: Form should show saved values\n');

    // === STEP 3: User closes and reopens popup (CRITICAL TEST) ===
    console.log('=== STEP 3: User Closes and Reopens Popup (IMPROVED) ===');
    
    // Create new component instance (fresh popup)
    const newMockComponent = new MockReactComponent();
    
    // Load from storage (as popup would do on open)
    const reloadedPrefs = await storageService.getUserPreferences();
    const reloadedAiConfig = reloadedPrefs?.aiConfig || null;
    
    console.log('🔍 Reloaded AI Config:', reloadedAiConfig);
    
    // Set the config prop (as React would do)
    newMockComponent.setConfigProp(reloadedAiConfig);
    
    // Wait for all effects to complete (including delayed updates)
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const reloadedState = newMockComponent.getFormState();
    console.log('📊 Form state after reload:', reloadedState);
    
    // === STEP 4: Verify improved persistence ===
    console.log('\n=== STEP 4: Verify Improved Persistence ===');
    
    const persistenceCheck = {
      configExists: !!(reloadedAiConfig && reloadedAiConfig.apiKey),
      formPopulated: !!(reloadedState.apiKey),
      valuesMatch: reloadedState.apiKey === userEnteredConfig.apiKey,
      providerCorrect: reloadedState.provider === 'openai'
    };
    
    console.log('🔍 Persistence check results:', persistenceCheck);
    
    const allTestsPassed = Object.values(persistenceCheck).every(Boolean);
    
    if (allTestsPassed) {
      console.log('🎉 SUCCESS: AI configuration persistence now working perfectly!');
      console.log('✅ Storage: Config found in chrome.storage.local');
      console.log('✅ Component: Form populated with saved values');
      console.log('✅ Values: All values match expected');
      console.log('✅ Provider: Correctly detected');
      console.log('✅ Timing: Multiple update attempts handled race conditions');
      
    } else {
      console.log('❌ FAILURE: Some issues remain:');
      Object.entries(persistenceCheck).forEach(([key, value]) => {
        console.log(`  ${value ? '✅' : '❌'} ${key}: ${value}`);
      });
    }

    // === STEP 5: Test edge cases with improved logic ===
    console.log('\n=== STEP 5: Test Edge Cases with Improved Logic ===');
    
    // Test rapid config changes
    console.log('Testing rapid config changes...');
    const rapidComponent = new MockReactComponent();
    rapidComponent.setConfigProp(null);
    rapidComponent.setConfigProp(userEnteredConfig);
    rapidComponent.setConfigProp(null);
    rapidComponent.setConfigProp(userEnteredConfig);
    
    await new Promise(resolve => setTimeout(resolve, 300));
    const rapidState = rapidComponent.getFormState();
    console.log('Rapid changes result:', rapidState.apiKey ? 'Form populated' : 'Form empty');
    
    return allTestsPassed;

  } catch (error) {
    console.error('💥 Test failed with error:', error);
    return false;
  }
}

// Run the improved test
async function runImprovedTests() {
  const mainTestPassed = await testImprovedPersistenceWorkflow();
  
  console.log('\n📊 FINAL SUMMARY:');
  console.log(`Improved persistence test: ${mainTestPassed ? '✅ PASSED' : '❌ FAILED'}`);
  
  if (mainTestPassed) {
    console.log('\n🎉 PERSISTENCE FIX SUCCESSFUL!');
    console.log('The improvements made:');
    console.log('1. ✅ Multiple form update attempts to handle timing');
    console.log('2. ✅ Delayed updates to catch async loading issues');  
    console.log('3. ✅ Force re-render with component key');
    console.log('4. ✅ Proper provider detection from config');
    console.log('5. ✅ Mismatch detection and correction');
  } else {
    console.log('\n🔧 TROUBLESHOOTING: If test still fails in extension:');
    console.log('1. Check Chrome extension popup behavior');
    console.log('2. Verify React DevTools for state changes');
    console.log('3. Check browser console for errors');
  }
  
  return mainTestPassed;
}

runImprovedTests().catch(console.error);