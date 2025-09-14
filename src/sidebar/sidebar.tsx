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
  TaskType,
  SecurityConstraints
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
  PauseIcon,
  SendIcon
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
  const [currentExecutingSuggestion, setCurrentExecutingSuggestion] = useState<TaskSuggestion | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);
  const [chatInput, setChatInput] = useState('');
  const [isProcessingChat, setIsProcessingChat] = useState(false);
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
      setAIService(currentAIService as AIService);

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
              extractedData: pageContent ? { title: pageContent.title, url: pageContent.url } : {},
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
        aiService: currentAIService as AIService,
        enableValidation: true,
        enableTesting: false,
        maxExecutionTime: 30000,
        defaultSecurityConstraints: {
          allowSensitiveData: false,
          maxContentLength: 10000,
          allowedDomains: [],
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
      const tasksRecord = await taskManager.getAllTasks();
      const tasks = Object.values(tasksRecord);
      let suggestions: PrioritizedSuggestion[] = [];

      if (websiteContext) {
        const userPrefs = await storageService.getUserPreferences();
        const suggestionContext: SuggestionContext = {
          websiteContext,
          userPreferences: {
            enabledCategories: userPrefs?.enabledCategories || Object.values(WebsiteCategory),
            disabledSuggestions: [],
            preferredOutputFormats: ['plain_text', 'markdown']
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
    setCurrentExecutingSuggestion(suggestion);

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
          executionContext
        );
        setTestResult(taskResult);
        // Add result as first message in chat
        setChatMessages([{
          role: 'assistant',
          content: taskResult.content
        }]);
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
        // Add result as first message in chat
        setChatMessages([{
          role: 'assistant',
          content: mockResult.content
        }]);
      }
    });

    setExecutingTask(null);
    // Don't clear currentExecutingSuggestion here - keep it for the result display
  }, [taskManager, state.websiteContext, state.pageContent, executeWithErrorHandling]);

  // Handle chat messages for follow-up questions
  const handleSendChatMessage = useCallback(async () => {
    if (!chatInput.trim() || !aiService || isProcessingChat) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsProcessingChat(true);

    try {
      // Build context from the original result and previous messages
      const context = `Original task: ${currentExecutingSuggestion?.title || 'Unknown'}
Original result:
${testResult?.content || 'No content'}

Previous conversation:
${chatMessages.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

User's follow-up question: ${userMessage}`;

      // Create default security constraints for chat
      const securityConstraints: SecurityConstraints = {
        allowSensitiveData: false,
        maxContentLength: 50000,
        allowedDomains: state.websiteContext ? [state.websiteContext.domain] : [],
        restrictedSelectors: []
      };

      // Send to AI service
      const response = await aiService.processRequest({
        prompt: context,
        context: state.websiteContext || {
          url: window.location.href,
          domain: window.location.hostname,
          title: document.title || 'Unknown',
          category: WebsiteCategory.OTHER,
          securityLevel: SecurityLevel.MEDIUM,
          pageType: PageType.OTHER,
          timestamp: new Date()
        },
        taskType: TaskType.GENERATE_TEXT,
        outputFormat: OutputFormat.PLAIN_TEXT,
        constraints: securityConstraints,
        timestamp: new Date()
      });

      setChatMessages(prev => [...prev, { role: 'assistant', content: response.content }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Error: ${error instanceof Error ? error.message : 'Failed to process your question'}` 
      }]);
    } finally {
      setIsProcessingChat(false);
    }
  }, [chatInput, aiService, isProcessingChat, currentExecutingSuggestion, testResult, chatMessages, state.websiteContext]);

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
              onClose={() => {}}
              websiteContext={state.websiteContext}
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
                <div className="ai-status-header">
                  <h3>AI Service Connected</h3>
                  <span className="ai-status-badge">Active</span>
                </div>
                
                {aiConfig && (
                  <div className="ai-config-details">
                    <div className="config-section">
                      <h4>Provider</h4>
                      <div className="config-value">
                        {aiConfig.baseUrl?.includes('anthropic') || aiConfig.model?.includes('claude') ? 'Claude' : 'OpenAI'}
                      </div>
                    </div>
                    
                    <div className="config-section">
                      <h4>Model</h4>
                      <div className="config-value">{aiConfig.model}</div>
                    </div>
                    
                    <div className="config-row">
                      <div className="config-section">
                        <h4>Max Tokens</h4>
                        <div className="config-value">{aiConfig.maxTokens?.toLocaleString()}</div>
                      </div>

                      <div className="config-section">
                        <h4>API Endpoint</h4>
                        <div className="config-value" style={{ fontSize: '12px' }}>{aiConfig.baseUrl || 'Default'}</div>
                      </div>
                    </div>
                    
                    <div className="config-section">
                      <h4>Status</h4>
                      <div className="config-value">
                        {aiConfig.apiKey ? 'API Key Configured' : 'No API Key'}
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="ai-actions">
                  <button
                    className="reconfigure-ai-button"
                    onClick={() => setShowAIConfig(true)}
                  >
                    Update Configuration
                  </button>
                  
                  <button
                    className="test-ai-button"
                    onClick={async () => {
                      if (aiConfig) {
                        const success = await handleAITest(aiConfig);
                        alert(success ? 'Connection test successful!' : 'Connection test failed!');
                      }
                    }}
                  >
                    Test Connection
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chat Interface for Task Results */}
      {testResult && (
        <div className="execution-result-overlay">
          <div className="execution-result-header">
            <h3>{currentExecutingSuggestion?.title || 'Task Chat'}</h3>
            <button className="close-result-btn" onClick={() => {
              setTestResult(null);
              setCurrentExecutingSuggestion(null);
              setChatMessages([]);
              setChatInput('');
            }}>
              <CloseIcon />
            </button>
          </div>
          
          {/* Chat Only Body */}
          <div className="chat-only-body">
            {/* Chat Messages */}
            <div className="chat-messages">
              {chatMessages.map((message, index) => (
                <div key={index} className={`chat-message ${message.role}`}>
                  <div className="message-content">
                    {message.content}
                  </div>
                </div>
              ))}
              {isProcessingChat && (
                <div className="chat-message assistant processing">
                  <div className="message-content">
                    <LoadingSpinner size="small" />
                  </div>
                </div>
              )}
            </div>
            
            {/* Chat Input */}
            <div className="chat-input-container">
              <input
                type="text"
                className="chat-input"
                placeholder="Ask a follow-up question..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendChatMessage();
                  }
                }}
                disabled={isProcessingChat || !aiService}
              />
              <button
                className="chat-send-btn"
                onClick={handleSendChatMessage}
                disabled={isProcessingChat || !chatInput.trim() || !aiService}
              >
                {isProcessingChat ? <LoadingSpinner size="small" /> : <SendIcon />}
              </button>
            </div>
            
            {!aiService && (
              <div className="chat-warning">
                Please configure AI settings to use chat feature
              </div>
            )}
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
            config={aiConfig || undefined}
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

    // Temperature validation removed - newer models don't support it

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
    <div className="fullscreen-ai-modal-container">
      <div className="fullscreen-ai-modal-header">
        <h3>AI Configuration</h3>
        <button onClick={onCancel} className="modal-close-btn">
          <CloseIcon size={20} />
        </button>
      </div>

      <div className="fullscreen-ai-modal-body">
        <div className="ai-config-wrapper">
          <div className="ai-config-info">
            <p>Configure your AI service to enable intelligent suggestions and automation.</p>
            <div className="info-alert">
              <span className="alert-icon">i</span>
              <div>
                <strong>{provider === 'openai' ? 'OpenAI' : 'Claude'} API Key Required</strong>
                <p>Get your API key from{' '}
                  <a
                    href={provider === 'openai'
                      ? 'https://platform.openai.com/api-keys'
                      : 'https://console.anthropic.com/'
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="api-link"
                  >
                    {provider === 'openai' ? 'OpenAI Platform' : 'Anthropic Console'}
                  </a>
                </p>
              </div>
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
              <div className="provider-description">GPT-5, GPT-5 Mini, GPT-4o</div>
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
                  const input = document.getElementById('api-key') as HTMLInputElement;
                  if (input) {
                    const isPassword = input.type === 'password';
                    input.type = isPassword ? 'text' : 'password';
                    e.currentTarget.textContent = isPassword ? 'Hide' : 'Show';
                  }
                }}
                title="Toggle visibility"
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
                  <option value="gpt-5-mini">GPT-5 Mini (Fast)</option>
                  <option value="gpt-4o">GPT-4o (Optimized)</option>
                  <option value="gpt-4o-mini">GPT-4o Mini (Fast)</option>
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
          <div className="form-group" style={{ width: '100%' }}>
            <label htmlFor="base-url">API Endpoint</label>
            <input
              id="base-url"
              type="url"
              value={formData.baseUrl}
              onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
              placeholder="https://api.example.com/v1"
              style={{ width: '100%' }}
            />
            <small style={{ color: '#999', fontSize: '12px' }}>
              {provider === 'openai' ? 'Default: https://api.openai.com/v1' : 'Default: https://api.anthropic.com/v1'}
            </small>
          </div>
        </div>
        </div>

            {testResult && (
              <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
                {testResult.message}
              </div>
            )}
          </form>
        </div>
      </div>

      <div className="fullscreen-ai-modal-footer">
        <button type="button" onClick={onCancel} className="btn btn-secondary">
          Cancel
        </button>
        <button
          type="button"
          onClick={handleTestConnection}
          disabled={isTestingConnection}
          className="btn btn-warning"
        >
          {isTestingConnection ? 'Testing...' : 'Test Connection'}
        </button>
        <button onClick={handleSubmit} className="btn btn-primary">
          Save Configuration
        </button>
      </div>
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