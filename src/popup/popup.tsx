import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import ErrorBoundary from '../components/ErrorBoundary';
import LoadingSpinner from '../components/LoadingSpinner';
import { 
  Suggestion, 
  CustomTask, 
  WebsiteContext, 
  TaskResult, 
  OutputFormat,
  WebsiteCategory 
} from '../types';

// ============================================================================
// INTERFACES
// ============================================================================

interface PopupState {
  isLoading: boolean;
  error: string | null;
  suggestions: Suggestion[];
  websiteContext: WebsiteContext | null;
  activeView: 'suggestions' | 'task-management' | 'add-task';
  customTasks: CustomTask[];
  selectedTask: CustomTask | null;
  taskResult: TaskResult | null;
  copiedText: string | null;
}

interface SuggestionCardProps {
  suggestion: Suggestion;
  onExecute: (suggestion: Suggestion) => void;
  isExecuting: boolean;
}

interface TaskResultProps {
  result: TaskResult;
  onCopy: (content: string) => void;
  onClose: () => void;
  copiedText: string | null;
}

interface TaskFormProps {
  task?: CustomTask;
  websiteContext: WebsiteContext | null;
  onSave: (task: Partial<CustomTask>) => void;
  onCancel: () => void;
}

interface TaskManagementProps {
  tasks: CustomTask[];
  onEdit: (task: CustomTask) => void;
  onDelete: (taskId: string) => void;
  onToggle: (taskId: string, enabled: boolean) => void;
  onAddNew: () => void;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
};

const formatContent = (content: string, format: OutputFormat): string => {
  switch (format) {
    case OutputFormat.HTML:
      // Strip HTML tags for display but keep for copying
      return content.replace(/<[^>]*>/g, '');
    case OutputFormat.MARKDOWN:
      // Basic markdown formatting for display
      return content
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/`(.*?)`/g, '$1');
    case OutputFormat.JSON:
      try {
        return JSON.stringify(JSON.parse(content), null, 2);
      } catch {
        return content;
      }
    default:
      return content;
  }
};

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

// ============================================================================
// COMPONENTS
// ============================================================================

const SuggestionCard: React.FC<SuggestionCardProps> = ({ 
  suggestion, 
  onExecute, 
  isExecuting 
}) => {
  return (
    <div className="suggestion-card">
      <div className="suggestion-header">
        <span className="suggestion-icon">
          {suggestion.icon || getCategoryIcon(suggestion.category)}
        </span>
        <div className="suggestion-content">
          <h3 className="suggestion-title">{suggestion.title}</h3>
          <p className="suggestion-description">{suggestion.description}</p>
        </div>
      </div>
      
      <div className="suggestion-footer">
        <div className="suggestion-meta">
          <span className="suggestion-time">~{suggestion.estimatedTime}s</span>
          {suggestion.requiresPermission && (
            <span className="suggestion-permission">🔒</span>
          )}
          {suggestion.isCustom && (
            <span className="suggestion-custom">Custom</span>
          )}
        </div>
        
        <button
          className="btn btn-primary suggestion-execute"
          onClick={() => onExecute(suggestion)}
          disabled={isExecuting}
        >
          {isExecuting ? 'Running...' : 'Execute'}
        </button>
      </div>
    </div>
  );
};

