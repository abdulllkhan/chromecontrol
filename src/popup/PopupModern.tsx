import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import ErrorBoundary from '../components/ErrorBoundary';
import ErrorDisplay from '../components/ErrorDisplay';
import LoadingSpinner from '../components/LoadingSpinner';
import useErrorHandler from '../components/useErrorHandler';
import { FullTaskManagement } from '../components/TaskManagement';
import UserPreferencesComponent from '../components/UserPreferences';
import { 
  Suggestion, 
  CustomTask, 
  WebsiteContext, 
  TaskResult, 
  OutputFormat,
  WebsiteCategory,
  PageContent,
  SecurityLevel,
  PageType,
  TaskType
} from '../types';
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
import '../styles/PopupModern.css';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

type ViewType = 'suggestions' | 'tasks' | 'ai' | 'settings';

interface PopupState {
  isLoading: boolean;
  error: string | null;
  suggestions: PrioritizedSuggestion[];
  websiteContext: WebsiteContext | null;
  pageContent: PageContent | null;
  activeView: ViewType;
  customTasks: CustomTask[];
  taskResult: TaskResult | null;
  aiConfigured: boolean;
  aiConfig: AIServiceConfig | null;
  theme: 'light' | 'dark';
  searchQuery: string;
  selectedCategory: string | null;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const getCategoryIcon = (category: string): string => {
  const iconMap: Record<string, string> = {
    [WebsiteCategory.SOCIAL_MEDIA]: '📱',
    [WebsiteCategory.ECOMMERCE]: '🛒',
    [WebsiteCategory.PROFESSIONAL]: '💼',
    [WebsiteCategory.NEWS_CONTENT]: '📰',
    [WebsiteCategory.PRODUCTIVITY]: '⚡',
    [WebsiteCategory.CUSTOM]: '🔧',
    default: '🌐'
  };
  return iconMap[category] || iconMap.default;
};

const getPriorityIcon = (priority: number): string => {
  if (priority > 10) return '🔥';
  if (priority > 5) return '⭐';
  return '💡';
};

// ============================================================================
// COMPONENT: Bottom Navigation
// ============================================================================

interface BottomNavProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  taskCount: number;
  aiConfigured: boolean;
}

const BottomNavigation: React.FC<BottomNavProps> = ({ 
  activeView, 
  onViewChange, 
  taskCount,
  aiConfigured 
}) => {
  return (
    <nav className="bottom-nav">
      <button
        className={`nav-item ${activeView === 'suggestions' ? 'active' : ''}`}
        onClick={() => onViewChange('suggestions')}
      >
        <span className="nav-icon">💡</span>
        <span className="nav-label">Suggestions</span>
      </button>
      
      <button
        className={`nav-item ${activeView === 'tasks' ? 'active' : ''}`}
        onClick={() => onViewChange('tasks')}
      >
        <span className="nav-icon">📋</span>
        <span className="nav-label">Tasks</span>
        {taskCount > 0 && <span className="nav-badge">{taskCount}</span>}
      </button>
      
      <button
        className={`nav-item ${activeView === 'ai' ? 'active' : ''}`}
        onClick={() => onViewChange('ai')}
      >
        <span className="nav-icon">🤖</span>
        <span className="nav-label">AI</span>
        {!aiConfigured && <span className="nav-badge">!</span>}
      </button>
      
      <button
        className={`nav-item ${activeView === 'settings' ? 'active' : ''}`}
        onClick={() => onViewChange('settings')}
      >
        <span className="nav-icon">⚙️</span>
        <span className="nav-label">Settings</span>
      </button>
    </nav>
  );
};

// ============================================================================
// COMPONENT: Modern Suggestion Card
// ============================================================================

interface ModernSuggestionCardProps {
  suggestion: PrioritizedSuggestion;
  onExecute: (suggestion: PrioritizedSuggestion) => void;
  isExecuting: boolean;
}

