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
  TaskType,
  AIConfiguration
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
  aiConfigurations: AIConfiguration[];
  activeAIConfigId: string | null;
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

interface AIConfigManagerProps {
  configurations: AIConfiguration[];
  activeConfigId: string | null;
  onSave: (config: AIConfiguration) => void;
  onDelete: (configId: string) => void;
  onSetActive: (configId: string) => void;
  onTest: (config: AIServiceConfig) => Promise<boolean>;
}

interface AIConfigViewProps {
  config: AIConfiguration | null;
  onSave: (config: AIConfiguration) => void;
  onCancel: () => void;
  onTest: (config: AIServiceConfig) => Promise<boolean>;
}

// ============================================================================
// COMPONENT: AI Configuration Manager
// ============================================================================

const AIConfigManager: React.FC<AIConfigManagerProps> = ({
  configurations,
  activeConfigId,
  onSave,
  onDelete,
  onSetActive,
  onTest
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState<AIConfiguration | null>(null);

  const handleAddNew = () => {
    setEditingConfig(null);
    setShowAddForm(true);
  };

  const handleEdit = (config: AIConfiguration) => {
    setEditingConfig(config);
    setShowAddForm(true);
  };

  const handleSave = (config: AIConfiguration) => {
    onSave(config);
    setShowAddForm(false);
    setEditingConfig(null);
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingConfig(null);
  };

  if (showAddForm) {
    return (
      <AIConfigView
        config={editingConfig}
        onSave={handleSave}
        onCancel={handleCancel}
        onTest={onTest}
      />
    );
  }

  return (
    <div className="ai-config-manager">
      <div className="config-header">
        <h2>AI Configurations</h2>
        <button className="btn btn-primary" onClick={handleAddNew}>
          + Add Configuration
        </button>
      </div>

      {configurations.length === 0 ? (
        <div className="empty-state">
          <p>No AI configurations yet. Add one to get started!</p>
        </div>
      ) : (
        <div className="config-list">
          {configurations.map(config => (
            <div key={config.id} className={`config-item ${config.id === activeConfigId ? 'active' : ''}`}>
              <div className="config-info">
                <h3>{config.name}</h3>
                <div className="config-meta">
                  <span className="provider-badge">{config.provider}</span>
                  <span className="model-badge">{config.model}</span>
                  {config.id === activeConfigId && (
                    <span className="active-badge">✓ Active</span>
                  )}
                </div>
              </div>

              <div className="config-actions">
                {config.id !== activeConfigId && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => onSetActive(config.id)}
                  >
                    Activate
                  </button>
                )}
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleEdit(config)}
                >
                  Edit
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => onDelete(config.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Always show the Add Configuration button at the bottom */}
      {configurations.length > 0 && (
        <div className="config-footer">
          <button className="btn btn-primary btn-block" onClick={handleAddNew}>
            + Add Another Configuration
          </button>
        </div>
      )}
    </div>
  );
};

const AIConfigView: React.FC<AIConfigViewProps> = ({ config, onSave, onCancel, onTest }) => {
  const [formData, setFormData] = useState({
    id: config?.id || `config_${Date.now()}`,
    name: config?.name || '',
    provider: config?.provider || 'openai' as 'openai' | 'claude' | 'local',
    apiKey: config?.apiKey || '',
    model: config?.model || 'gpt-5',
    maxTokens: config?.maxTokens || 8000,
    baseUrl: config?.baseUrl || 'https://api.openai.com/v1',
    isActive: config?.isActive || false,
    createdAt: config?.createdAt || new Date(),
    updatedAt: new Date()
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
    onSave(formData as AIConfiguration);
  };

  return (
    <div className="ai-config-view">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">{config ? 'Edit Configuration' : 'New AI Configuration'}</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Configuration Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g., Production OpenAI"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Provider</label>
            <select
              className="form-select"
              value={formData.provider}
              onChange={(e) => setFormData({ ...formData, provider: e.target.value as 'openai' | 'claude' | 'local' })}
            >
              <option value="openai">OpenAI</option>
              <option value="claude">Claude</option>
              <option value="local">Local Model</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">API Key</label>
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
            {formData.provider === 'openai' ? (
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
            ) : formData.provider === 'claude' ? (
              <select
                className="form-select"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              >
                <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet (Latest)</option>
                <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku (Fast)</option>
                <option value="claude-3-opus-20240229">Claude 3 Opus (Most Capable)</option>
                <option value="claude-3-sonnet-20240229">Claude 3 Sonnet (Balanced)</option>
                <option value="claude-3-haiku-20240307">Claude 3 Haiku (Fast)</option>
              </select>
            ) : (
              <input
                type="text"
                className="form-input"
                placeholder="Local model path or identifier"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              />
            )}
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
              type="button"
              className="btn btn-secondary"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!formData.apiKey || !formData.name}
            >
              {config ? 'Update Configuration' : 'Save Configuration'}
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
    aiConfigurations: [],
    activeAIConfigId: null,
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
        const aiConfigurations = preferences?.aiConfigurations || [];
        const activeAIConfigId = preferences?.activeAIConfigId || null;
        const activeConfig = aiConfigurations.find(c => c.id === activeAIConfigId);
        const aiConfig = activeConfig ? {
          apiKey: activeConfig.apiKey,
          model: activeConfig.model,
          maxTokens: activeConfig.maxTokens,
          temperature: activeConfig.temperature,
          baseUrl: activeConfig.baseUrl
        } as AIServiceConfig : null;
        const aiConfigured = !!(activeConfig?.apiKey);
        
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
          aiConfig,
          aiConfigurations,
          activeAIConfigId
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

  const handleSaveAIConfig = useCallback(async (config: AIConfiguration) => {
    try {
      if (!storageService) throw new Error('Storage service not initialized');

      const preferences = await storageService.getUserPreferences();
      const existingConfigs = preferences?.aiConfigurations || [];

      // Check if this is an update or a new configuration
      const existingIndex = existingConfigs.findIndex(c => c.id === config.id);
      let updatedConfigs: AIConfiguration[];

      if (existingIndex >= 0) {
        // Update existing configuration
        updatedConfigs = [...existingConfigs];
        updatedConfigs[existingIndex] = config;
      } else {
        // Add new configuration
        updatedConfigs = [...existingConfigs, config];
      }

      // If this is the first configuration or it's set as active, make it the active one
      const activeConfigId = config.isActive || !preferences?.activeAIConfigId
        ? config.id
        : preferences.activeAIConfigId;

      await storageService.updateUserPreferences({
        ...preferences,
        aiConfigurations: updatedConfigs,
        activeAIConfigId: activeConfigId
      });

      const activeConfig = updatedConfigs.find(c => c.id === activeConfigId);
      const aiServiceConfig = activeConfig ? {
        apiKey: activeConfig.apiKey,
        model: activeConfig.model,
        maxTokens: activeConfig.maxTokens,
        temperature: activeConfig.temperature,
        baseUrl: activeConfig.baseUrl
      } as AIServiceConfig : null;

      setState(prev => ({
        ...prev,
        aiConfigurations: updatedConfigs,
        activeAIConfigId: activeConfigId,
        aiConfig: aiServiceConfig,
        aiConfigured: !!activeConfig?.apiKey
      }));
    } catch (error) {
      handleError(error, { component: 'AIConfig', action: 'save' });
    }
  }, [storageService, handleError]);

  const handleDeleteAIConfig = useCallback(async (configId: string) => {
    try {
      if (!storageService) throw new Error('Storage service not initialized');

      const preferences = await storageService.getUserPreferences();
      const existingConfigs = preferences?.aiConfigurations || [];
      const updatedConfigs = existingConfigs.filter(c => c.id !== configId);

      // If we're deleting the active config, activate another one or null
      let newActiveId = preferences?.activeAIConfigId;
      if (newActiveId === configId) {
        newActiveId = updatedConfigs.length > 0 ? updatedConfigs[0].id : null;
      }

      await storageService.updateUserPreferences({
        ...preferences,
        aiConfigurations: updatedConfigs,
        activeAIConfigId: newActiveId
      });

      const activeConfig = updatedConfigs.find(c => c.id === newActiveId);
      const aiServiceConfig = activeConfig ? {
        apiKey: activeConfig.apiKey,
        model: activeConfig.model,
        maxTokens: activeConfig.maxTokens,
        temperature: activeConfig.temperature,
        baseUrl: activeConfig.baseUrl
      } as AIServiceConfig : null;

      setState(prev => ({
        ...prev,
        aiConfigurations: updatedConfigs,
        activeAIConfigId: newActiveId,
        aiConfig: aiServiceConfig,
        aiConfigured: !!activeConfig?.apiKey
      }));
    } catch (error) {
      handleError(error, { component: 'AIConfig', action: 'delete' });
    }
  }, [storageService, handleError]);

  const handleSetActiveAIConfig = useCallback(async (configId: string) => {
    try {
      if (!storageService) throw new Error('Storage service not initialized');

      const preferences = await storageService.getUserPreferences();
      await storageService.updateUserPreferences({
        ...preferences,
        activeAIConfigId: configId
      });

      const activeConfig = state.aiConfigurations.find(c => c.id === configId);
      const aiServiceConfig = activeConfig ? {
        apiKey: activeConfig.apiKey,
        model: activeConfig.model,
        maxTokens: activeConfig.maxTokens,
        temperature: activeConfig.temperature,
        baseUrl: activeConfig.baseUrl
      } as AIServiceConfig : null;

      setState(prev => ({
        ...prev,
        activeAIConfigId: configId,
        aiConfig: aiServiceConfig,
        aiConfigured: !!activeConfig?.apiKey
      }));
    } catch (error) {
      handleError(error, { component: 'AIConfig', action: 'setActive' });
    }
  }, [storageService, state.aiConfigurations, handleError]);

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
              <AIConfigManager
                configurations={state.aiConfigurations}
                activeConfigId={state.activeAIConfigId}
                onSave={handleSaveAIConfig}
                onDelete={handleDeleteAIConfig}
                onSetActive={handleSetActiveAIConfig}
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