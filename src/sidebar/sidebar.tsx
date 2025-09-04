import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import ErrorBoundary from '../components/ErrorBoundary';
import ErrorDisplay from '../components/ErrorDisplay';
import LoadingSpinner from '../components/LoadingSpinner';
import useErrorHandler from '../components/useErrorHandler';
import { FullTaskManagement } from '../components/TaskManagement';
import UserPreferencesComponent from '../components/UserPreferences';
import {
  CustomTask,
  WebsiteContext,
  OutputFormat,
  WebsiteCategory,
  PageContent,
  SecurityLevel,
  PageType,
  TaskType
} from '../types';
import type { TaskResult } from '../types';
import {
  SuggestionEngine,
  type SuggestionContext,
  type SuggestionFilter,
  type PrioritizedSuggestion
} from '../services/suggestionEngine';
import { PatternEngine } from '../services/patternEngine';
import { TaskManager } from '../services/taskManager';
import { ChromeStorageService } from '../services/storage';
import { AIService, AIServiceConfig } from '../services/aiService';
import { demoAIService } from '../services/demoAIService';
import '../styles/TaskManagement.css';
import '../styles/UserPreferences.css';
import '../styles/SidebarStyles.css';
import '../styles/Icons.css';
import {
  getCategoryIcon,
  getPriorityIcon,
  EditIcon,
  DeleteIcon,
  CopyIcon,
  CloseIcon,
  CheckIcon,
  ErrorIcon,
  FilterIcon,
  SearchIcon,
  SettingsIcon,
  AIIcon,
  RefreshIcon,
  PlayIcon,
  PauseIcon
} from '../components/icons/IconComponents';

// ============================================================================
// SIDEBAR MAIN COMPONENT
// ============================================================================

interface SidebarState {
  websiteContext: WebsiteContext | null;
  pageContent: PageContent | null;
  suggestions: PrioritizedSuggestion[];
  tasks: CustomTask[];
  isLoading: boolean;
  error: string | null;
  hasAIConfig: boolean;
  activeTab: 'suggestions' | 'tasks' | 'ai' | 'settings';
}

interface AIConfigProps {
  config?: AIServiceConfig;
  onSave: (config: AIServiceConfig) => void;
  onCancel: () => void;
  onTest: (config: AIServiceConfig) => Promise<boolean>;
}