const ModernSuggestionCard: React.FC<ModernSuggestionCardProps> = ({ 
  suggestion, 
  onExecute, 
  isExecuting 
}) => {
  return (
    <div className="suggestion-card" onClick={() => !isExecuting && onExecute(suggestion)}>
      <div className="suggestion-card-header">
        <div className="suggestion-icon-wrapper">
          <span className="suggestion-icon">
            {suggestion.icon || getCategoryIcon(suggestion.category)}
          </span>
        </div>
        
        <div className="suggestion-content">
          <h3 className="suggestion-title">
            {suggestion.title}
            <span className="suggestion-priority-badge">
              {getPriorityIcon(suggestion.priority)}
            </span>
          </h3>
          <p className="suggestion-description">{suggestion.description}</p>
        </div>
      </div>
      
      <div className="suggestion-meta">
        <div className="meta-item">
          <span className="meta-icon">⏱️</span>
          <span>~{suggestion.estimatedTime}s</span>
        </div>
        
        {suggestion.requiresPermission && (
          <div className="meta-item">
            <span className="meta-icon">🔒</span>
            <span>Permission</span>
          </div>
        )}
        
        {suggestion.isCustom && (
          <div className="meta-item">
            <span className="meta-icon">⚙️</span>
            <span>Custom</span>
          </div>
        )}
      </div>
      
      <div className="suggestion-action">
        <button
          className="btn btn-primary btn-sm"
          onClick={(e) => {
            e.stopPropagation();
            onExecute(suggestion);
          }}
          disabled={isExecuting}
        >
          {isExecuting ? 'Executing...' : 'Execute'}
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// COMPONENT: Suggestions View
// ============================================================================

interface SuggestionsViewProps {
  suggestions: PrioritizedSuggestion[];
  onExecute: (suggestion: PrioritizedSuggestion) => void;
  executingTask: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  aiConfigured: boolean;
  onConfigureAI: () => void;
}

const SuggestionsView: React.FC<SuggestionsViewProps> = ({
  suggestions,
  onExecute,
  executingTask,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  aiConfigured,
  onConfigureAI
}) => {
  const categories = useMemo(() => {
    const cats = new Set(suggestions.map(s => s.category));
    return Array.from(cats);
  }, [suggestions]);

  const filteredSuggestions = useMemo(() => {
    let filtered = suggestions;
    
    if (searchQuery) {
      filtered = filtered.filter(s => 
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (selectedCategory) {
      filtered = filtered.filter(s => s.category === selectedCategory);
    }
    
    return filtered;
  }, [suggestions, searchQuery, selectedCategory]);

  return (
    <div className="suggestions-view">
      {!aiConfigured && (
        <div className="alert alert-warning">
          <span className="alert-icon">🤖</span>
          <div className="alert-content">
            <div className="alert-title">AI Features Disabled</div>
            <div className="alert-message">
              Configure your AI service to unlock intelligent suggestions
            </div>
            <div className="alert-action">
              <button className="btn btn-primary btn-sm" onClick={onConfigureAI}>
                Configure Now
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="search-bar">
        <input
          type="text"
          className="form-input"
          placeholder="Search suggestions..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {categories.length > 1 && (
        <div className="category-filters">
          <button
            className={`btn btn-sm ${!selectedCategory ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => onCategoryChange(null)}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              className={`btn btn-sm ${selectedCategory === cat ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => onCategoryChange(cat)}
            >
              {getCategoryIcon(cat)} {cat}
            </button>
          ))}
        </div>
      )}

      {filteredSuggestions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <h3 className="empty-title">No suggestions found</h3>
          <p className="empty-message">
            {searchQuery 
              ? 'Try adjusting your search terms'
              : 'No suggestions available for this page'}
          </p>
        </div>
      ) : (
        <div className="suggestions-list">
          {filteredSuggestions.map(suggestion => (
            <ModernSuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onExecute={onExecute}
              isExecuting={executingTask === suggestion.id}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// COMPONENT: AI Configuration View
// ============================================================================

interface AIConfigViewProps {
  config: AIServiceConfig | null;
  onSave: (config: AIServiceConfig) => void;
  onTest: (config: AIServiceConfig) => Promise<boolean>;
}

const AIConfigView: React.FC<AIConfigViewProps> = ({ config, onSave, onTest }) => {
  const [formData, setFormData] = useState({
    apiKey: config?.apiKey || '',
    model: config?.model || 'gpt-5',
    maxTokens: config?.maxTokens || 8000,
    baseUrl: config?.baseUrl || 'https://api.openai.com/v1'
  });
  
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTest = async () => {
    setTesting(true);
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
      setTesting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as AIServiceConfig);
  };

  return (
    <div className="ai-config-view">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">AI Configuration</h2>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">OpenAI API Key</label>
            <input
              type="password"
              className="form-input"
              placeholder="sk-..."
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              required
            />
            <div className="form-helper">
              Get your key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">OpenAI Platform</a>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Model</label>
            <select
              className="form-select"
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
            >
              <option value="gpt-5">GPT-5 (Latest)</option>
              <option value="gpt-5-mini">GPT-5 Mini (Fast)</option>
              <option value="gpt-4o">GPT-4o (Optimized)</option>
              <option value="gpt-4o-mini">GPT-4o Mini (Fast)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">
              Max Tokens: {formData.maxTokens}
            </label>
            <input
              type="range"
              min="100"
              max="4000"
              step="100"
              value={formData.maxTokens}
              onChange={(e) => setFormData({ ...formData, maxTokens: parseInt(e.target.value) })}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">API Endpoint</label>
            <input
              type="url"
              className="form-input"
              placeholder="https://api.openai.com/v1"
              value={formData.baseUrl}
              onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
            />
            <div className="form-helper">
              Default: https://api.openai.com/v1
            </div>
          </div>

          {testResult && (
            <div className={`alert ${testResult.success ? 'alert-success' : 'alert-error'}`}>
              <span className="alert-icon">{testResult.success ? '✅' : '❌'}</span>
              <div className="alert-content">
                <div className="alert-message">{testResult.message}</div>
              </div>
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleTest}
              disabled={testing || !formData.apiKey}
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!formData.apiKey}
            >
              Save Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// COMPONENT: Task Result Modal
// ============================================================================

interface TaskResultModalProps {
  result: TaskResult;
  onClose: () => void;
  onCopy: (content: string) => void;
}

const TaskResultModal: React.FC<TaskResultModalProps> = ({ result, onClose, onCopy }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (result.content) {
      onCopy(result.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Task Result</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        
        <div className="modal-body">
          {result.success ? (
            <>
              {result.content && (
                <div className="result-content">
                  <pre>{result.content}</pre>
                </div>
              )}
              {result.automationSummary && (
                <div className="alert alert-info">
                  <span className="alert-icon">ℹ️</span>
                  <div className="alert-content">
                    <div className="alert-message">{result.automationSummary}</div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="alert alert-error">
              <span className="alert-icon">❌</span>
              <div className="alert-content">
                <div className="alert-title">Task Failed</div>
                <div className="alert-message">{result.error || 'Unknown error occurred'}</div>
              </div>
            </div>
          )}
          
          <div className="result-meta">
            <small className="text-secondary">
              Completed in {result.executionTime}ms
            </small>
          </div>
        </div>
        
        <div className="modal-footer">
          {result.success && result.content && (
            <button className="btn btn-secondary" onClick={handleCopy}>
              {copied ? '✓ Copied!' : '📋 Copy'}
            </button>
          )}
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN POPUP COMPONENT
// ============================================================================

export const ModernPopupApp: React.FC = () => {
  const [state, setState] = useState<PopupState>({
    isLoading: true,
    error: null,
    suggestions: [],
    websiteContext: null,
    pageContent: null,
    activeView: 'suggestions',
    customTasks: [],
    taskResult: null,
    aiConfigured: false,
    aiConfig: null,
    theme: 'light',
    searchQuery: '',
    selectedCategory: null
  });
  
  const [executingTask, setExecutingTask] = useState<string | null>(null);
  const [suggestionEngine, setSuggestionEngine] = useState<SuggestionEngine | null>(null);
  const [taskManager, setTaskManager] = useState<TaskManager | null>(null);
  const [storageService, setStorageService] = useState<ChromeStorageService | null>(null);
  
  const { error: globalError, handleError, retry, clearError, executeWithErrorHandling } = useErrorHandler({
    onError: (errorReport) => {
      console.error('Popup error:', errorReport);
      setState(prev => ({ ...prev, error: errorReport.userFriendlyMessage }));
    }
  });

  // Theme management
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' || 'light';
    setState(prev => ({ ...prev, theme: savedTheme }));
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = state.theme === 'light' ? 'dark' : 'light';
    setState(prev => ({ ...prev, theme: newTheme }));
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  }, [state.theme]);

  // Initialize popup
  useEffect(() => {
    const initializePopup = async () => {
      return executeWithErrorHandling(async () => {
        setState(prev => ({ ...prev, isLoading: true, error: null }));
        
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.url) {
          throw new Error('Unable to access current tab');
        }

        const storageService = new ChromeStorageService();
        await storageService.initialize();
        
        const preferences = await storageService.getUserPreferences();
        const aiConfig = preferences?.aiConfig || null;
        const aiConfigured = !!(aiConfig?.apiKey);
        
        const aiService = aiConfigured && aiConfig 
          ? new AIService(aiConfig)
          : demoAIService as any;

        const patternEngine = new PatternEngine();
        const taskManager = new TaskManager({
          storageService,
          aiService,
          enableValidation: true
        });

        const engine = new SuggestionEngine({
          patternEngine,
          taskManager,
          maxSuggestions: 20
        });

        setSuggestionEngine(engine);
        setTaskManager(taskManager);
        setStorageService(storageService);

        const mockPageContent: PageContent = {
          url: tab.url,
          title: tab.title || '',
          headings: [],
          textContent: '',
          forms: [],
          links: [],
          metadata: {},
          extractedAt: new Date()
        };

        const websiteContext = patternEngine.analyzeWebsite(tab.url, mockPageContent);
        
        const suggestionContext: SuggestionContext = {
          websiteContext,
          userPreferences: {
            enabledCategories: Object.values(WebsiteCategory),
            disabledSuggestions: [],
            preferredOutputFormats: ['plain_text']
          },
          recentUsage: []
        };

        const suggestions = await engine.getSuggestions(suggestionContext);
        const customTasks = await taskManager.getAllTasks();
        
        setState(prev => ({
          ...prev,
          isLoading: false,
          websiteContext,
          pageContent: mockPageContent,
          suggestions,
          customTasks: Object.values(customTasks),
          aiConfigured,
          aiConfig
        }));
      });
    };
    
    initializePopup();
  }, []);

  const handleExecuteSuggestion = useCallback(async (suggestion: PrioritizedSuggestion) => {
    setExecutingTask(suggestion.id);
    
    const result = await executeWithErrorHandling(async () => {
      await new Promise(resolve => setTimeout(resolve, suggestion.estimatedTime * 50));
      
      const mockResult: TaskResult = {
        success: true,
        content: `Executed: ${suggestion.title}\n\nThis is a demo result.`,
        format: OutputFormat.PLAIN_TEXT,
        timestamp: new Date(),
        executionTime: suggestion.estimatedTime * 50
      };
      
      setState(prev => ({ ...prev, taskResult: mockResult }));
      return mockResult;
    });
    
    setExecutingTask(null);
  }, [executeWithErrorHandling]);

  const handleSaveAIConfig = useCallback(async (config: AIServiceConfig) => {
    try {
      if (!storageService) throw new Error('Storage service not initialized');
      
      const preferences = await storageService.getUserPreferences();
      await storageService.updateUserPreferences({
        ...preferences,
        aiConfig: config
      });

      setState(prev => ({
        ...prev,
        aiConfig: config,
        aiConfigured: true,
        activeView: 'suggestions'
      }));
    } catch (error) {
      handleError(error, { component: 'AIConfig', action: 'save' });
    }
  }, [storageService, handleError]);

  const handleTestAIConfig = useCallback(async (config: AIServiceConfig): Promise<boolean> => {
    try {
      const testService = new AIService(config);
      // Use the dedicated test connection method
      return await testService.testConnection();
    } catch (error) {
      return false;
    }
  }, []);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }, []);

  if (state.isLoading) {
    return (
      <ErrorBoundary>
        <div className="popup-container">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <div className="loading-text">Loading suggestions...</div>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  if (state.error || globalError) {
    return (
      <ErrorBoundary>
        <div className="popup-container">
          <div className="error-container">
            <ErrorDisplay
              error={globalError?.userFriendlyMessage || state.error || 'An error occurred'}
              type="error"
              onRetry={retry}
              onDismiss={clearError}
            />
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="popup-container">
        <header className="popup-header">
          <div className="header-brand">
            <div className="header-logo">⚡</div>
            <h1 className="header-title">Agentic Assistant</h1>
          </div>
          
          <div className="header-status">
            {state.websiteContext && (
              <div className="website-badge">
                <span className="website-badge-icon">
                  {getCategoryIcon(state.websiteContext.category)}
                </span>
                <span className="website-badge-text">
                  {state.websiteContext.domain}
                </span>
              </div>
            )}
            <button className="theme-toggle" onClick={toggleTheme}>
              {state.theme === 'light' ? '🌙' : '☀️'}
            </button>
          </div>
        </header>
        
        <div className="popup-body">
          <div className="popup-content">
            {state.activeView === 'suggestions' && (
              <SuggestionsView
                suggestions={state.suggestions}
                onExecute={handleExecuteSuggestion}
                executingTask={executingTask}
                searchQuery={state.searchQuery}
                onSearchChange={(q) => setState(prev => ({ ...prev, searchQuery: q }))}
                selectedCategory={state.selectedCategory}
                onCategoryChange={(c) => setState(prev => ({ ...prev, selectedCategory: c }))}
                aiConfigured={state.aiConfigured}
                onConfigureAI={() => setState(prev => ({ ...prev, activeView: 'ai' }))}
              />
            )}
            
            {state.activeView === 'tasks' && taskManager && storageService && (
              <FullTaskManagement
                taskManager={taskManager}
                storageService={storageService}
                onClose={() => setState(prev => ({ ...prev, activeView: 'suggestions' }))}
              />
            )}
            
            {state.activeView === 'ai' && (
              <AIConfigView
                config={state.aiConfig}
                onSave={handleSaveAIConfig}
                onTest={handleTestAIConfig}
              />
            )}
            
            {state.activeView === 'settings' && (
              <UserPreferencesComponent
                onClose={() => setState(prev => ({ ...prev, activeView: 'suggestions' }))}
              />
            )}
          </div>
          
          <BottomNavigation
            activeView={state.activeView}
            onViewChange={(view) => setState(prev => ({ ...prev, activeView: view }))}
            taskCount={state.customTasks.length}
            aiConfigured={state.aiConfigured}
          />
        </div>
        
        {state.taskResult && (
          <TaskResultModal
            result={state.taskResult}
            onClose={() => setState(prev => ({ ...prev, taskResult: null }))}
            onCopy={copyToClipboard}
          />
        )}
      </div>
    </ErrorBoundary>
  );
};

// Initialize React app
const container = document.getElementById('popup-root');
if (container) {
  const root = createRoot(container);
  root.render(<ModernPopupApp />);
}