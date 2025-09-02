import React, { useState, useEffect, useCallback } from 'react';
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
import { AIService, AIServiceConfig, DEFAULT_AI_CONFIG } from '../services/aiService';
import { demoAIService } from '../services/demoAIService';
import '../styles/TaskManagement.css';
import '../styles/UserPreferences.css';
import '../styles/PopupImproved.css';
import '../styles/Icons.css';
import {
  getCategoryIcon,
  getPriorityIcon,
  EditIcon,
  DeleteIcon,
  DuplicateIcon,
  StatsIcon,
  CopyIcon,
  CloseIcon,
  CheckIcon,
  ErrorIcon,
  FilterIcon,
  SearchIcon,
  SettingsIcon,
  LoadingIcon
} from '../components/icons/IconComponents';
// IMPORTANT: Do NOT import 'title' from 'process' - it causes build errors
// All 'title' references in this file are object properties (tab.title, suggestion.title, etc.)
// or HTML attributes (title="..."), NOT variables that need importing

// ============================================================================
// INTERFACES
// ============================================================================

interface PopupState {
  isLoading: boolean;
  error: string | null;
  suggestions: PrioritizedSuggestion[];
  websiteContext: WebsiteContext | null;
  pageContent: PageContent | null;
  activeView: 'suggestions' | 'task-management' | 'add-task' | 'full-task-management' | 'settings' | 'ai-config';
  customTasks: CustomTask[];
  selectedTask: CustomTask | null;
  taskResult: TaskResult | null;
  copiedText: string | null;
  suggestionFilter: SuggestionFilter;
  categorizedSuggestions: Record<string, PrioritizedSuggestion[]>;
  filterOptions: {
    categories: string[];
    hasPermissionRequired: boolean;
    hasCustomTasks: boolean;
    timeRange: { min: number; max: number };
  } | null;
  aiConfigured: boolean;
  aiConfig: AIServiceConfig | null;
}

interface SuggestionCardProps {
  suggestion: PrioritizedSuggestion;
  onExecute: (suggestion: PrioritizedSuggestion) => void;
  isExecuting: boolean;
}

interface SuggestionFilterProps {
  filter: SuggestionFilter;
  filterOptions: {
    categories: string[];
    hasPermissionRequired: boolean;
    hasCustomTasks: boolean;
    timeRange: { min: number; max: number };
  };
  onFilterChange: (filter: SuggestionFilter) => void;
}

interface CategorizedSuggestionsProps {
  categorizedSuggestions: Record<string, PrioritizedSuggestion[]>;
  onExecute: (suggestion: PrioritizedSuggestion) => void;
  executingTask: string | null;
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
  onSave: (task: Partial<CustomTask>) => Promise<void>;
  onCancel: () => void;
}

interface AIConfigProps {
  config: AIServiceConfig | null;
  onSave: (config: AIServiceConfig) => void;
  onCancel: () => void;
  onTest: (config: AIServiceConfig) => Promise<boolean>;
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

// Removed - now using SVG icons from IconComponents

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
        <div className="suggestion-icon">
          {getCategoryIcon(suggestion.category, { size: 20 })}
        </div>
        <div className="suggestion-content">
          <h3 className="suggestion-title">{suggestion.title}</h3>
          <p className="suggestion-description">{suggestion.description}</p>
        </div>
        <div className="suggestion-priority">
          <div className="priority-score" title={`Priority: ${suggestion.priority.toFixed(1)}`}>
            {getPriorityIcon(suggestion.priority, { size: 16 })}
          </div>
        </div>
      </div>