const SidebarApp: React.FC = () => {
  // State management
  const [state, setState] = useState<SidebarState>({
    websiteContext: null,
    pageContent: null,
    suggestions: [],
    tasks: [],
    isLoading: true,
    error: null,
    hasAIConfig: false,
    activeTab: 'suggestions'
  });

  // Service instances
  const [suggestionEngine, setSuggestionEngine] = useState<SuggestionEngine | null>(null);
  const [taskManager, setTaskManager] = useState<TaskManager | null>(null);
  const [storageService, setStorageService] = useState<ChromeStorageService | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'categorized'>('list');
  const [executingTask, setExecutingTask] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TaskResult | null>(null);
  const [showPreferences, setShowPreferences] = useState(false);
  const [showAIConfig, setShowAIConfig] = useState(false);
  const [aiService, setAIService] = useState<AIService | null>(null);
  const [aiConfig, setAIConfig] = useState<AIServiceConfig | null>(null);
  const [provider, setProvider] = useState<'openai' | 'claude'>('openai');

  // Enhanced error handling
  const { error: globalError, retry, clearError, executeWithErrorHandling } = useErrorHandler({
    onError: (errorReport) => {
      console.error('Sidebar error:', errorReport);
      setState(prev => ({ ...prev, error: errorReport.userFriendlyMessage }));
    },
    autoRetry: true,
    maxRetries: 2
  });

  // Initialize sidebar data
  const initializeSidebar = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Get current tab - try multiple approaches for sidebar context
      let tab;
      try {
        [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      } catch (error) {
        console.warn('Failed to get active tab, trying alternative approach:', error);
        // Fallback: get all tabs and find the active one
        try {
          const allTabs = await chrome.tabs.query({ active: true });
          tab = allTabs[0];
        } catch (fallbackError) {
          console.warn('Fallback tab query also failed:', fallbackError);
          // Last resort: get any tab
          const anyTabs = await chrome.tabs.query({});
          tab = anyTabs.find(t => t.active) || anyTabs[0];
        }
      }
      
      if (!tab?.url) {
        // Create a minimal fallback tab context instead of throwing
        console.warn('No active tab found, using fallback context');
        tab = {
          id: undefined,
          url: 'https://example.com',
          title: 'No Active Tab',
          active: false,
          windowId: 0,
          index: 0,
          highlighted: false,
          incognito: false,
          pinned: false
        };
      }
      
      console.log('Current tab:', { id: tab.id, url: tab.url, title: tab.title, isValidTab: !!tab.id });

      // Extract page title properly
      const pageTitle = tab.title || '';
      
      // Initialize storage service
      const storageService = new ChromeStorageService();
      await storageService.initialize();

      // Check AI configuration from user preferences
      console.log('🔍 SIDEBAR: Loading AI configuration from storage...');
      const preferences = await storageService.getUserPreferences();
      console.log('📋 SIDEBAR: Loaded preferences:', preferences);
      const loadedAiConfig = preferences?.aiConfig || null;
      console.log('🔧 SIDEBAR: AI Config from storage:', loadedAiConfig);
      const hasAIConfig = !!(loadedAiConfig?.apiKey);
      console.log('✅ SIDEBAR: AI Configured:', hasAIConfig);
      
      // Store the config in state for the AI config component
      setAIConfig(loadedAiConfig);

      // Initialize AI service if configured
      let currentAIService = null;
      if (hasAIConfig) {
        currentAIService = new AIService(loadedAiConfig);
      } else {
        currentAIService = demoAIService;
      }
      setAIService(currentAIService);

      // Send content script to extract page data
      let websiteContext: WebsiteContext | null = null;
      let pageContent: PageContent | null = null;

      try {
        if (tab.id && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://') && !tab.url.startsWith('moz-extension://') && tab.url !== 'https://example.com') {
          console.log('Attempting content extraction for tab:', tab.id, tab.url);
          
          // First check if we have a valid tab ID
          if (!tab.id) {
            console.warn('No valid tab ID, skipping content script interaction');
            throw new Error('No valid tab ID for content extraction');
          }
          
          // Try to ping the content script to see if it's available
          try {
            await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
            console.log('Content script is responsive');
          } catch (pingError) {
            console.log('Content script not responsive, attempting injection');
            
            // Try to inject content script programmatically
            try {
              await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
              });
              console.log('Content script injected successfully');
              
              // Wait for content script to initialize
              await new Promise(resolve => setTimeout(resolve, 500));
            } catch (injectionError) {
              console.warn('Content script injection failed:', injectionError);
              throw new Error('Could not establish content script connection');
            }
          }
          
          const response = await chrome.tabs.sendMessage(tab.id, {
            type: 'EXTRACT_CONTENT'
          });

          if (response?.success) {
            pageContent = response.content;
            websiteContext = {
              domain: new URL(tab.url).hostname,
              category: WebsiteCategory.CUSTOM,
              pageType: PageType.ARTICLE,
              securityLevel: SecurityLevel.CAUTIOUS,
              extractedData: pageContent || {},
              timestamp: new Date()
            };
            console.log('Content extraction successful');
          } else {
            console.warn('Content extraction returned no data');
          }
        } else {
          console.log('Skipping content extraction for special URL:', tab.url);
        }
      } catch (error) {
        console.warn('Content extraction failed:', error);
        // Create basic context from tab info - handle URL parsing safely
        try {
          const domain = tab.url ? new URL(tab.url).hostname : 'example.com';
          websiteContext = {
            domain: domain,
            category: WebsiteCategory.CUSTOM,
            pageType: PageType.ARTICLE,
            securityLevel: SecurityLevel.CAUTIOUS,
            extractedData: { title: pageTitle, url: tab.url },
            timestamp: new Date()
          };
        } catch (urlError) {
          console.warn('URL parsing failed:', urlError);
          websiteContext = {
            domain: 'example.com',
            category: WebsiteCategory.CUSTOM,
            pageType: PageType.ARTICLE,
            securityLevel: SecurityLevel.CAUTIOUS,
            extractedData: { title: pageTitle || 'Unknown', url: 'https://example.com' },
            timestamp: new Date()
          };
        }
      }

      // Initialize pattern engine
      const patternEngine = new PatternEngine({
        enableBuiltInPatterns: true,
        enableCustomPatterns: true,
        cachePatterns: true,
        maxCacheSize: 100
      });

      // Initialize task manager
      const taskManager = new TaskManager({
        storageService,
        aiService: currentAIService,
        maxConcurrentTasks: 3,
        enableTaskHistory: true,
        defaultTimeout: 30000,
        securityConstraints: {
          maxContentLength: 10000,
          allowedDomains: [],
          restrictedContent: [],
          requireUserConfirmation: false,
          restrictedSelectors: ['input[type="password"]', '[data-sensitive]']
        }
      });

      const engine = new SuggestionEngine({
        patternEngine,
        taskManager,
        maxSuggestions: 20,
        enableBuiltInSuggestions: true,
        enableCustomSuggestions: true,
        enableCaching: true,
        priorityWeights: {
          usage: 1.0,
          recency: 0.8,
          relevance: 1.2,
          category: 0.6
        }
      });

      setSuggestionEngine(engine);
      setTaskManager(taskManager);
      setStorageService(storageService);

      // Load tasks and generate suggestions
      const tasks = await taskManager.getAllTasks();
      let suggestions: PrioritizedSuggestion[] = [];

      if (websiteContext) {
        const suggestionContext: SuggestionContext = {
          websiteContext,
          pageContent,
          userPreferences: await storageService.getUserPreferences() || {
            enabledCategories: Object.values(WebsiteCategory),
            customPatterns: [],
            privacySettings: {
              sharePageContent: true,
              shareFormData: false,
              allowAutomation: true,
              securityLevel: SecurityLevel.CAUTIOUS,
              excludedDomains: []
            },
            automationPermissions: {},
            aiProvider: 'openai',
            theme: 'auto'
          }
        };

        suggestions = await engine.getSuggestions(suggestionContext);
      }

      setState(prev => ({
        ...prev,
        websiteContext,
        pageContent,
        suggestions,
        tasks,
        hasAIConfig,
        isLoading: false,
        error: null
      }));

    } catch (error) {
      console.error('Failed to initialize sidebar:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to initialize sidebar'
      }));
    }
  }, []);

  // Initialize on mount and tab changes
  useEffect(() => {
    initializeSidebar();

    // Listen for tab changes
    const handleTabUpdate = () => {
      initializeSidebar();
    };

    chrome.tabs.onActivated.addListener(handleTabUpdate);
    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
      if (changeInfo.status === 'complete') {
        handleTabUpdate();
      }
    });

    return () => {
      chrome.tabs.onActivated.removeListener(handleTabUpdate);
      chrome.tabs.onUpdated.removeListener(handleTabUpdate);
    };
  }, [initializeSidebar]);

  // Handle suggestion execution
  const handleExecuteSuggestion = useCallback(async (suggestion: PrioritizedSuggestion) => {
    setExecutingTask(suggestion.id);

    await executeWithErrorHandling(async () => {
      if (!taskManager || !state.websiteContext || !state.pageContent) {
        throw new Error('Required services not initialized');
      }

      // Create execution context
      const executionContext = {
        websiteContext: state.websiteContext,
        pageContent: state.pageContent,
        taskId: suggestion.taskId || suggestion.id,
        userInput: {}
      };

      // Try to execute with task manager first
      if (suggestion.taskId && suggestion.isCustom) {
        const taskResult = await taskManager.executeTask(
          suggestion.taskId,
          executionContext.websiteContext,
          executionContext.pageContent,
          executionContext.userInput
        );
        setTestResult(taskResult);
      } else {
        // Handle built-in suggestions
        console.log(`Executing built-in suggestion: ${suggestion.title}`);
        
        // Mock result for built-in suggestions
        const mockResult: TaskResult = {
          success: true,
          content: `Executed suggestion: ${suggestion.title}\n\nDescription: ${suggestion.description}`,
          format: OutputFormat.PLAIN_TEXT,
          timestamp: new Date(),
          executionTime: 500
        };
        setTestResult(mockResult);
      }
    });

    setExecutingTask(null);
  }, [taskManager, state.websiteContext, state.pageContent, executeWithErrorHandling]);

  // Handle AI configuration
  const handleAISave = useCallback(async (config: AIServiceConfig) => {
    console.log('🎯 SIDEBAR: handleAISave called with config:', config);
    
    if (!storageService) {
      console.error('❌ SIDEBAR: Storage service not available');
      setState(prev => ({ ...prev, error: 'Storage service not available' }));
      alert('Storage service not available!');
      return;
    }

    try {
      console.log('💾 SIDEBAR: Starting save process...');
      console.log('💾 SIDEBAR: Config to save:', JSON.stringify(config, null, 2));
      
      // Save AI config to user preferences
      const preferences = await storageService.getUserPreferences();
      console.log('📋 SIDEBAR: Current preferences:', JSON.stringify(preferences, null, 2));
      
      const updatedPreferences = {
        ...preferences,
        aiConfig: config
      };
      console.log('💾 SIDEBAR: Updated preferences to save:', JSON.stringify(updatedPreferences, null, 2));
      
      await storageService.updateUserPreferences(updatedPreferences);
      console.log('✅ SIDEBAR: Preferences saved to storage');
      
      // Verify the save
      const verifyPrefs = await storageService.getUserPreferences();
      console.log('🔍 SIDEBAR: Verification - saved config:', verifyPrefs?.aiConfig);
      
      // Update local state
      console.log('🔧 SIDEBAR: Updating React state...');
      setAIConfig(config);
      
      // Initialize new AI service
      const newAIService = new AIService(config);
      setAIService(newAIService);
      
      setState(prev => ({ ...prev, hasAIConfig: true, error: null }));
      setShowAIConfig(false);
      
      console.log('✅ SIDEBAR: AI configuration saved successfully!');
      alert('AI Configuration saved successfully! Close and reopen sidebar to verify persistence.');
      
      // Reinitialize with new AI service
      await initializeSidebar();
    } catch (error) {
      console.error('❌ SIDEBAR: Failed to save AI config:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save AI configuration';
      setState(prev => ({ ...prev, error: errorMessage }));
      alert('Failed to save configuration: ' + errorMessage);
    }
  }, [storageService, initializeSidebar]);

  const handleAITest = useCallback(async (config: AIServiceConfig): Promise<boolean> => {
    try {
      const testService = new AIService(config);
      // Use the dedicated test connection method
      return await testService.testConnection();
    } catch (error) {
      console.error('AI config test failed:', error);
      return false;
    }
  }, []);

  // Render loading state
  if (state.isLoading) {
    return (
      <div className="sidebar-container">
        <div className="sidebar-header">
          <h1>chromeControl</h1>
        </div>
        <div className="sidebar-loading">
          <LoadingSpinner />
          <p>Loading sidebar...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (state.error || globalError) {
    return (
      <div className="sidebar-container">
        <div className="sidebar-header">
          <h1>chromeControl</h1>
        </div>
        <div className="sidebar-error">
          <ErrorDisplay
            error={state.error || globalError?.userFriendlyMessage || 'Unknown error'}
            onRetry={() => {
              clearError();
              setState(prev => ({ ...prev, error: null }));
              initializeSidebar();
            }}
            onDismiss={() => {
              clearError();
              setState(prev => ({ ...prev, error: null }));
            }}
          />
        </div>
      </div>
    );
  }

  // Main sidebar render
  return (
    <div className="sidebar-container">
      {/* Header */}
      <div className="sidebar-header">
        <h1>chromeControl</h1>
        <div className="sidebar-website-info">
          {state.websiteContext && (
            <span className="website-domain">
              {getCategoryIcon(state.websiteContext.category)} {state.websiteContext.domain}
            </span>
          )}
        </div>
        <div className="sidebar-actions">
          <button 
            className="icon-button"
            onClick={initializeSidebar}
            title="Refresh"
          >
            <RefreshIcon />
          </button>
          <button
            className="icon-button"
            onClick={() => setShowPreferences(true)}
            title="Settings"
          >
            <SettingsIcon />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="sidebar-nav">
        <button
          className={`nav-button ${state.activeTab === 'suggestions' ? 'active' : ''}`}
          onClick={() => setState(prev => ({ ...prev, activeTab: 'suggestions' }))}
        >
          Suggestions
        </button>
        <button
          className={`nav-button ${state.activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setState(prev => ({ ...prev, activeTab: 'tasks' }))}
        >
          Tasks
        </button>
        <button
          className={`nav-button ${state.activeTab === 'ai' ? 'active' : ''} ${!state.hasAIConfig ? 'warning' : ''}`}
          onClick={() => setState(prev => ({ ...prev, activeTab: 'ai' }))}
        >
          AI {!state.hasAIConfig && '(!)'}
        </button>
      </div>

      {/* Content */}
      <div className="sidebar-content">
        {state.activeTab === 'suggestions' && (
          <div className="suggestions-panel">
            <div className="suggestions-header">
              <h3>Smart Suggestions</h3>
              <div className="suggestions-controls">
                <button
                  className={`view-toggle ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                >
                  List
                </button>
                <button
                  className={`view-toggle ${viewMode === 'categorized' ? 'active' : ''}`}
                  onClick={() => setViewMode('categorized')}
                >
                  Categories
                </button>
              </div>
            </div>
            
            {state.suggestions.length === 0 ? (
              <div className="no-suggestions">
                <p>No suggestions available for this page.</p>
                <button onClick={initializeSidebar}>Refresh Suggestions</button>
              </div>
            ) : (
              <div className="suggestions-list">
                {state.suggestions.map(suggestion => (
                  <div key={suggestion.id} className="suggestion-item">
                    <div className="suggestion-content">
                      <h4>{suggestion.title}</h4>
                      <p>{suggestion.description}</p>
                      <div className="suggestion-meta">
                        <span className="suggestion-category">
                          {getCategoryIcon(suggestion.category)} {suggestion.category}
                        </span>
                        <span className="suggestion-priority">
                          {getPriorityIcon(suggestion.priority)} Priority: {suggestion.priority}
                        </span>
                      </div>
                    </div>
                    <div className="suggestion-actions">
                      <button
                        className="execute-button"
                        onClick={() => handleExecuteSuggestion(suggestion)}
                        disabled={executingTask === suggestion.id}
                      >
                        {executingTask === suggestion.id ? <LoadingSpinner /> : <PlayIcon />}
                        {executingTask === suggestion.id ? 'Running...' : 'Execute'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {state.activeTab === 'tasks' && taskManager && storageService && (
          <div className="tasks-panel">
            <FullTaskManagement
              taskManager={taskManager}
              storageService={storageService}
              websiteContext={state.websiteContext}
              pageContent={state.pageContent}
            />
          </div>
        )}

        {state.activeTab === 'ai' && (
          <div className="ai-panel">
            {!state.hasAIConfig ? (
              <div className="ai-setup">
                <h3>AI Configuration Required</h3>
                <p>Configure your AI service to enable intelligent suggestions and automation.</p>
                <button
                  className="setup-ai-button"
                  onClick={() => setShowAIConfig(true)}
                >
                  Configure AI Service
                </button>
              </div>
            ) : (
              <div className="ai-status">
                <h3>AI Service Connected</h3>
                <p>Your AI service is configured and ready.</p>
                <button
                  className="reconfigure-ai-button"
                  onClick={() => setShowAIConfig(true)}
                >
                  Update Configuration
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Test Result Modal */}
      {testResult && (
        <div className="modal-overlay" onClick={() => setTestResult(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Execution Result</h3>
              <button onClick={() => setTestResult(null)}>
                <CloseIcon />
              </button>
            </div>
            <div className="modal-body">
              <div className={`result-status ${testResult.success ? 'success' : 'error'}`}>
                {testResult.success ? <CheckIcon /> : <ErrorIcon />}
                {testResult.success ? 'Success' : 'Failed'}
              </div>
              <div className="result-content">
                <pre>{testResult.content}</pre>
              </div>
              <div className="result-meta">
                <span>Execution time: {testResult.executionTime}ms</span>
                <span>Format: {testResult.format}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preferences Modal */}
      {showPreferences && (
        <div className="modal-overlay">
          <UserPreferencesComponent onClose={() => setShowPreferences(false)} />
        </div>
      )}

      {/* AI Config Modal */}
      {showAIConfig && storageService && (
        <div className="modal-overlay">
          <AIConfigComponent
            key={aiConfig?.apiKey ? `configured-${aiConfig.apiKey.substring(0, 8)}` : 'unconfigured'}
            config={aiConfig}
            onSave={handleAISave}
            onCancel={() => setShowAIConfig(false)}
            onTest={handleAITest}
          />
        </div>
      )}
    </div>
  );
};

// AI Configuration Component (simplified version of popup component)
const AIConfigComponent: React.FC<AIConfigProps> = ({
  config,
  onSave,
  onCancel,
  onTest
}) => {
  const [provider, setProvider] = useState<'openai' | 'claude'>(() => {
    // Determine provider from existing config
    if (config?.baseUrl?.includes('anthropic')) {
      return 'claude';
    }
    return 'openai';
  });
  const [formData, setFormData] = useState({
    apiKey: config?.apiKey || '',
    model: config?.model || (provider === 'openai' ? 'gpt-5' : 'claude-3-5-sonnet-20241022'),
    maxTokens: config?.maxTokens || 8000,
    temperature: config?.temperature || 0.7,
    baseUrl: config?.baseUrl || (provider === 'openai' ? 'https://api.openai.com/v1' : 'https://api.anthropic.com/v1')
  });

  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Force form update when config prop changes with multiple checks (SIDEBAR VERSION)
  useEffect(() => {
    console.log('🔧 SIDEBAR AIConfig useEffect triggered, config:', config);
    
    const updateFormFromConfig = () => {
      if (config && config.apiKey) {
        console.log('✅ SIDEBAR: Config exists with API key, updating form data');
        
        // Detect provider first
        const isClaudeProvider = config.baseUrl?.includes('anthropic') || config.model?.includes('claude');
        const newProvider = isClaudeProvider ? 'claude' : 'openai';
        
        console.log('🔧 SIDEBAR: Detected provider:', newProvider);
        
        const newFormData = {
          apiKey: config.apiKey || '',
          model: config.model || (newProvider === 'openai' ? 'gpt-5' : 'claude-3-5-sonnet-20241022'),
          maxTokens: config.maxTokens || 8000,
          temperature: config.temperature || 0.7,
          baseUrl: config.baseUrl || (newProvider === 'openai' ? 'https://api.openai.com/v1' : 'https://api.anthropic.com/v1')
        };
        
        console.log('🔧 SIDEBAR: Setting form data:', newFormData);
        console.log('🔧 SIDEBAR: Setting provider to:', newProvider);
        
        // Update state with both form data and provider
        setProvider(newProvider);
        setFormData(newFormData);
        
        // Force a second update after a small delay to handle timing issues
        setTimeout(() => {
          console.log('🔄 SIDEBAR: Force refreshing form data to ensure it stuck');
          setFormData(prev => {
            console.log('🔄 SIDEBAR: Current form data in timeout:', prev);
            console.log('🔄 SIDEBAR: Expected form data:', newFormData);
            if (prev.apiKey !== newFormData.apiKey) {
              console.log('⚠️ SIDEBAR: Form data mismatch detected, forcing update');
              return newFormData;
            }
            return prev;
          });
        }, 100);
        
      } else if (config && !config.apiKey) {
        console.log('⚠️ SIDEBAR: Config exists but no API key');
      } else {
        console.log('❌ SIDEBAR: Config is null/undefined');
      }
    };
    
    // Initial update
    updateFormFromConfig();
    
    // Also try updating after a short delay to handle async loading
    const delayedUpdate = setTimeout(() => {
      console.log('⏰ SIDEBAR: Delayed form update check');
      updateFormFromConfig();
    }, 50);
    
    return () => clearTimeout(delayedUpdate);
  }, [config]);

  // Update form data when provider changes (but preserve saved config) - SIDEBAR VERSION
  useEffect(() => {
    console.log('🔧 SIDEBAR: Provider useEffect triggered, provider:', provider, 'config:', config);
    
    // Don't update form if we have a saved config and the provider matches
    if (config && config.apiKey) {
      const configProvider = (config.baseUrl?.includes('anthropic') || config.model?.includes('claude')) ? 'claude' : 'openai';
      if (provider === configProvider) {
        console.log('✅ SIDEBAR: Provider matches saved config, keeping saved values');
        return;
      }
    }
    
    setFormData(prev => {
      const newFormData = {
        ...prev,
        model: provider === 'openai' ? 'gpt-5' : 'claude-3-5-sonnet-20241022',
        baseUrl: provider === 'openai' ? 'https://api.openai.com/v1' : 'https://api.anthropic.com/v1',
        // Preserve API key from config if available, otherwise keep current
        apiKey: config?.apiKey || prev.apiKey
      };
      console.log('🔧 SIDEBAR: Provider change - updating form data:', newFormData);
      return newFormData;
    });
  }, [provider, config]);

  const validateForm = (): boolean => {
    console.log('🔍 SIDEBAR: Validating form...');
    console.log('🔑 SIDEBAR: API Key present:', !!formData.apiKey);
    console.log('🎭 SIDEBAR: Provider:', provider);
    
    const newErrors: Record<string, string> = {};

    if (!formData.apiKey.trim()) {
      newErrors.apiKey = 'API key is required';
      console.log('❌ SIDEBAR: Validation error - API key is empty');
    } else if (provider === 'openai' && !formData.apiKey.startsWith('sk-')) {
      // OpenAI keys can now start with 'sk-proj-' as well
      if (!formData.apiKey.startsWith('sk-proj-')) {
        newErrors.apiKey = 'OpenAI API key should start with "sk-" or "sk-proj-"';
        console.log('❌ SIDEBAR: Validation error - Invalid OpenAI key format');
      }
    } else if (provider === 'claude' && !formData.apiKey.startsWith('sk-ant-')) {
      newErrors.apiKey = 'Claude API key should start with "sk-ant-"';
      console.log('❌ SIDEBAR: Validation error - Invalid Claude key format');
    }

    if (formData.maxTokens < 1 || formData.maxTokens > 200000) {
      newErrors.maxTokens = 'Max tokens must be between 1 and 200000';
    }

    if (formData.temperature < 0 || formData.temperature > 2) {
      newErrors.temperature = 'Temperature must be between 0 and 2';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🚀 SIDEBAR: Save button clicked!');
    console.log('📝 SIDEBAR: Form data to save:', formData);
    
    if (validateForm()) {
      console.log('✅ SIDEBAR: Form validation passed');
      setTestResult({ success: true, message: 'Saving configuration...' });
      
      try {
        console.log('💾 SIDEBAR: Calling onSave with config:', formData);
        await onSave(formData as AIServiceConfig);
        console.log('✅ SIDEBAR: onSave completed successfully');
        setTestResult({ success: true, message: 'Configuration saved successfully!' });
        
        // Add a delay before the success message disappears
        setTimeout(() => {
          setTestResult(null);
        }, 3000);
      } catch (error) {
        console.error('❌ SIDEBAR: Failed to save configuration:', error);
        setTestResult({
          success: false,
          message: 'Failed to save configuration: ' + (error instanceof Error ? error.message : 'Unknown error')
        });
      }
    } else {
      console.log('❌ SIDEBAR: Form validation failed');
      setTestResult({ success: false, message: 'Please fix the errors above' });
    }
  };

  const handleTestConnection = async () => {
    if (!validateForm()) return;

    setIsTestingConnection(true);
    setTestResult(null);

    try {
      const success = await onTest(formData as AIServiceConfig);
      setTestResult({
        success,
        message: success ? 'Connection successful!' : 'Connection failed'
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Test failed: ' + (error instanceof Error ? error.message : 'Unknown error')
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  return (
    <div className="ai-config-modal">
      <div className="modal-header">
        <h3>AI Configuration</h3>
        <button onClick={onCancel} className="btn-close">
          <CloseIcon size={20} />
        </button>
      </div>

      <div className="ai-config-info">
        <p>Configure your AI service to enable intelligent suggestions and automation.</p>
        <div className="info-box">
          <strong>
            {provider === 'openai' ? 'OpenAI' : 'Claude'} API Key Required
          </strong>
          <p>Get your API key from <a 
            href={provider === 'openai' 
              ? 'https://platform.openai.com/api-keys' 
              : 'https://console.anthropic.com/'
            } 
            target="_blank" 
            rel="noopener noreferrer"
          >
            {provider === 'openai' ? 'OpenAI Platform' : 'Anthropic Console'}
          </a></p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="ai-config-form">
        <div className="form-section">
          <div className="form-section-title">
            Provider Selection
          </div>
          
          <div className="provider-selection">
            <div 
              className={`provider-option ${provider === 'openai' ? 'selected' : ''}`}
              onClick={() => setProvider('openai')}
            >
              <div className="provider-logo">OpenAI</div>
              <div className="provider-name">OpenAI</div>
              <div className="provider-description">GPT-5, GPT-4.1, o4-mini</div>
            </div>
            
            <div 
              className={`provider-option ${provider === 'claude' ? 'selected' : ''}`}
              onClick={() => setProvider('claude')}
            >
              <div className="provider-logo">Claude</div>
              <div className="provider-name">Claude</div>
              <div className="provider-description">Anthropic AI Assistant</div>
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-title">
            API Configuration
          </div>

          <div className="form-group">
            <label htmlFor="api-key">API Key *</label>
            <div className="input-with-toggle">
              <input
                id="api-key"
                type="password"
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                className={errors.apiKey ? 'error' : ''}
                placeholder={provider === 'openai' ? 'sk-...' : 'sk-ant-...'}
              />
              <button 
                type="button" 
                className="password-toggle"
                onClick={(e) => {
                  const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                  input.type = input.type === 'password' ? 'text' : 'password';
                  e.currentTarget.textContent = input.type === 'password' ? 'Show' : 'Hide';
                }}
              >
                Show
              </button>
            </div>
            {errors.apiKey && <span className="error-text">{errors.apiKey}</span>}
          </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="model">Model</label>
            <select
              id="model"
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
            >
              {provider === 'openai' ? (
                <>
                  <option value="gpt-5">GPT-5 (Latest)</option>
                  <option value="gpt-4.1">GPT-4.1 (Enhanced)</option>
                  <option value="o4-mini">o4 Mini (Fast & Efficient)</option>
                  <option value="gpt-4o">GPT-4o (Legacy)</option>
                  <option value="gpt-4o-mini">GPT-4o Mini (Legacy)</option>
                  <option value="gpt-4">GPT-4 (Legacy)</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo (Legacy)</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Legacy)</option>
                </>
              ) : (
                <>
                  <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet (Latest)</option>
                  <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku (Fast)</option>
                  <option value="claude-3-opus-20240229">Claude 3 Opus (Most Capable)</option>
                  <option value="claude-3-sonnet-20240229">Claude 3 Sonnet (Balanced)</option>
                  <option value="claude-3-haiku-20240307">Claude 3 Haiku (Fast)</option>
                </>
              )}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="max-tokens">Max Tokens</label>
            <input
              id="max-tokens"
              type="number"
              value={formData.maxTokens}
              onChange={(e) => setFormData({ ...formData, maxTokens: parseInt(e.target.value) })}
              min="1"
              max="200000"
              className={errors.maxTokens ? 'error' : ''}
            />
            {errors.maxTokens && <span className="error-text">{errors.maxTokens}</span>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="temperature">Temperature</label>
            <input
              id="temperature"
              type="number"
              step="0.1"
              value={formData.temperature}
              onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
              min="0"
              max="2"
              className={errors.temperature ? 'error' : ''}
            />
            {errors.temperature && <span className="error-text">{errors.temperature}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="base-url">Base URL</label>
            <input
              id="base-url"
              type="url"
              value={formData.baseUrl}
              onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
              placeholder="https://api.example.com/v1"
            />
          </div>
        </div>
        </div>

        <div className="form-actions">
          <button type="button" onClick={onCancel} className="btn-cancel">Cancel</button>
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTestingConnection}
            className="btn-test"
          >
            {isTestingConnection ? 'Testing...' : 'Test Connection'}
          </button>
          <button type="submit" className="btn-save">Save Configuration</button>
        </div>

        {testResult && (
          <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
            {testResult.message}
          </div>
        )}
      </form>
    </div>
  );
};

// Mount the sidebar app
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('sidebar-root');
  if (container) {
    const root = createRoot(container);
    root.render(
      <ErrorBoundary>
        <SidebarApp />
      </ErrorBoundary>
    );
  }
});

export default SidebarApp;