const TaskResult: React.FC<TaskResultProps> = ({ 
  result, 
  onCopy, 
  onClose, 
  copiedText 
}) => {
  const [showRaw, setShowRaw] = useState(false);
  
  const displayContent = result.content ? formatContent(result.content, result.format) : '';
  const rawContent = result.content || '';
  
  return (
    <div className="task-result">
      <div className="task-result-header">
        <h3>Task Result</h3>
        <button className="btn btn-secondary" onClick={onClose}>
          ✕
        </button>
      </div>
      
      {result.success ? (
        <div className="task-result-content">
          {result.content && (
            <>
              <div className="task-result-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => onCopy(rawContent)}
                >
                  {copiedText === rawContent ? '✓ Copied!' : '📋 Copy'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowRaw(!showRaw)}
                >
                  {showRaw ? 'Formatted' : 'Raw'}
                </button>
              </div>
              
              <div className="task-result-text">
                <pre>{showRaw ? rawContent : displayContent}</pre>
              </div>
            </>
          )}
          
          {result.automationSummary && (
            <div className="automation-summary">
              <h4>Automation Summary</h4>
              <p>{result.automationSummary}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="task-result-error">
          <h4>Task Failed</h4>
          <p>{result.error || 'An unknown error occurred'}</p>
        </div>
      )}
      
      <div className="task-result-meta">
        <small>
          Completed in {result.executionTime}ms at {result.timestamp.toLocaleTimeString()}
        </small>
      </div>
    </div>
  );
};

const TaskForm: React.FC<TaskFormProps> = ({ 
  task, 
  websiteContext, 
  onSave, 
  onCancel 
}) => {
  const [formData, setFormData] = useState({
    name: task?.name || '',
    description: task?.description || '',
    promptTemplate: task?.promptTemplate || '',
    websitePatterns: task?.websitePatterns?.join(', ') || (websiteContext?.domain || ''),
    outputFormat: task?.outputFormat || OutputFormat.PLAIN_TEXT,
    tags: task?.tags?.join(', ') || ''
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Task name is required';
    }
    
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }
    
    if (!formData.promptTemplate.trim()) {
      newErrors.promptTemplate = 'Prompt template is required';
    }
    
    if (!formData.websitePatterns.trim()) {
      newErrors.websitePatterns = 'At least one website pattern is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    const taskData: Partial<CustomTask> = {
      ...task,
      name: formData.name.trim(),
      description: formData.description.trim(),
      promptTemplate: formData.promptTemplate.trim(),
      websitePatterns: formData.websitePatterns.split(',').map(p => p.trim()).filter(Boolean),
      outputFormat: formData.outputFormat,
      tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      updatedAt: new Date()
    };
    
    if (!task) {
      taskData.id = `task_${Date.now()}`;
      taskData.createdAt = new Date();
      taskData.usageCount = 0;
      taskData.isEnabled = true;
    }
    
    onSave(taskData);
  };
  
  return (
    <div className="task-form">
      <div className="task-form-header">
        <h3>{task ? 'Edit Task' : 'Add New Task'}</h3>
        <button className="btn btn-secondary" onClick={onCancel}>
          ✕
        </button>
      </div>
      
      <form onSubmit={handleSubmit} className="task-form-content">
        <div className="form-group">
          <label htmlFor="task-name">Task Name *</label>
          <input
            id="task-name"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className={errors.name ? 'error' : ''}
            placeholder="e.g., Generate social media post"
          />
          {errors.name && <span className="error-text">{errors.name}</span>}
        </div>
        
        <div className="form-group">
          <label htmlFor="task-description">Description *</label>
          <textarea
            id="task-description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className={errors.description ? 'error' : ''}
            placeholder="Describe what this task does..."
            rows={3}
          />
          {errors.description && <span className="error-text">{errors.description}</span>}
        </div>
        
        <div className="form-group">
          <label htmlFor="task-prompt">Prompt Template *</label>
          <textarea
            id="task-prompt"
            value={formData.promptTemplate}
            onChange={(e) => setFormData({ ...formData, promptTemplate: e.target.value })}
            className={errors.promptTemplate ? 'error' : ''}
            placeholder="Write a prompt template using {{variables}} for dynamic content..."
            rows={4}
          />
          {errors.promptTemplate && <span className="error-text">{errors.promptTemplate}</span>}
        </div>
        
        <div className="form-group">
          <label htmlFor="task-patterns">Website Patterns *</label>
          <input
            id="task-patterns"
            type="text"
            value={formData.websitePatterns}
            onChange={(e) => setFormData({ ...formData, websitePatterns: e.target.value })}
            className={errors.websitePatterns ? 'error' : ''}
            placeholder="example.com, *.social.com, reddit.com"
          />
          {errors.websitePatterns && <span className="error-text">{errors.websitePatterns}</span>}
          <small>Comma-separated list of domains or patterns</small>
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="task-format">Output Format</label>
            <select
              id="task-format"
              value={formData.outputFormat}
              onChange={(e) => setFormData({ ...formData, outputFormat: e.target.value as OutputFormat })}
            >
              <option value={OutputFormat.PLAIN_TEXT}>Plain Text</option>
              <option value={OutputFormat.HTML}>HTML</option>
              <option value={OutputFormat.MARKDOWN}>Markdown</option>
              <option value={OutputFormat.JSON}>JSON</option>
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="task-tags">Tags</label>
            <input
              id="task-tags"
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="social, content, automation"
            />
          </div>
        </div>
        
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            {task ? 'Update Task' : 'Create Task'}
          </button>
        </div>
      </form>
    </div>
  );
};

const TaskManagement: React.FC<TaskManagementProps> = ({ 
  tasks, 
  onEdit, 
  onDelete, 
  onToggle, 
  onAddNew 
}) => {
  const [filter, setFilter] = useState('');
  
  const filteredTasks = tasks.filter(task =>
    task.name.toLowerCase().includes(filter.toLowerCase()) ||
    task.description.toLowerCase().includes(filter.toLowerCase()) ||
    task.tags.some(tag => tag.toLowerCase().includes(filter.toLowerCase()))
  );
  
  return (
    <div className="task-management">
      <div className="task-management-header">
        <h3>Manage Tasks</h3>
        <button className="btn btn-primary" onClick={onAddNew}>
          + Add Task
        </button>
      </div>
      
      <div className="task-management-controls">
        <input
          type="text"
          placeholder="Search tasks..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="task-search"
        />
      </div>
      
      <div className="task-list">
        {filteredTasks.length === 0 ? (
          <div className="empty-state">
            <p>No tasks found. {filter ? 'Try a different search.' : 'Create your first task!'}</p>
          </div>
        ) : (
          filteredTasks.map(task => (
            <div key={task.id} className={`task-item ${!task.isEnabled ? 'disabled' : ''}`}>
              <div className="task-item-header">
                <div className="task-item-info">
                  <h4>{task.name}</h4>
                  <p>{task.description}</p>
                </div>
                <div className="task-item-actions">
                  <button
                    className="btn btn-small btn-secondary"
                    onClick={() => onToggle(task.id, !task.isEnabled)}
                    title={task.isEnabled ? 'Disable task' : 'Enable task'}
                  >
                    {task.isEnabled ? '👁️' : '👁️‍🗨️'}
                  </button>
                  <button
                    className="btn btn-small btn-secondary"
                    onClick={() => onEdit(task)}
                    title="Edit task"
                  >
                    ✏️
                  </button>
                  <button
                    className="btn btn-small btn-danger"
                    onClick={() => onDelete(task.id)}
                    title="Delete task"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              
              <div className="task-item-meta">
                <span className="task-patterns">
                  {task.websitePatterns.slice(0, 2).join(', ')}
                  {task.websitePatterns.length > 2 && ` +${task.websitePatterns.length - 2} more`}
                </span>
                <span className="task-usage">Used {task.usageCount} times</span>
                {task.tags.length > 0 && (
                  <div className="task-tags">
                    {task.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="tag">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN POPUP COMPONENT
// ============================================================================

export const PopupApp: React.FC = () => {
  const [state, setState] = useState<PopupState>({
    isLoading: true,
    error: null,
    suggestions: [],
    websiteContext: null,
    activeView: 'suggestions',
    customTasks: [],
    selectedTask: null,
    taskResult: null,
    copiedText: null
  });
  
  const [executingTask, setExecutingTask] = useState<string | null>(null);
  
  // Initialize popup data
  useEffect(() => {
    const initializePopup = async () => {
      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }));
        
        // Get current tab info
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.url) {
          throw new Error('Unable to access current tab');
        }
        
        // Mock website context for now - will be replaced with actual pattern engine
        const mockContext: WebsiteContext = {
          domain: new URL(tab.url).hostname,
          category: WebsiteCategory.CUSTOM,
          pageType: 'other' as any,
          extractedData: {},
          securityLevel: 'public' as any,
          timestamp: new Date()
        };
        
        // Mock suggestions - will be replaced with actual suggestion engine
        const mockSuggestions: Suggestion[] = [
          {
            id: 'suggest-1',
            title: 'Summarize Page',
            description: 'Generate a concise summary of the current page content',
            category: 'content',
            estimatedTime: 5,
            requiresPermission: false,
            isCustom: false,
            icon: '📄'
          },
          {
            id: 'suggest-2',
            title: 'Extract Key Points',
            description: 'Identify and list the main points from this page',
            category: 'analysis',
            estimatedTime: 8,
            requiresPermission: false,
            isCustom: false,
            icon: '🎯'
          }
        ];
        
        // Load custom tasks from storage
        const result = await chrome.storage.local.get(['customTasks']);
        const customTasks: CustomTask[] = Object.values(result.customTasks || {});
        
        setState(prev => ({
          ...prev,
          isLoading: false,
          websiteContext: mockContext,
          suggestions: mockSuggestions,
          customTasks
        }));
        
      } catch (error) {
        console.error('Failed to initialize popup:', error);
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to initialize'
        }));
      }
    };
    
    initializePopup();
  }, []);
  
  // Clear copied text after delay
  useEffect(() => {
    if (state.copiedText) {
      const timer = setTimeout(() => {
        setState(prev => ({ ...prev, copiedText: null }));
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [state.copiedText]);
  
  const handleExecuteSuggestion = useCallback(async (suggestion: Suggestion) => {
    try {
      setExecutingTask(suggestion.id);
      setState(prev => ({ ...prev, error: null }));
      
      // Mock task execution - will be replaced with actual AI service
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockResult: TaskResult = {
        success: true,
        content: `This is a mock result for "${suggestion.title}". The actual implementation will integrate with the AI service to process the request and return real results.`,
        format: OutputFormat.PLAIN_TEXT,
        timestamp: new Date(),
        executionTime: 2000
      };
      
      setState(prev => ({ ...prev, taskResult: mockResult }));
      
    } catch (error) {
      console.error('Failed to execute suggestion:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to execute task'
      }));
    } finally {
      setExecutingTask(null);
    }
  }, []);
  
  const handleCopyContent = useCallback(async (content: string) => {
    const success = await copyToClipboard(content);
    if (success) {
      setState(prev => ({ ...prev, copiedText: content }));
    } else {
      setState(prev => ({ ...prev, error: 'Failed to copy to clipboard' }));
    }
  }, []);
  
  const handleSaveTask = useCallback(async (taskData: Partial<CustomTask>) => {
    try {
      const result = await chrome.storage.local.get(['customTasks']);
      const customTasks = result.customTasks || {};
      
      if (taskData.id) {
        customTasks[taskData.id] = { ...customTasks[taskData.id], ...taskData };
      } else {
        const newTask = taskData as CustomTask;
        customTasks[newTask.id] = newTask;
      }
      
      await chrome.storage.local.set({ customTasks });
      
      setState(prev => ({
        ...prev,
        customTasks: Object.values(customTasks),
        activeView: 'task-management',
        selectedTask: null
      }));
      
    } catch (error) {
      console.error('Failed to save task:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to save task'
      }));
    }
  }, []);
  
  const handleDeleteTask = useCallback(async (taskId: string) => {
    try {
      const result = await chrome.storage.local.get(['customTasks']);
      const customTasks = result.customTasks || {};
      
      delete customTasks[taskId];
      await chrome.storage.local.set({ customTasks });
      
      setState(prev => ({
        ...prev,
        customTasks: Object.values(customTasks)
      }));
      
    } catch (error) {
      console.error('Failed to delete task:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to delete task'
      }));
    }
  }, []);
  
  const handleToggleTask = useCallback(async (taskId: string, enabled: boolean) => {
    try {
      const result = await chrome.storage.local.get(['customTasks']);
      const customTasks = result.customTasks || {};
      
      if (customTasks[taskId]) {
        customTasks[taskId].isEnabled = enabled;
        await chrome.storage.local.set({ customTasks });
        
        setState(prev => ({
          ...prev,
          customTasks: Object.values(customTasks)
        }));
      }
      
    } catch (error) {
      console.error('Failed to toggle task:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to update task'
      }));
    }
  }, []);
  
  // Render loading state
  if (state.isLoading) {
    return (
      <ErrorBoundary>
        <div className="popup-container">
          <LoadingSpinner message="Loading suggestions..." />
        </div>
      </ErrorBoundary>
    );
  }
  
  // Render error state
  if (state.error) {
    return (
      <ErrorBoundary>
        <div className="popup-container">
          <div className="error-container">
            <h3>Error</h3>
            <p>{state.error}</p>
            <button 
              className="btn btn-primary"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        </div>
      </ErrorBoundary>
    );
  }
  
  return (
    <ErrorBoundary>
      <div className="popup-container">
        {/* Header */}
        <div className="popup-header">
          <h1>Agentic Assistant</h1>
          {state.websiteContext && (
            <div className="website-info">
              <span className="website-icon">
                {getCategoryIcon(state.websiteContext.category)}
              </span>
              <span className="website-domain">{state.websiteContext.domain}</span>
            </div>
          )}
        </div>
        
        {/* Navigation */}
        <div className="popup-nav">
          <button
            className={`nav-btn ${state.activeView === 'suggestions' ? 'active' : ''}`}
            onClick={() => setState(prev => ({ ...prev, activeView: 'suggestions', taskResult: null }))}
          >
            Suggestions
          </button>
          <button
            className={`nav-btn ${state.activeView === 'task-management' ? 'active' : ''}`}
            onClick={() => setState(prev => ({ ...prev, activeView: 'task-management', selectedTask: null }))}
          >
            Tasks ({state.customTasks.length})
          </button>
        </div>
        
        {/* Content */}
        <div className="popup-content">
          {state.activeView === 'suggestions' && (
            <>
              {state.taskResult ? (
                <TaskResult
                  result={state.taskResult}
                  onCopy={handleCopyContent}
                  onClose={() => setState(prev => ({ ...prev, taskResult: null }))}
                  copiedText={state.copiedText}
                />
              ) : (
                <div className="suggestions-container">
                  <div className="suggestions-header">
                    <h2>Available Suggestions</h2>
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={() => setState(prev => ({ ...prev, activeView: 'add-task' }))}
                    >
                      + Add Task
                    </button>
                  </div>
                  
                  <div className="suggestions-list">
                    {state.suggestions.length === 0 ? (
                      <div className="empty-state">
                        <p>No suggestions available for this website.</p>
                        <button
                          className="btn btn-primary"
                          onClick={() => setState(prev => ({ ...prev, activeView: 'add-task' }))}
                        >
                          Create Custom Task
                        </button>
                      </div>
                    ) : (
                      state.suggestions.map(suggestion => (
                        <SuggestionCard
                          key={suggestion.id}
                          suggestion={suggestion}
                          onExecute={handleExecuteSuggestion}
                          isExecuting={executingTask === suggestion.id}
                        />
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}
          
          {state.activeView === 'task-management' && (
            <TaskManagement
              tasks={state.customTasks}
              onEdit={(task) => setState(prev => ({ ...prev, selectedTask: task, activeView: 'add-task' }))}
              onDelete={handleDeleteTask}
              onToggle={handleToggleTask}
              onAddNew={() => setState(prev => ({ ...prev, activeView: 'add-task', selectedTask: null }))}
            />
          )}
          
          {state.activeView === 'add-task' && (
            <TaskForm
              task={state.selectedTask || undefined}
              websiteContext={state.websiteContext}
              onSave={handleSaveTask}
              onCancel={() => setState(prev => ({ 
                ...prev, 
                activeView: state.selectedTask ? 'task-management' : 'suggestions',
                selectedTask: null 
              }))}
            />
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
};

// Initialize React app
const container = document.getElementById('popup-root');
if (container) {
  const root = createRoot(container);
  root.render(<PopupApp />);
}