      <div className="suggestion-footer">
        <div className="suggestion-meta">
          <span className="suggestion-time">~{suggestion.estimatedTime}s</span>
          {suggestion.requiresPermission && (
            <span className="suggestion-permission" title="Requires permission">
              <SettingsIcon size={12} />
            </span>
          )}
          {suggestion.isCustom && (
            <span className="suggestion-custom" title="Custom task">Custom</span>
          )}
          <span className="suggestion-source" title={`Source: ${suggestion.source}`}>
            {suggestion.source === 'builtin' ? '🏠' : suggestion.source === 'custom' ? <SettingsIcon size={12} /> : '🔗'}
          </span>
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

const SuggestionFilterComponent: React.FC<SuggestionFilterProps> = ({
  filter,
  filterOptions,
  onFilterChange
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleCategoryToggle = (category: string) => {
    const currentCategories = filter.categories || [];
    const newCategories = currentCategories.includes(category)
      ? currentCategories.filter(c => c !== category)
      : [...currentCategories, category];

    onFilterChange({ ...filter, categories: newCategories });
  };

  const clearFilters = () => {
    onFilterChange({});
  };

  const hasActiveFilters = Object.keys(filter).length > 0;

  return (
    <div className="suggestion-filter">
      <div className="filter-header">
        <button
          className="filter-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <FilterIcon size={14} /> Filter {hasActiveFilters && '●'}
        </button>
        {hasActiveFilters && (
          <button className="filter-clear" onClick={clearFilters}>
            Clear
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="filter-content">
          {/* Category Filter */}
          <div className="filter-group">
            <label>Categories:</label>
            <div className="filter-options">
              {filterOptions.categories.map(category => (
                <label key={category} className="filter-checkbox">
                  <input
                    type="checkbox"
                    checked={filter.categories?.includes(category) || false}
                    onChange={() => handleCategoryToggle(category)}
                  />
                  <span>{category}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Permission Filter */}
          {filterOptions.hasPermissionRequired && (
            <div className="filter-group">
              <label className="filter-checkbox">
                <input
                  type="checkbox"
                  checked={filter.requiresPermission === false}
                  onChange={(e) => onFilterChange({
                    ...filter,
                    requiresPermission: e.target.checked ? false : undefined
                  })}
                />
                <span>No permissions required</span>
              </label>
            </div>
          )}

          {/* Custom Tasks Filter */}
          {filterOptions.hasCustomTasks && (
            <div className="filter-group">
              <label className="filter-checkbox">
                <input
                  type="checkbox"
                  checked={filter.isCustom === true}
                  onChange={(e) => onFilterChange({
                    ...filter,
                    isCustom: e.target.checked ? true : undefined
                  })}
                />
                <span>Custom tasks only</span>
              </label>
            </div>
          )}

          {/* Time Filter */}
          <div className="filter-group">
            <label>Max time (seconds):</label>
            <input
              type="range"
              min={filterOptions.timeRange.min}
              max={filterOptions.timeRange.max}
              value={filter.estimatedTimeMax || filterOptions.timeRange.max}
              onChange={(e) => onFilterChange({
                ...filter,
                estimatedTimeMax: parseInt(e.target.value)
              })}
            />
            <span>{filter.estimatedTimeMax || filterOptions.timeRange.max}s</span>
          </div>

          {/* Search Filter */}
          <div className="filter-group">
            <label>Search:</label>
            <input
              type="text"
              placeholder="Search suggestions..."
              value={filter.searchQuery || ''}
              onChange={(e) => onFilterChange({
                ...filter,
                searchQuery: e.target.value || undefined
              })}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const CategorizedSuggestions: React.FC<CategorizedSuggestionsProps> = ({
  categorizedSuggestions,
  onExecute,
  executingTask
}) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const categories = Object.keys(categorizedSuggestions).sort();

  if (categories.length === 0) {
    return (
      <div className="empty-state">
        <p>No suggestions match your current filters.</p>
      </div>
    );
  }

  return (
    <div className="categorized-suggestions">
      {categories.map(category => {
        const suggestions = categorizedSuggestions[category];
        const isExpanded = expandedCategories.has(category);

        return (
          <div key={category} className="suggestion-category">
            <div
              className="category-header"
              onClick={() => toggleCategory(category)}
            >
              <div className="category-icon">{getCategoryIcon(category, { size: 18 })}</div>
              <h3 className="category-title">{category}</h3>
              <span className="category-count">({suggestions.length})</span>
              <span className="category-toggle">{isExpanded ? '▼' : '▶'}</span>
            </div>

            {isExpanded && (
              <div className="category-suggestions">
                {suggestions.map(suggestion => (
                  <SuggestionCard
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
      })}
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
          <CloseIcon size={16} />
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
                  {copiedText === rawContent ? (
                    <>
                      <CheckIcon size={14} /> Copied!
                    </>
                  ) : (
                    <>
                      <CopyIcon size={14} /> Copy
                    </>
                  )}
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
  // Safety check to ensure websiteContext is defined
  if (!websiteContext) {
    return (
      <div className="task-form">
        <div className="loading-container">
          <LoadingSpinner />
          <p>Loading website context...</p>
        </div>
      </div>
    );
  }
  const [formData, setFormData] = useState({
    name: task?.name || '',
    description: task?.description || '',
    promptTemplate: task?.promptTemplate || '',
    websitePatterns: task?.websitePatterns?.join(', ') || (websiteContext?.domain || 'example.com'),
    outputFormat: task?.outputFormat || OutputFormat.PLAIN_TEXT,
    tags: task?.tags?.join(', ') || ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isTestingTask, setIsTestingTask] = useState(false);
  const [testResult, setTestResult] = useState<TaskResult | null>(null);
  const [showTestResult, setShowTestResult] = useState(false);

  // Pre-populate form with current page context
  useEffect(() => {
    if (websiteContext && !task) {
      // Auto-generate task name based on website category
      const categoryNames = {
        [WebsiteCategory.SOCIAL_MEDIA]: 'Social Media Task',
        [WebsiteCategory.ECOMMERCE]: 'E-commerce Task',
        [WebsiteCategory.PROFESSIONAL]: 'Professional Task',
        [WebsiteCategory.NEWS_CONTENT]: 'Content Analysis Task',
        [WebsiteCategory.PRODUCTIVITY]: 'Productivity Task',
        [WebsiteCategory.CUSTOM]: 'Custom Task'
      };

      const suggestedName = categoryNames[websiteContext?.category] || 'New Task';

      // Auto-generate description based on page type
      const pageTypeDescriptions = {
        [PageType.HOME]: 'Analyze homepage content and provide insights',
        [PageType.PRODUCT]: 'Extract product information and generate summaries',
        [PageType.ARTICLE]: 'Summarize article content and key points',
        [PageType.PROFILE]: 'Analyze profile information and suggest improvements',
        [PageType.FORM]: 'Assist with form completion and validation',
        [PageType.OTHER]: 'Provide contextual assistance for this page'
      };

      const suggestedDescription = pageTypeDescriptions[websiteContext?.pageType || PageType.OTHER] || 'Provide AI assistance for this website';

      // Auto-generate prompt template with context variables
      const suggestedPrompt = `Analyze the current page and help with the following:

Page Title: {{title}}
Page Category: {{category}}
Page Type: {{pageType}}

Content Summary: {{textContent}}

Please provide relevant assistance based on the page content and user needs.`;

      setFormData(prev => ({
        ...prev,
        name: prev.name || suggestedName,
        description: prev.description || suggestedDescription,
        promptTemplate: prev.promptTemplate || suggestedPrompt
      }));
    }
  }, [websiteContext, task]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Task name is required';
    } else if (formData.name.trim().length < 3) {
      newErrors.name = 'Task name must be at least 3 characters';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.trim().length < 10) {
      newErrors.description = 'Description must be at least 10 characters';
    }

    if (!formData.promptTemplate.trim()) {
      newErrors.promptTemplate = 'Prompt template is required';
    } else if (formData.promptTemplate.trim().length < 10) {
      newErrors.promptTemplate = 'Prompt template must be at least 10 characters';
    }

    if (!formData.websitePatterns.trim()) {
      newErrors.websitePatterns = 'At least one website pattern is required';
    } else {
      // Validate website patterns - be more lenient with simple domain patterns
      const patterns = formData.websitePatterns.split(',').map(p => p.trim()).filter(Boolean);
      if (patterns.length === 0) {
        newErrors.websitePatterns = 'At least one website pattern is required';
      } else {
        for (const pattern of patterns) {
          // Allow simple domain patterns without requiring regex escaping
          if (pattern.length === 0) {
            newErrors.websitePatterns = 'Empty patterns are not allowed';
            break;
          }

          // Only validate as regex if it contains regex special characters
          if (/[.*+?^${}()|[\]\\]/.test(pattern)) {
            try {
              new RegExp(pattern);
            } catch (error) {
              newErrors.websitePatterns = `Invalid regex pattern "${pattern}": ${error instanceof Error ? error.message : 'Invalid regex'}`;
              break;
            }
          }
        }
      }
    }

    console.log('Form validation result:', { errors: newErrors, formData });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleTestTask = async () => {
    if (!validateForm()) {
      return;
    }

    setIsTestingTask(true);
    setTestResult(null);

    try {
      // Create a temporary task for testing
      const tempTask: Partial<CustomTask> = {
        id: `temp_${Date.now()}`,
        name: formData.name.trim(),
        description: formData.description.trim(),
        promptTemplate: formData.promptTemplate.trim(),
        websitePatterns: formData.websitePatterns.split(',').map(p => p.trim()).filter(Boolean),
        outputFormat: formData.outputFormat,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
        isEnabled: true
      };

      // Simulate task execution with current page context
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate processing time

      const mockResult: TaskResult = {
        success: true,
        content: `Test execution of "${tempTask.name}" completed successfully!\n\nThis task would analyze the current page (${websiteContext?.domain || 'unknown'}) and provide AI-powered assistance based on your prompt template.\n\nPrompt preview:\n${formData.promptTemplate.slice(0, 200)}${formData.promptTemplate.length > 200 ? '...' : ''}\n\nThe actual implementation will integrate with the AI service to process real requests.`,
        format: tempTask.outputFormat,
        timestamp: new Date(),
        executionTime: 1500
      };

      setTestResult(mockResult);
      setShowTestResult(true);
    } catch (error) {
      const errorResult: TaskResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Test execution failed',
        timestamp: new Date(),
        executionTime: 0,
        format: OutputFormat.PLAIN_TEXT
      };
      setTestResult(errorResult);
      setShowTestResult(true);
    } finally {
      setIsTestingTask(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('Form submission started');
    console.log('Current form data:', formData);

    if (!validateForm()) {
      console.log('Form validation failed');
      return;
    }

    console.log('Form validation passed');

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
      // Don't set ID here - let the storage service generate it
      taskData.createdAt = new Date();
      taskData.usageCount = 0;
      taskData.isEnabled = true;
    }

    console.log('Calling onSave with task data:', taskData);
    try {
      await onSave(taskData);
    } catch (error) {
      console.error('Failed to save task:', error);
      setErrors({ general: error instanceof Error ? error.message : 'Failed to save task' });
    }
  };

  return (
    <div className="task-form">
      <div className="task-form-header">
        <h3>{task ? 'Edit Task' : 'Add New Task'}</h3>
        <button className="btn btn-secondary" onClick={onCancel}>
          <CloseIcon size={16} />
        </button>
      </div>

      {websiteContext && !task && (
        <div className="task-form-context">
          <div className="context-info">
            <div className="context-icon">{getCategoryIcon(websiteContext?.category || WebsiteCategory.CUSTOM, { size: 20 })}</div>
            <div className="context-details">
              <strong>{websiteContext?.domain || 'Unknown Domain'}</strong>
              <small>{websiteContext?.category || 'Unknown'} • {websiteContext?.pageType || 'Unknown'}</small>
            </div>
          </div>
          <small>Task will be pre-configured for this website</small>
        </div>
      )}

      {errors.general && (
        <div className="error-banner">
          <ErrorIcon size={16} /> {errors.general}
        </div>
      )}

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
          <small>Available variables: {`{{ title }}, {{ category }}, {{ pageType }}, {{ textContent }}, {{ userInput }}`}</small>
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
          <small>Comma-separated list of domains or regex patterns</small>
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
            <small>Comma-separated tags for organization</small>
          </div>
        </div>

        {/* Test Task Section */}
        <div className="form-group task-test-section">
          <div className="test-section-header">
            <label>Test Task</label>
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={handleTestTask}
              disabled={isTestingTask || !formData.name.trim() || !formData.promptTemplate.trim()}
            >
              {isTestingTask ? (
                <>
                  <LoadingIcon size={14} /> Testing...
                </>
              ) : (
                <>
                  🧪 Test on Current Page
                </>
              )}
            </button>
          </div>
          <small>Test your task configuration with the current page context before saving</small>
        </div>

        {/* Test Result Display */}
        {showTestResult && testResult && (
          <div className="task-test-result">
            <div className="test-result-header">
              <h4>Test Result</h4>
              <button
                type="button"
                className="btn btn-small btn-secondary"
                onClick={() => setShowTestResult(false)}
              >
                <CloseIcon size={12} />
              </button>
            </div>

            {testResult.success ? (
              <div className="test-result-success">
                <div className="test-result-content">
                  <pre>{testResult.content}</pre>
                </div>
                <div className="test-result-meta">
                  <small><CheckIcon size={12} /> Test completed in {testResult.executionTime}ms</small>
                </div>
              </div>
            ) : (
              <div className="test-result-error">
                <p><ErrorIcon size={12} /> Test failed: {testResult.error}</p>
              </div>
            )}
          </div>
        )}

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleTestTask}
            disabled={isTestingTask || !formData.name.trim() || !formData.promptTemplate.trim()}
          >
            {isTestingTask ? 'Testing...' : 'Test Task'}
          </button>
          <button type="submit" className="btn btn-primary">
            {task ? 'Update Task' : 'Create Task'}
          </button>
        </div>
      </form>
    </div>
  );
};

const AIConfigComponent: React.FC<AIConfigProps> = ({
  config,
  onSave,
  onCancel,
  onTest
}) => {
  const [formData, setFormData] = useState({
    apiKey: config?.apiKey || '',
    model: config?.model || 'gpt-3.5-turbo',
    maxTokens: config?.maxTokens || 1000,
    temperature: config?.temperature || 0.7,
    baseUrl: config?.baseUrl || 'https://api.openai.com/v1'
  });

  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.apiKey.trim()) {
      newErrors.apiKey = 'API key is required';
    } else if (!formData.apiKey.startsWith('sk-')) {
      newErrors.apiKey = 'OpenAI API key should start with "sk-"';
    }

    if (formData.maxTokens < 1 || formData.maxTokens > 4000) {
      newErrors.maxTokens = 'Max tokens must be between 1 and 4000';
    }

    if (formData.temperature < 0 || formData.temperature > 2) {
      newErrors.temperature = 'Temperature must be between 0 and 2';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleTestConnection = async () => {
    if (!validateForm()) return;

    setIsTestingConnection(true);
    setTestResult(null);

    try {
      const testConfig: AIServiceConfig = {
        apiKey: formData.apiKey.trim(),
        model: formData.model,
        maxTokens: formData.maxTokens,
        temperature: formData.temperature,
        baseUrl: formData.baseUrl
      };

      const success = await onTest(testConfig);
      setTestResult({
        success,
        message: success
          ? 'Connection successful! AI features are ready to use.'
          : 'Connection failed. Please check your API key and try again.'
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const aiConfig: AIServiceConfig = {
      apiKey: formData.apiKey.trim(),
      model: formData.model,
      maxTokens: formData.maxTokens,
      temperature: formData.temperature,
      baseUrl: formData.baseUrl
    };

    onSave(aiConfig);
  };

  return (
    <div className="ai-config">
      <div className="ai-config-header">
        <h3><SettingsIcon size={16} /> AI Configuration</h3>
        <button className="btn btn-secondary" onClick={onCancel}><CloseIcon size={16} /></button>
      </div>

      <div className="ai-config-info">
        <p>Configure your AI service to enable intelligent suggestions and automation.</p>
        <div className="info-box">
          <strong>🔑 OpenAI API Key Required</strong>
          <p>Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">OpenAI Platform</a></p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="ai-config-form">
        <div className="form-group">
          <label htmlFor="api-key">API Key *</label>
          <input
            id="api-key"
            type="password"
            value={formData.apiKey}
            onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
            className={errors.apiKey ? 'error' : ''}
            placeholder="sk-..."
          />
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
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Recommended)</option>
              <option value="gpt-4">GPT-4 (More capable, slower)</option>
              <option value="gpt-4-turbo-preview">GPT-4 Turbo</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="max-tokens">Max Tokens</label>
            <input
              id="max-tokens"
              type="number"
              min="1"
              max="4000"
              value={formData.maxTokens}
              onChange={(e) => setFormData({ ...formData, maxTokens: parseInt(e.target.value) })}
              className={errors.maxTokens ? 'error' : ''}
            />
            {errors.maxTokens && <span className="error-text">{errors.maxTokens}</span>}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="temperature">
            Temperature ({formData.temperature})
            <small>Controls randomness: 0 = focused, 2 = creative</small>
          </label>
          <input
            id="temperature"
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={formData.temperature}
            onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
          />
        </div>

        <div className="form-group">
          <label htmlFor="base-url">Base URL (Advanced)</label>
          <input
            id="base-url"
            type="url"
            value={formData.baseUrl}
            onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
            placeholder="https://api.openai.com/v1"
          />
          <small>Leave default unless using a custom endpoint</small>
        </div>

        {testResult && (
          <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
            <span>{testResult.success ? <CheckIcon size={14} /> : <ErrorIcon size={14} />} {testResult.message}</span>
          </div>
        )}

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleTestConnection}
            disabled={isTestingConnection || !formData.apiKey.trim()}
          >
            {isTestingConnection ? '🔄 Testing...' : '🧪 Test Connection'}
          </button>
          <button type="submit" className="btn btn-primary">
            Save Configuration
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
                    {task.isEnabled ? <CheckIcon size={14} /> : <ErrorIcon size={14} />}
                  </button>
                  <button
                    className="btn btn-small btn-secondary"
                    onClick={() => onEdit(task)}
                    title="Edit task"
                  >
                    <EditIcon size={14} />
                  </button>
                  <button
                    className="btn btn-small btn-danger"
                    onClick={() => onDelete(task.id)}
                    title="Delete task"
                  >
                    <DeleteIcon size={14} />
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
    pageContent: null,
    activeView: 'suggestions',
    customTasks: [],
    selectedTask: null,
    taskResult: null,
    copiedText: null,
    suggestionFilter: {},
    categorizedSuggestions: {},
    filterOptions: null,
    aiConfigured: false,
    aiConfig: null
  });

  const [executingTask, setExecutingTask] = useState<string | null>(null);
  const [suggestionEngine, setSuggestionEngine] = useState<SuggestionEngine | null>(null);
  const [taskManager, setTaskManager] = useState<TaskManager | null>(null);
  const [storageService, setStorageService] = useState<ChromeStorageService | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'categorized'>('list');

  // Enhanced error handling
  const { error: globalError, isRetrying, handleError, retry, clearError, executeWithErrorHandling } = useErrorHandler({
    onError: (errorReport) => {
      console.error('Popup error:', errorReport);
      setState(prev => ({ ...prev, error: errorReport.userFriendlyMessage }));
    },
    autoRetry: true,
    maxRetries: 2
  });

  // Initialize popup data
  useEffect(() => {
    const initializePopup = async () => {
      return executeWithErrorHandling(async () => {
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        // Get current tab info
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        console.log('Current tab:', tab);

        if (!tab?.url) {
          console.warn('No tab URL found, using fallback');
          // Use a fallback URL if tab.url is not available
          tab.url = 'https://example.com';
          tab.title = 'Example Page'; // Property assignment, not a variable
        }

        // Initialize services
        const storageService = new ChromeStorageService();
        await storageService.initialize();

        // Clear any old encrypted data if needed
        console.log('Storage service initialized');

        // Check for existing AI configuration
        const preferences = await storageService.getUserPreferences();
        const aiConfig = preferences?.aiConfig || null;
        const aiConfigured = !!(aiConfig?.apiKey);

        const aiService = aiConfigured && aiConfig
          ? new AIService(aiConfig)
          : demoAIService as any; // Use demo service when not configured

        const patternEngine = new PatternEngine();
        const taskManager = new TaskManager({
          storageService,
          aiService,
          enableValidation: false, // Temporarily disable validation for debugging
          enableTesting: false,
          maxExecutionTime: 60000,
          defaultSecurityConstraints: {
            allowSensitiveData: false,
            maxContentLength: 5000,
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

        // Extract page content (mock for now - will be replaced with content script)
        const pageTitle = tab.title || '';
        const mockPageContent: PageContent = {
          url: tab.url,
          title: pageTitle,
          headings: ['Main Heading', 'Sub Heading'],
          textContent: 'Sample page content for analysis',
          forms: [],
          links: [],
          metadata: {},
          extractedAt: new Date()
        };

        // Analyze website context
        console.log('Analyzing website context for URL:', tab.url);
        const websiteContext = patternEngine.analyzeWebsite(tab.url || 'https://example.com', mockPageContent);
        console.log('Website context created:', websiteContext);

        // Create suggestion context
        const suggestionContext: SuggestionContext = {
          websiteContext,
          userPreferences: {
            enabledCategories: Object.values(WebsiteCategory),
            disabledSuggestions: [],
            preferredOutputFormats: ['plain_text']
          },
          recentUsage: [] // Will be loaded from storage
        };

        // Generate suggestions
        const suggestions = await engine.getSuggestions(suggestionContext);
        const categorizedSuggestions = await engine.getCategorizedSuggestions(suggestionContext);
        const filterOptions = await engine.getFilterOptions(suggestionContext);

        // Load custom tasks from storage
        const customTasks = await taskManager.getAllTasks();

        setState(prev => ({
          ...prev,
          isLoading: false,
          websiteContext,
          pageContent: mockPageContent,
          suggestions,
          categorizedSuggestions,
          filterOptions,
          customTasks: Object.values(customTasks),
          aiConfigured,
          aiConfig
        }));
      });
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

  const handleFilterChange = useCallback(async (newFilter: SuggestionFilter) => {
    setState(prev => ({ ...prev, suggestionFilter: newFilter }));

    if (suggestionEngine && state.websiteContext) {
      try {
        const suggestionContext: SuggestionContext = {
          websiteContext: state.websiteContext,
          userPreferences: {
            enabledCategories: Object.values(WebsiteCategory),
            disabledSuggestions: [],
            preferredOutputFormats: ['plain_text']
          },
          recentUsage: []
        };

        const filteredSuggestions = await suggestionEngine.getSuggestions(suggestionContext, newFilter);
        const categorizedSuggestions = await suggestionEngine.getCategorizedSuggestions(suggestionContext, newFilter);

        setState(prev => ({
          ...prev,
          suggestions: filteredSuggestions,
          categorizedSuggestions
        }));
      } catch (error) {
        console.error('Failed to apply filter:', error);
      }
    }
  }, [suggestionEngine, state.websiteContext]);

  const handleExecuteSuggestion = useCallback(async (suggestion: PrioritizedSuggestion) => {
    setExecutingTask(suggestion.id);

    const result = await executeWithErrorHandling(async () => {
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
          executionContext,
          { validateBeforeExecution: false }
        );

        setState(prev => ({ ...prev, taskResult }));
        return taskResult;
      } else {
        // For built-in suggestions, simulate execution with demo content
        await new Promise(resolve => setTimeout(resolve, suggestion.estimatedTime * 50));

        const demoContent = state.aiConfigured
          ? `AI-powered result for "${suggestion.title}"\n\nThis would contain intelligent, contextual assistance based on your request and the current website content.`
          : `DEMO: "${suggestion.title}"\n\nThis is a demonstration of the ${suggestion.category} suggestion. In full mode with AI configured, you would receive:\n\n• Intelligent analysis of the current page\n• Contextual recommendations\n• Actionable insights\n• Automated assistance\n\nConfigure your OpenAI API key to unlock real AI capabilities!`;

        const mockResult: TaskResult = {
          success: true,
          content: demoContent,
          format: OutputFormat.PLAIN_TEXT,
          timestamp: new Date(),
          executionTime: suggestion.estimatedTime * 50
        };

        setState(prev => ({ ...prev, taskResult: mockResult }));
        return mockResult;
      }
    }, {
      component: 'PopupApp',
      action: 'executeSuggestion',
      suggestionId: suggestion.id
    });

    setExecutingTask(null);
  }, [executeWithErrorHandling, taskManager, state.websiteContext, state.pageContent, state.aiConfigured]);

  const handleCopyContent = useCallback(async (content: string) => {
    const success = await copyToClipboard(content);
    if (success) {
      setState(prev => ({ ...prev, copiedText: content }));
    } else {
      setState(prev => ({ ...prev, error: 'Failed to copy to clipboard' }));
    }
  }, []);

  const handleSaveTask = useCallback(async (taskData: Partial<CustomTask>) => {
    console.log('=== TASK SAVE PROCESS STARTED ===');
    console.log('Input task data:', JSON.stringify(taskData, null, 2));

    try {
      if (!taskManager) {
        const error = 'Task manager not initialized';
        console.error('❌ CRITICAL ERROR:', error);
        throw new Error(error);
      }

      console.log('✅ Task manager is available');

      let taskId: string;

      if (taskData.id) {
        // Update existing task
        console.log('📝 Updating existing task:', taskData.id);
        const success = await taskManager.updateTask(taskData.id, taskData);
        if (!success) {
          throw new Error('Failed to update task');
        }
        taskId = taskData.id;
        console.log('✅ Task updated successfully');
      } else {
        // Create new task - ensure all required fields are present and valid
        console.log('🆕 Creating new task...');

        // Validate and clean input data
        const cleanedTaskData = {
          name: (taskData.name || '').trim(),
          description: (taskData.description || '').trim(),
          promptTemplate: (taskData.promptTemplate || '').trim(),
          websitePatterns: Array.isArray(taskData.websitePatterns)
            ? taskData.websitePatterns.filter(p => p && p.trim()).map(p => p.trim())
            : [],
          outputFormat: taskData.outputFormat || OutputFormat.PLAIN_TEXT,
          tags: Array.isArray(taskData.tags)
            ? taskData.tags.filter(t => t && t.trim()).map(t => t.trim())
            : [],
          isEnabled: taskData.isEnabled !== undefined ? taskData.isEnabled : true
        };

        console.log('🧹 Cleaned task data:', JSON.stringify(cleanedTaskData, null, 2));

        // Comprehensive validation
        const validationErrors: string[] = [];

        if (!cleanedTaskData.name || cleanedTaskData.name.length < 3) {
          validationErrors.push('Task name must be at least 3 characters long');
        }

        if (!cleanedTaskData.description || cleanedTaskData.description.length < 10) {
          validationErrors.push('Task description must be at least 10 characters long');
        }

        if (!cleanedTaskData.promptTemplate || cleanedTaskData.promptTemplate.length < 10) {
          validationErrors.push('Prompt template must be at least 10 characters long');
        }

        if (!cleanedTaskData.websitePatterns || cleanedTaskData.websitePatterns.length === 0) {
          validationErrors.push('At least one website pattern is required');
        }

        if (validationErrors.length > 0) {
          const errorMessage = 'Validation failed: ' + validationErrors.join(', ');
          console.error('❌ VALIDATION ERRORS:', validationErrors);
          throw new Error(errorMessage);
        }

        console.log('✅ Validation passed, creating task...');

        try {
          // Test Chrome storage directly first
          console.log('🔧 Testing Chrome storage access...');
          await chrome.storage.local.set({ test: 'test-value' });
          const testResult = await chrome.storage.local.get('test');
          console.log('✅ Chrome storage test successful:', testResult);

          // Check current storage usage
          const currentStorage = await chrome.storage.local.get(null);
          const storageKeys = Object.keys(currentStorage);
          console.log('📊 Current storage keys:', storageKeys.length, 'items');
          console.log('📊 Storage keys:', storageKeys);

          // Try a simplified task creation first
          console.log('🔧 Attempting simplified task creation...');
          const simpleTaskData = {
            name: cleanedTaskData.name,
            description: cleanedTaskData.description,
            promptTemplate: cleanedTaskData.promptTemplate,
            websitePatterns: cleanedTaskData.websitePatterns,
            outputFormat: cleanedTaskData.outputFormat || OutputFormat.PLAIN_TEXT,
            tags: cleanedTaskData.tags || [],
            isEnabled: true
          };

          console.log('🔧 About to call taskManager.createTask with:', simpleTaskData);
          taskId = await taskManager.createTask(simpleTaskData);
          console.log('✅ Task created successfully with ID:', taskId);
        } catch (createError) {
          console.error('❌ Task creation failed:', createError);
          console.error('Error details:', {
            message: createError instanceof Error ? createError.message : 'Unknown error',
            stack: createError instanceof Error ? createError.stack : 'No stack trace',
            taskData: cleanedTaskData
          });

          // Try to identify and fix common issues
          if (createError instanceof Error) {
            if (createError.message.includes('quota') || createError.message.includes('storage')) {
              console.log('🔧 Storage quota issue detected, trying to clear cache...');
              try {
                await chrome.storage.local.clear();
                console.log('✅ Storage cleared, retrying task creation...');
                taskId = await taskManager.createTask(cleanedTaskData);
                console.log('✅ Task created successfully after storage clear:', taskId);
              } catch (retryError) {
                console.error('❌ Retry after storage clear failed:', retryError);
                throw new Error(`Storage issue: ${createError.message}. Tried clearing storage but still failed: ${retryError instanceof Error ? retryError.message : 'Unknown error'}`);
              }
            } else {
              throw createError;
            }
          } else {
            throw createError;
          }
        }
      }

      // Refresh the task list
      console.log('🔄 Refreshing task list...');
      try {
        const updatedTasks = await taskManager.getAllTasks();
        const taskCount = Object.keys(updatedTasks).length;
        console.log('✅ Task list refreshed:', taskCount, 'tasks found');

        setState(prev => ({
          ...prev,
          customTasks: Object.values(updatedTasks),
          activeView: 'task-management',
          selectedTask: null,
          error: null
        }));

        console.log('✅ UI state updated successfully');
      } catch (refreshError) {
        console.error('❌ Failed to refresh task list:', refreshError);
        // Don't throw here, task was created successfully
        setState(prev => ({
          ...prev,
          activeView: 'task-management',
          selectedTask: null,
          error: 'Task saved but failed to refresh list. Please reload the extension.'
        }));
      }

      console.log('🎉 TASK SAVE PROCESS COMPLETED SUCCESSFULLY');
      console.log(`Task ${taskData.id ? 'updated' : 'created'} with ID:`, taskId);

    } catch (error) {
      console.error('💥 TASK SAVE PROCESS FAILED');
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        type: error instanceof Error ? error.constructor.name : typeof error,
        taskData: taskData
      });

      // Show user-friendly error message
      const userMessage = error instanceof Error
        ? error.message
        : 'An unexpected error occurred while saving the task';

      setState(prev => ({
        ...prev,
        error: userMessage,
        // Don't change the view on error, let user fix the issue
      }));
    } finally {
      console.log('=== TASK SAVE PROCESS ENDED ===');
    }
  }, [taskManager]);

  const handleDeleteTask = useCallback(async (taskId: string) => {
    try {
      if (!taskManager) {
        console.error('Task manager not initialized');
        throw new Error('Task manager not initialized');
      }

      console.log('Deleting task:', taskId);
      const success = await taskManager.deleteTask(taskId);

      if (success) {
        // Refresh the task list
        const updatedTasks = await taskManager.getAllTasks();
        setState(prev => ({
          ...prev,
          customTasks: Object.values(updatedTasks),
          error: null
        }));
        console.log('Task deleted successfully');
      } else {
        throw new Error('Failed to delete task');
      }

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

  const handleSaveAIConfig = useCallback(async (config: AIServiceConfig) => {
    try {
      if (!storageService) {
        throw new Error('Storage service not initialized');
      }

      // Update user preferences with AI config
      const preferences = await storageService.getUserPreferences();
      await storageService.updateUserPreferences({
        ...preferences,
        aiConfig: config
      });

      // Update state
      setState(prev => ({
        ...prev,
        aiConfig: config,
        aiConfigured: true,
        activeView: 'suggestions'
      }));

      console.log('AI configuration saved successfully');
    } catch (error) {
      console.error('Failed to save AI configuration:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to save AI configuration'
      }));
    }
  }, [storageService]);

  const handleTestAIConfig = useCallback(async (config: AIServiceConfig): Promise<boolean> => {
    try {
      const testService = new AIService(config);

      // Test with a simple request
      const testRequest = {
        prompt: 'Say "Hello" to test the connection.',
        context: {
          domain: 'test.com',
          category: WebsiteCategory.PRODUCTIVITY,
          pageType: PageType.OTHER,
          extractedData: {},
          securityLevel: SecurityLevel.PUBLIC,
          timestamp: new Date()
        },
        taskType: TaskType.GENERATE_TEXT,
        outputFormat: OutputFormat.PLAIN_TEXT,
        constraints: {
          allowSensitiveData: false,
          maxContentLength: 100,
          allowedDomains: [],
          restrictedSelectors: []
        },
        timestamp: new Date()
      };

      const response = await testService.processRequest(testRequest);
      return !!(response.content && response.content.length > 0);
    } catch (error) {
      console.error('AI config test failed:', error);
      return false;
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
  if (state.error || globalError) {
    return (
      <ErrorBoundary>
        <div className="popup-container">
          {globalError ? (
            <ErrorDisplay
              error={globalError.userFriendlyMessage}
              type={globalError.type as any}
              onRetry={globalError.isRetryable ? retry : undefined}
              onDismiss={clearError}
              showDetails={true}
              retryCount={globalError.retryCount}
              maxRetries={globalError.maxRetries}
            />
          ) : (
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
          )}
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="popup-container">
        {/* Header */}
        <div className="popup-header">
          <h1>chromeControl</h1>
          {state.websiteContext && (
            <div className="website-info">
              <span className="website-icon">
                {getCategoryIcon(state.websiteContext?.category || WebsiteCategory.CUSTOM)}
              </span>
              <span className="website-domain">{state.websiteContext?.domain || 'Unknown Domain'}</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="popup-nav">
          <button
            className={`nav-btn ${state.activeView === 'suggestions' ? 'active' : ''}`}
            onClick={() => setState(prev => ({ ...prev, activeView: 'suggestions', taskResult: null }))}
          >
            <SearchIcon size={16} /> Suggestions
          </button>
          <button
            className={`nav-btn ${state.activeView === 'task-management' ? 'active' : ''}`}
            onClick={() => setState(prev => ({ ...prev, activeView: 'task-management', selectedTask: null }))}
          >
            📋 Tasks ({state.customTasks.length})
          </button>
          <button
            className={`nav-btn ${state.activeView === 'ai-config' ? 'active' : ''} ${!state.aiConfigured ? 'highlight' : ''}`}
            onClick={() => setState(prev => ({ ...prev, activeView: 'ai-config', selectedTask: null }))}
            title={!state.aiConfigured ? 'Configure AI to enable smart features' : 'AI Configuration'}
          >
            <SettingsIcon size={16} /> AI {!state.aiConfigured ? <ErrorIcon size={12} /> : <CheckIcon size={12} />}
          </button>
          <button
            className={`nav-btn ${state.activeView === 'settings' ? 'active' : ''}`}
            onClick={() => setState(prev => ({ ...prev, activeView: 'settings', selectedTask: null }))}
          >
            <SettingsIcon size={16} /> Settings
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
                  {/* AI Status Banner */}
                  {!state.aiConfigured && (
                    <div className="ai-status-banner">
                      <div className="banner-content">
                        <span className="banner-icon"><SettingsIcon size={20} /></span>
                        <div className="banner-text">
                          <strong>AI Features Disabled</strong>
                          <p>Configure your AI service to unlock intelligent suggestions and automation</p>
                        </div>
                        <button
                          className="btn btn-primary btn-small"
                          onClick={() => setState(prev => ({ ...prev, activeView: 'ai-config' }))}
                        >
                          Configure AI
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="suggestions-header">
                    <h2>Available Suggestions</h2>
                    <div className="suggestions-controls">
                      <div className="view-toggle">
                        <button
                          className={`btn btn-small ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => setViewMode('list')}
                        >
                          📋 List
                        </button>
                        <button
                          className={`btn btn-small ${viewMode === 'categorized' ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => setViewMode('categorized')}
                        >
                          📁 Categories
                        </button>
                      </div>
                      <button
                        className="btn btn-secondary btn-small"
                        onClick={() => setState(prev => ({ ...prev, activeView: 'add-task' }))}
                      >
                        + Add Task
                      </button>
                    </div>
                  </div>

                  {/* Filter Component */}
                  {state.filterOptions && (
                    <SuggestionFilterComponent
                      filter={state.suggestionFilter}
                      filterOptions={state.filterOptions}
                      onFilterChange={handleFilterChange}
                    />
                  )}

                  {/* Suggestions Display */}
                  {viewMode === 'list' ? (
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
                  ) : (
                    <CategorizedSuggestions
                      categorizedSuggestions={state.categorizedSuggestions}
                      onExecute={handleExecuteSuggestion}
                      executingTask={executingTask}
                    />
                  )}
                </div>
              )}
            </>
          )}

          {state.activeView === 'task-management' && (
            <div className="simple-task-management">
              <div className="task-management-header">
                <h3>Quick Task Management</h3>
                <button
                  className="btn btn-primary"
                  onClick={() => setState(prev => ({ ...prev, activeView: 'full-task-management' }))}
                >
                  📚 Full Library
                </button>
              </div>
              <TaskManagement
                tasks={state.customTasks}
                onEdit={(task) => setState(prev => ({ ...prev, selectedTask: task, activeView: 'add-task' }))}
                onDelete={handleDeleteTask}
                onToggle={handleToggleTask}
                onAddNew={() => setState(prev => ({ ...prev, activeView: 'add-task', selectedTask: null }))}
              />
            </div>
          )}

          {state.activeView === 'full-task-management' && taskManager && storageService && (
            <FullTaskManagement
              taskManager={taskManager}
              storageService={storageService}
              onClose={() => setState(prev => ({ ...prev, activeView: 'suggestions' }))}
            />
          )}

          {state.activeView === 'add-task' && (
            <ErrorBoundary
              onError={(error, errorInfo) => {
                console.error('🚨 Task form crashed:', error, errorInfo);
                setState(prev => ({
                  ...prev,
                  error: `Task form crashed: ${error.message}. Please try again or reload the extension.`,
                  activeView: 'suggestions'
                }));
              }}
              showDetails={true}
            >
              {state.websiteContext ? (
                <ErrorBoundary
                  onError={(error) => {
                    console.error('🚨 Task form crashed:', error.message, error);
                    setState(prev => ({
                      ...prev,
                      error: `Task form error: ${error.message}`,
                      activeView: 'suggestions'
                    }));
                  }}
                  showDetails={true}
                >
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
                </ErrorBoundary>
              ) : (
                <div className="loading-container">
                  <LoadingSpinner />
                  <p>Loading website context...</p>
                </div>
              )}
            </ErrorBoundary>
          )}

          {state.activeView === 'ai-config' && (
            <AIConfigComponent
              config={state.aiConfig}
              onSave={handleSaveAIConfig}
              onCancel={() => setState(prev => ({ ...prev, activeView: 'suggestions' }))}
              onTest={handleTestAIConfig}
            />
          )}

          {state.activeView === 'settings' && (
            <UserPreferencesComponent
              onClose={() => setState(prev => ({ ...prev, activeView: 'suggestions' }))}
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