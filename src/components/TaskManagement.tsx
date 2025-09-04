import React, { useState, useEffect, useCallback } from 'react';
import { CustomTask, WebsiteCategory, OutputFormat, UsageMetrics, WebsiteContext } from '../types';
import { TaskManager } from '../services/taskManager';
import { ChromeStorageService } from '../services/storage';
import {
  EditIcon,
  DeleteIcon,
  DuplicateIcon,
  StatsIcon,
  CloseIcon,
  CheckIcon,
  ErrorIcon
} from './icons/IconComponents';

// ============================================================================
// INTERFACES
// ============================================================================

interface TaskManagementProps {
  taskManager: TaskManager;
  storageService: ChromeStorageService;
  onClose: () => void;
  websiteContext?: WebsiteContext | null;
}

interface TaskLibraryViewProps {
  tasks: CustomTask[];
  usageStats: Record<string, UsageMetrics>;
  onEdit: (task: CustomTask) => void;
  onDuplicate: (task: CustomTask) => void;
  onDelete: (taskId: string) => void;
  onToggle: (taskId: string, enabled: boolean) => void;
  onExport: (taskIds: string[]) => void;
  onViewStats: (task: CustomTask) => void;
}

interface TaskStatsModalProps {
  task: CustomTask;
  stats: UsageMetrics | null;
  onClose: () => void;
}

interface TaskExportModalProps {
  tasks: CustomTask[];
  selectedTaskIds: string[];
  onExport: (format: 'json' | 'csv', taskIds: string[]) => void;
  onClose: () => void;
}

interface TaskImportModalProps {
  onImport: (tasks: CustomTask[]) => void;
  onClose: () => void;
}

interface TaskCreateModalProps {
  onSave: (task: Partial<CustomTask>) => void;
  onCancel: () => void;
  websiteContext?: WebsiteContext | null;
}

interface TaskOrganizationOptions {
  sortBy: 'name' | 'created' | 'usage' | 'category';
  sortOrder: 'asc' | 'desc';
  groupBy: 'none' | 'category' | 'website' | 'tags';
  filterBy: {
    category?: WebsiteCategory;
    enabled?: boolean;
    tags?: string[];
    searchQuery?: string;
  };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Ensures a value is a Date object, converting from string if necessary
 */
function ensureDate(value: Date | string | undefined): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? new Date() : date;
  }
  return new Date();
}

export const FullTaskManagement: React.FC<TaskManagementProps> = ({
  taskManager,
  storageService,
  onClose,
  websiteContext
}) => {
  const [tasks, setTasks] = useState<CustomTask[]>([]);
  const [usageStats, setUsageStats] = useState<Record<string, UsageMetrics>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'library' | 'create' | 'stats' | 'export'>('library');
  const [selectedTask, setSelectedTask] = useState<CustomTask | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [organizationOptions, setOrganizationOptions] = useState<TaskOrganizationOptions>({
    sortBy: 'name',
    sortOrder: 'asc',
    groupBy: 'none',
    filterBy: {}
  });

  // Load tasks and usage statistics
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [tasksData, statsData] = await Promise.all([
        taskManager.getAllTasks(),
        storageService.getAllUsageStats()
      ]);

      setTasks(Object.values(tasksData));
      setUsageStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [taskManager, storageService]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle task operations
  const handleEdit = (task: CustomTask) => {
    setSelectedTask(task);
    setActiveView('library'); // Stay in library view but show edit form
  };

  const handleDuplicate = async (task: CustomTask) => {
    try {
      await taskManager.duplicateTask(task.id);
      await loadData(); // Refresh data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate task');
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) {
      return;
    }

    try {
      await taskManager.deleteTask(taskId);
      await loadData(); // Refresh data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
    }
  };

  const handleToggle = async (taskId: string, enabled: boolean) => {
    try {
      await taskManager.updateTask(taskId, { isEnabled: enabled });
      await loadData(); // Refresh data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task');
    }
  };

  const handleExport = (taskIds: string[]) => {
    setSelectedTaskIds(taskIds);
    setActiveView('export');
  };

  const handleViewStats = (task: CustomTask) => {
    setSelectedTask(task);
    setActiveView('stats');
  };

  const handleCreateTask = async (taskData: Partial<CustomTask>) => {
    try {
      await taskManager.createTask(taskData);
      await loadData(); // Refresh data
      setActiveView('library');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    }
  };

  const handleExportTasks = async (format: 'json' | 'csv', taskIds: string[]) => {
    try {
      const tasksToExport = tasks.filter(task => taskIds.includes(task.id));
      
      if (format === 'json') {
        const dataStr = JSON.stringify(tasksToExport, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `tasks-export-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
      } else if (format === 'csv') {
        const csvContent = convertTasksToCSV(tasksToExport);
        const dataBlob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `tasks-export-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        
        URL.revokeObjectURL(url);
      }
      
      setActiveView('library');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export tasks');
    }
  };

  if (loading) {
    return (
      <div className="task-management loading">
        <div className="loading-spinner">Loading tasks...</div>
      </div>
    );
  }

  return (
    <div className="task-management">
      <div className="task-management-header">
        <h2>Task Management</h2>
        <button className="btn btn-secondary close-button" onClick={onClose}>
          <CloseIcon size={16} />
        </button>
      </div>
      
      <div className="task-actions">
        <button
          className="btn btn-primary"
          onClick={() => setActiveView('create')}
        >
          + Create Task
        </button>
        <button
          className={`btn ${activeView === 'library' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveView('library')}
        >
          Library
        </button>
      </div>

      {error && (
        <div className="error-message">
          <span><ErrorIcon size={16} /> {error}</span>
          <button onClick={() => setError(null)}><CloseIcon size={14} /></button>
        </div>
      )}

      {activeView === 'library' && (
        <TaskLibraryView
          tasks={tasks}
          usageStats={usageStats}
          onEdit={handleEdit}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onToggle={handleToggle}
          onExport={handleExport}
          onViewStats={handleViewStats}
        />
      )}

      {activeView === 'create' && (
        <TaskCreateModal
          onSave={handleCreateTask}
          onCancel={() => setActiveView('library')}
          websiteContext={websiteContext}
        />
      )}

      {activeView === 'stats' && selectedTask && (
        <TaskStatsModal
          task={selectedTask}
          stats={usageStats[selectedTask.id] || null}
          onClose={() => setActiveView('library')}
        />
      )}

      {activeView === 'export' && (
        <TaskExportModal
          tasks={tasks}
          selectedTaskIds={selectedTaskIds}
          onExport={handleExportTasks}
          onClose={() => setActiveView('library')}
        />
      )}

    </div>
  );
};

// ============================================================================
// TASK LIBRARY VIEW COMPONENT
// ============================================================================

const TaskLibraryView: React.FC<TaskLibraryViewProps> = ({
  tasks,
  usageStats,
  onEdit,
  onDuplicate,
  onDelete,
  onToggle,
  onExport,
  onViewStats
}) => {
  const [organizationOptions, setOrganizationOptions] = useState<TaskOrganizationOptions>({
    sortBy: 'name',
    sortOrder: 'asc',
    groupBy: 'none',
    filterBy: {}
  });
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);

  // Filter and sort tasks based on organization options
  const organizedTasks = React.useMemo(() => {
    let filteredTasks = [...tasks];

    // Apply filters
    const { filterBy } = organizationOptions;
    
    if (filterBy.searchQuery) {
      const query = filterBy.searchQuery.toLowerCase();
      filteredTasks = filteredTasks.filter(task =>
        task.name.toLowerCase().includes(query) ||
        task.description.toLowerCase().includes(query) ||
        task.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    if (filterBy.category) {
      filteredTasks = filteredTasks.filter(task =>
        task.websitePatterns.some(pattern => 
          pattern.toLowerCase().includes(filterBy.category!.toLowerCase())
        )
      );
    }

    if (filterBy.enabled !== undefined) {
      filteredTasks = filteredTasks.filter(task => task.isEnabled === filterBy.enabled);
    }

    if (filterBy.tags && filterBy.tags.length > 0) {
      filteredTasks = filteredTasks.filter(task =>
        filterBy.tags!.some(tag => task.tags.includes(tag))
      );
    }

    // Apply sorting
    filteredTasks.sort((a, b) => {
      let comparison = 0;
      
      switch (organizationOptions.sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'created':
          comparison = ensureDate(a.createdAt).getTime() - ensureDate(b.createdAt).getTime();
          break;
        case 'usage':
          const aUsage = usageStats[a.id]?.usageCount || 0;
          const bUsage = usageStats[b.id]?.usageCount || 0;
          comparison = aUsage - bUsage;
          break;
        case 'category':
          // Sort by first website pattern as category proxy
          const aCategory = a.websitePatterns[0] || '';
          const bCategory = b.websitePatterns[0] || '';
          comparison = aCategory.localeCompare(bCategory);
          break;
      }
      
      return organizationOptions.sortOrder === 'desc' ? -comparison : comparison;
    });

    return filteredTasks;
  }, [tasks, organizationOptions, usageStats]);

  // Group tasks if grouping is enabled
  const groupedTasks = React.useMemo(() => {
    if (organizationOptions.groupBy === 'none') {
      return { 'All Tasks': organizedTasks };
    }

    const groups: Record<string, CustomTask[]> = {};
    
    organizedTasks.forEach(task => {
      let groupKey = 'Other';
      
      switch (organizationOptions.groupBy) {
        case 'category':
          // Use first website pattern as category proxy
          groupKey = task.websitePatterns[0] || 'No Website';
          break;
        case 'website':
          // Extract domain from first pattern
          const pattern = task.websitePatterns[0];
          if (pattern) {
            const match = pattern.match(/([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/);
            groupKey = match ? match[1] : pattern;
          }
          break;
        case 'tags':
          groupKey = task.tags.length > 0 ? task.tags[0] : 'Untagged';
          break;
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(task);
    });
    
    return groups;
  }, [organizedTasks, organizationOptions.groupBy]);

  const handleSelectTask = (taskId: string, selected: boolean) => {
    if (selected) {
      setSelectedTaskIds(prev => [...prev, taskId]);
    } else {
      setSelectedTaskIds(prev => prev.filter(id => id !== taskId));
    }
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedTaskIds(organizedTasks.map(task => task.id));
    } else {
      setSelectedTaskIds([]);
    }
  };

  const handleBulkExport = () => {
    if (selectedTaskIds.length > 0) {
      onExport(selectedTaskIds);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTaskIds.length === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedTaskIds.length} tasks?`)) {
      return;
    }

    for (const taskId of selectedTaskIds) {
      await onDelete(taskId);
    }
    setSelectedTaskIds([]);
  };

  return (
    <div className="task-library-view">
      {/* Organization Controls */}
      <div className="organization-controls">
        <div className="control-group sort-control-group">
          <label htmlFor="sort-by">Sort by:</label>
          <div className="sort-controls">
            <select
              id="sort-by"
              value={organizationOptions.sortBy}
              onChange={(e) => setOrganizationOptions(prev => ({
                ...prev,
                sortBy: e.target.value as any
              }))}
            >
              <option value="name">Name</option>
              <option value="created">Created Date</option>
              <option value="usage">Usage Count</option>
              <option value="category">Category</option>
            </select>
            
            <button
              className="btn btn-small sort-order-btn"
              onClick={() => setOrganizationOptions(prev => ({
                ...prev,
                sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc'
              }))}
              title={`Sort ${organizationOptions.sortOrder === 'asc' ? 'descending' : 'ascending'}`}
            >
              {organizationOptions.sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>

        <div className="control-group">
          <label htmlFor="group-by">Group by:</label>
          <select
            id="group-by"
            value={organizationOptions.groupBy}
            onChange={(e) => setOrganizationOptions(prev => ({
              ...prev,
              groupBy: e.target.value as any
            }))}
          >
            <option value="none">None</option>
            <option value="category">Category</option>
            <option value="website">Website</option>
            <option value="tags">Tags</option>
          </select>
        </div>

        <div className="control-group">
          <input
            type="text"
            placeholder="Search tasks..."
            value={organizationOptions.filterBy.searchQuery || ''}
            onChange={(e) => setOrganizationOptions(prev => ({
              ...prev,
              filterBy: { ...prev.filterBy, searchQuery: e.target.value || undefined }
            }))}
          />
        </div>

        <div className="control-group">
          <button
            className="btn btn-secondary"
            onClick={() => setShowBulkActions(!showBulkActions)}
          >
            {showBulkActions ? 'Hide' : 'Show'} Bulk Actions
          </button>
        </div>
      </div>

      {/* Bulk Actions */}
      {showBulkActions && (
        <div className="bulk-actions">
          <div className="bulk-selection">
            <label>
              <input
                type="checkbox"
                checked={selectedTaskIds.length === organizedTasks.length && organizedTasks.length > 0}
                onChange={(e) => handleSelectAll(e.target.checked)}
              />
              Select All ({selectedTaskIds.length} selected)
            </label>
          </div>
          
          {selectedTaskIds.length > 0 && (
            <div className="bulk-buttons">
              <button className="btn btn-secondary" onClick={handleBulkExport}>
                Export Selected
              </button>
              <button className="btn btn-danger" onClick={handleBulkDelete}>
                <DeleteIcon size={14} /> Delete Selected
              </button>
            </div>
          )}
        </div>
      )}

      {/* Task Groups */}
      <div className="task-groups">
        {Object.entries(groupedTasks).map(([groupName, groupTasks]) => (
          <div key={groupName} className="task-group">
            {organizationOptions.groupBy !== 'none' && (
              <h3 className="group-header">
                {groupName} ({groupTasks.length})
              </h3>
            )}
            
            <div className="task-grid">
              {groupTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  stats={usageStats[task.id]}
                  selected={selectedTaskIds.includes(task.id)}
                  showBulkActions={showBulkActions}
                  onSelect={(selected) => handleSelectTask(task.id, selected)}
                  onEdit={() => onEdit(task)}
                  onDuplicate={() => onDuplicate(task)}
                  onDelete={() => onDelete(task.id)}
                  onToggle={(enabled) => onToggle(task.id, enabled)}
                  onViewStats={() => onViewStats(task)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {organizedTasks.length === 0 && (
        <div className="empty-state">
          <p>No tasks found matching your criteria.</p>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// TASK CARD COMPONENT
// ============================================================================

interface TaskCardProps {
  task: CustomTask;
  stats?: UsageMetrics;
  selected: boolean;
  showBulkActions: boolean;
  onSelect: (selected: boolean) => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggle: (enabled: boolean) => void;
  onViewStats: () => void;
}

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  stats,
  selected,
  showBulkActions,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
  onToggle,
  onViewStats
}) => {
  return (
    <div className={`task-card ${!task.isEnabled ? 'disabled' : ''} ${selected ? 'selected' : ''}`}>
      {showBulkActions && (
        <div className="task-selection">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect(e.target.checked)}
          />
        </div>
      )}
      
      <div className="task-header">
        <h4 className="task-name">{task.name}</h4>
        <div className="task-status">
          <button
            className={`status-toggle ${task.isEnabled ? 'enabled' : 'disabled'}`}
            onClick={() => onToggle(!task.isEnabled)}
            title={task.isEnabled ? 'Disable task' : 'Enable task'}
          >
            {task.isEnabled ? <CheckIcon size={16} /> : <ErrorIcon size={16} />}
          </button>
        </div>
      </div>
      
      <p className="task-description">{task.description}</p>
      
      <div className="task-meta">
        <div className="task-patterns">
          <strong>Websites:</strong> {task.websitePatterns.slice(0, 2).join(', ')}
          {task.websitePatterns.length > 2 && ` +${task.websitePatterns.length - 2} more`}
        </div>
        
        {task.tags.length > 0 && (
          <div className="task-tags">
            {task.tags.slice(0, 3).map(tag => (
              <span key={tag} className="tag">{tag}</span>
            ))}
            {task.tags.length > 3 && <span className="tag">+{task.tags.length - 3}</span>}
          </div>
        )}
        
        <div className="task-stats">
          <span>Used: {stats?.usageCount || 0} times</span>
          {stats && (
            <span>Success: {Math.round(stats.successRate * 100)}%</span>
          )}
        </div>
        
        <div className="task-dates">
          <small>Created: {ensureDate(task.createdAt).toLocaleDateString()}</small>
          <small>Updated: {ensureDate(task.updatedAt).toLocaleDateString()}</small>
        </div>
      </div>
      
      <div className="task-actions">
        <button className="btn btn-small btn-secondary" onClick={onEdit}>
          <EditIcon size={14} /> Edit
        </button>
        <button className="btn btn-small btn-secondary" onClick={onDuplicate}>
          <DuplicateIcon size={14} /> Duplicate
        </button>
        <button className="btn btn-small btn-secondary" onClick={onViewStats}>
          <StatsIcon size={14} /> Stats
        </button>
        <button className="btn btn-small btn-danger" onClick={onDelete}>
          <DeleteIcon size={14} /> Delete
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const convertTasksToCSV = (tasks: CustomTask[]): string => {
  const headers = [
    'Name',
    'Description',
    'Website Patterns',
    'Output Format',
    'Tags',
    'Created Date',
    'Updated Date',
    'Usage Count',
    'Enabled'
  ];
  
  const rows = tasks.map(task => [
    task.name,
    task.description,
    task.websitePatterns.join('; '),
    task.outputFormat,
    task.tags.join('; '),
    ensureDate(task.createdAt).toISOString(),
    ensureDate(task.updatedAt).toISOString(),
    task.usageCount.toString(),
    task.isEnabled.toString()
  ]);
  
  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\n');
  
  return csvContent;
};

// ============================================================================
// TASK CREATE MODAL
// ============================================================================

// Helper function to generate website patterns from domain
const generateWebsitePatterns = (websiteContext: WebsiteContext | null): string => {
  if (!websiteContext?.domain) return '';
  
  const domain = websiteContext.domain;
  const escapedDomain = domain.replace(/\./g, '\\.');
  
  // Generate regex patterns:
  // 1. Exact domain match (works for any domain/subdomain)
  // 2. If it's a subdomain, also match the base domain
  // 3. Pattern to match any subdomain of the base domain
  const patterns = [`^${escapedDomain}$`];
  
  // If domain has a subdomain (like www.example.com), extract base domain
  const parts = domain.split('.');
  if (parts.length > 2) {
    // Remove first part (subdomain) to get base domain
    const baseDomain = parts.slice(1).join('.');
    const escapedBaseDomain = baseDomain.replace(/\./g, '\\.');
    patterns.push(`^${escapedBaseDomain}$`);
    patterns.push(`^.*\\.${escapedBaseDomain}$`);
  } else {
    // For base domains, add pattern for any subdomain
    patterns.push(`^.*\\.${escapedDomain}$`);
  }
  
  return patterns.join(', ');
};

const TaskCreateModal: React.FC<TaskCreateModalProps> = ({ onSave, onCancel, websiteContext }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    promptTemplate: '',
    websitePatterns: generateWebsitePatterns(websiteContext),
    outputFormat: OutputFormat.PLAIN_TEXT as OutputFormat,
    tags: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<string>('custom');

  // Simple template options - website-specific templates are now automatically available as suggestions
  const taskTemplates = {
    custom: {
      name: '',
      description: '',
      promptTemplate: '',
      websitePatterns: generateWebsitePatterns(websiteContext),
      tags: ''
    },
    quickStart: {
      name: 'Quick Task',
      description: 'A simple task for getting started',
      promptTemplate: `Help me with this task:

Current Page: {{title}}
Content: {{textContent}}

Please:
1. Analyze what I'm looking at
2. Provide relevant assistance
3. Suggest next steps`,
      websitePatterns: generateWebsitePatterns(websiteContext),
      tags: 'general, quick, assistant'
    }
  };

  const handleTemplateChange = (templateKey: string) => {
    setSelectedTemplate(templateKey);
    const template = taskTemplates[templateKey as keyof typeof taskTemplates];
    setFormData(prev => ({
      ...prev,
      ...template
    }));
    setErrors({}); // Clear errors when changing template
  };

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
      name: formData.name.trim(),
      description: formData.description.trim(),
      promptTemplate: formData.promptTemplate.trim(),
      websitePatterns: formData.websitePatterns.split(',').map(p => p.trim()).filter(p => p),
      outputFormat: formData.outputFormat,
      tags: formData.tags.split(',').map(t => t.trim()).filter(t => t),
      isEnabled: true,
      automationSteps: [],
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    onSave(taskData);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal create-task-modal">
        <div className="modal-header">
          <h3>Create New Task</h3>
          <button className="btn btn-secondary" onClick={onCancel}>
            <CloseIcon size={16} />
          </button>
        </div>

        <div className="modal-content">
          <form onSubmit={handleSubmit}>
            {/* Template Selection */}
            <div className="form-group">
              <label>Template:</label>
              <select 
                value={selectedTemplate} 
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="template-select"
              >
                <option value="custom">Custom Task</option>
                <option value="quickStart">Quick Start Template</option>
              </select>
              <small>Tasks you create will automatically appear as suggestions when you visit matching websites. Built-in tasks (Google, LeetCode, GitHub, etc.) are already available.</small>
            </div>

            {/* Task Name */}
            <div className="form-group">
              <label htmlFor="task-name">Task Name *</label>
              <input
                id="task-name"
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={errors.name ? 'error' : ''}
                placeholder="Enter task name"
              />
              {errors.name && <span className="error-text">{errors.name}</span>}
            </div>

            {/* Description */}
            <div className="form-group">
              <label htmlFor="task-description">Description *</label>
              <textarea
                id="task-description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className={errors.description ? 'error' : ''}
                placeholder="Describe what this task does"
                rows={3}
              />
              {errors.description && <span className="error-text">{errors.description}</span>}
            </div>

            {/* Website Patterns */}
            <div className="form-group">
              <label htmlFor="website-patterns">Website Patterns *</label>
              <input
                id="website-patterns"
                type="text"
                value={formData.websitePatterns}
                onChange={(e) => handleInputChange('websitePatterns', e.target.value)}
                className={errors.websitePatterns ? 'error' : ''}
                placeholder="example.com, *.example.com/page/*"
              />
              {errors.websitePatterns && <span className="error-text">{errors.websitePatterns}</span>}
              <small>
                {websiteContext?.domain ? 
                  `Auto-filled for ${websiteContext.domain}. ` : 
                  ''
                }Separate multiple patterns with commas. Use * as wildcard.
              </small>
            </div>

            {/* Prompt Template */}
            <div className="form-group">
              <label htmlFor="prompt-template">Prompt Template *</label>
              <textarea
                id="prompt-template"
                value={formData.promptTemplate}
                onChange={(e) => handleInputChange('promptTemplate', e.target.value)}
                className={errors.promptTemplate ? 'error' : ''}
                placeholder="Enter the AI prompt template..."
                rows={6}
              />
              {errors.promptTemplate && <span className="error-text">{errors.promptTemplate}</span>}
              <small>Use {`{{variable}}`} syntax for dynamic content like {`{{title}}`}, {`{{textContent}}`}</small>
            </div>

            {/* Output Format */}
            <div className="form-group">
              <label htmlFor="output-format">Output Format</label>
              <select
                id="output-format"
                value={formData.outputFormat}
                onChange={(e) => handleInputChange('outputFormat', e.target.value)}
              >
                <option value={OutputFormat.PLAIN_TEXT}>Plain Text</option>
                <option value={OutputFormat.MARKDOWN}>Markdown</option>
                <option value={OutputFormat.HTML}>HTML</option>
                <option value={OutputFormat.JSON}>JSON</option>
              </select>
            </div>

            {/* Tags */}
            <div className="form-group">
              <label htmlFor="tags">Tags</label>
              <input
                id="tags"
                type="text"
                value={formData.tags}
                onChange={(e) => handleInputChange('tags', e.target.value)}
                placeholder="tag1, tag2, tag3"
              />
              <small>Separate multiple tags with commas</small>
            </div>

            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={onCancel}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Create Task
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// TASK STATISTICS MODAL
// ============================================================================

const TaskStatsModal: React.FC<TaskStatsModalProps> = ({ task, stats, onClose }) => {
  return (
    <div className="modal-overlay">
      <div className="modal task-stats-modal">
        <div className="modal-header">
          <h3><StatsIcon size={18} /> Task Statistics: {task.name}</h3>
          <button className="btn btn-secondary" onClick={onClose}><CloseIcon size={16} /></button>
        </div>
        
        <div className="modal-content">
          {stats ? (
            <div className="stats-grid">
              <div className="stat-card">
                <h4>Usage Count</h4>
                <div className="stat-value">{stats.usageCount}</div>
                <small>Total executions</small>
              </div>
              
              <div className="stat-card">
                <h4>Success Rate</h4>
                <div className="stat-value">{Math.round(stats.successRate * 100)}%</div>
                <small>Successful executions</small>
              </div>
              
              <div className="stat-card">
                <h4>Avg Execution Time</h4>
                <div className="stat-value">{Math.round(stats.averageExecutionTime)}ms</div>
                <small>Average response time</small>
              </div>
              
              <div className="stat-card">
                <h4>Error Count</h4>
                <div className="stat-value">{stats.errorCount}</div>
                <small>Failed executions</small>
              </div>
              
              <div className="stat-card">
                <h4>Last Used</h4>
                <div className="stat-value">
                  {stats.lastUsed ? ensureDate(stats.lastUsed).toLocaleDateString() : 'Never'}
                </div>
                <small>Most recent execution</small>
              </div>
              
              <div className="stat-card">
                <h4>Reliability Score</h4>
                <div className="stat-value">
                  {stats.usageCount > 0 ? Math.round((stats.successRate * 0.7 + (1 - stats.errorCount / stats.usageCount) * 0.3) * 100) : 0}%
                </div>
                <small>Overall performance</small>
              </div>
            </div>
          ) : (
            <div className="no-stats">
              <p>No usage statistics available for this task.</p>
              <small>Statistics will appear after the task has been executed.</small>
            </div>
          )}
          
          <div className="task-details">
            <h4>Task Details</h4>
            <div className="detail-grid">
              <div className="detail-item">
                <label>Created:</label>
                <span>{ensureDate(task.createdAt).toLocaleString()}</span>
              </div>
              <div className="detail-item">
                <label>Last Updated:</label>
                <span>{ensureDate(task.updatedAt).toLocaleString()}</span>
              </div>
              <div className="detail-item">
                <label>Output Format:</label>
                <span>{task.outputFormat}</span>
              </div>
              <div className="detail-item">
                <label>Website Patterns:</label>
                <span>{task.websitePatterns.length} patterns</span>
              </div>
              <div className="detail-item">
                <label>Tags:</label>
                <span>{task.tags.length > 0 ? task.tags.join(', ') : 'None'}</span>
              </div>
              <div className="detail-item">
                <label>Status:</label>
                <span className={task.isEnabled ? 'enabled' : 'disabled'}>
                  {task.isEnabled ? (
                    <>
                      <CheckIcon size={12} /> Enabled
                    </>
                  ) : (
                    <>
                      <ErrorIcon size={12} /> Disabled
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// TASK EXPORT MODAL
// ============================================================================

const TaskExportModal: React.FC<TaskExportModalProps> = ({
  tasks,
  selectedTaskIds,
  onExport,
  onClose
}) => {
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [includeStats, setIncludeStats] = useState(false);
  const [exportTaskIds, setExportTaskIds] = useState<string[]>(selectedTaskIds);

  const selectedTasks = tasks.filter(task => exportTaskIds.includes(task.id));

  const handleExport = () => {
    onExport(exportFormat, exportTaskIds);
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setExportTaskIds(tasks.map(task => task.id));
    } else {
      setExportTaskIds([]);
    }
  };

  const handleTaskToggle = (taskId: string, selected: boolean) => {
    if (selected) {
      setExportTaskIds(prev => [...prev, taskId]);
    } else {
      setExportTaskIds(prev => prev.filter(id => id !== taskId));
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal export-modal">
        <div className="modal-header">
          <h3>Export Tasks</h3>
          <button className="btn btn-secondary" onClick={onClose}><CloseIcon size={16} /></button>
        </div>
        
        <div className="modal-content">
          <div className="export-options">
            <div className="option-group">
              <label>Export Format:</label>
              <div className="radio-group">
                <label>
                  <input
                    type="radio"
                    value="json"
                    checked={exportFormat === 'json'}
                    onChange={(e) => setExportFormat(e.target.value as 'json')}
                  />
                  JSON (recommended for import)
                </label>
                <label>
                  <input
                    type="radio"
                    value="csv"
                    checked={exportFormat === 'csv'}
                    onChange={(e) => setExportFormat(e.target.value as 'csv')}
                  />
                  CSV (for spreadsheet analysis)
                </label>
              </div>
            </div>
            
            <div className="option-group">
              <label>
                <input
                  type="checkbox"
                  checked={includeStats}
                  onChange={(e) => setIncludeStats(e.target.checked)}
                />
                Include usage statistics (JSON only)
              </label>
            </div>
          </div>
          
          <div className="task-selection">
            <div className="selection-header">
              <label>
                <input
                  type="checkbox"
                  checked={exportTaskIds.length === tasks.length && tasks.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                />
                Select All Tasks ({exportTaskIds.length} selected)
              </label>
            </div>
            
            <div className="task-list">
              {tasks.map(task => (
                <label key={task.id} className="task-item">
                  <input
                    type="checkbox"
                    checked={exportTaskIds.includes(task.id)}
                    onChange={(e) => handleTaskToggle(task.id, e.target.checked)}
                  />
                  <div className="task-info">
                    <span className="task-name">{task.name}</span>
                    <small className="task-description">{task.description}</small>
                  </div>
                </label>
              ))}
            </div>
          </div>
          
          <div className="export-preview">
            <h4>Export Preview</h4>
            <p>
              {exportTaskIds.length} task{exportTaskIds.length !== 1 ? 's' : ''} will be exported
              as {exportFormat.toUpperCase()}{includeStats && exportFormat === 'json' ? ' with statistics' : ''}.
            </p>
            {selectedTasks.length > 0 && (
              <div className="preview-list">
                {selectedTasks.slice(0, 3).map(task => (
                  <div key={task.id} className="preview-item">
                    • {task.name}
                  </div>
                ))}
                {selectedTasks.length > 3 && (
                  <div className="preview-item">
                    ... and {selectedTasks.length - 3} more
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleExport}
            disabled={exportTaskIds.length === 0}
          >
            Export {exportTaskIds.length} Task{exportTaskIds.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// TASK IMPORT MODAL
// ============================================================================

const TaskImportModal: React.FC<TaskImportModalProps> = ({ onImport, onClose }) => {
  const [importData, setImportData] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsedTasks, setParsedTasks] = useState<CustomTask[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importMethod, setImportMethod] = useState<'paste' | 'file'>('file');

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImportFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setImportData(content);
        parseImportData(content);
      };
      reader.readAsText(file);
    }
  };

  const handleDataChange = (data: string) => {
    setImportData(data);
    parseImportData(data);
  };

  const parseImportData = (data: string) => {
    try {
      setParseError(null);
      
      if (!data.trim()) {
        setParsedTasks([]);
        return;
      }

      let parsed: any;
      
      // Try to parse as JSON
      try {
        parsed = JSON.parse(data);
      } catch (jsonError) {
        // Try to parse as CSV
        parsed = parseCSVData(data);
      }

      // Validate and convert to CustomTask array
      const tasks: CustomTask[] = Array.isArray(parsed) ? parsed : [parsed];
      
      const validatedTasks = tasks.map((task, index) => {
        // Ensure required fields exist
        if (!task.name || !task.description || !task.promptTemplate) {
          throw new Error(`Task ${index + 1} is missing required fields (name, description, or promptTemplate)`);
        }

        // Convert dates if they're strings
        const createdAt = task.createdAt ? new Date(task.createdAt) : new Date();
        const updatedAt = task.updatedAt ? new Date(task.updatedAt) : new Date();

        return {
          id: task.id || `imported_${Date.now()}_${index}`,
          name: task.name,
          description: task.description,
          websitePatterns: Array.isArray(task.websitePatterns) ? task.websitePatterns : [],
          promptTemplate: task.promptTemplate,
          outputFormat: task.outputFormat || OutputFormat.PLAIN_TEXT,
          automationSteps: task.automationSteps || [],
          createdAt,
          updatedAt,
          usageCount: task.usageCount || 0,
          isEnabled: task.isEnabled !== false, // Default to true
          tags: Array.isArray(task.tags) ? task.tags : []
        } as CustomTask;
      });

      setParsedTasks(validatedTasks);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Failed to parse import data');
      setParsedTasks([]);
    }
  };

  const parseCSVData = (csvData: string): any[] => {
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV must have at least a header row and one data row');
    }

    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    const tasks: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
      const task: any = {};

      headers.forEach((header, index) => {
        const value = values[index] || '';
        
        switch (header.toLowerCase()) {
          case 'name':
            task.name = value;
            break;
          case 'description':
            task.description = value;
            break;
          case 'website patterns':
            task.websitePatterns = value ? value.split(';').map(p => p.trim()) : [];
            break;
          case 'output format':
            task.outputFormat = value || OutputFormat.PLAIN_TEXT;
            break;
          case 'tags':
            task.tags = value ? value.split(';').map(t => t.trim()) : [];
            break;
          case 'created date':
            task.createdAt = value ? new Date(value) : new Date();
            break;
          case 'updated date':
            task.updatedAt = value ? new Date(value) : new Date();
            break;
          case 'usage count':
            task.usageCount = parseInt(value) || 0;
            break;
          case 'enabled':
            task.isEnabled = value.toLowerCase() === 'true';
            break;
        }
      });

      // Add default prompt template for CSV imports
      if (!task.promptTemplate) {
        task.promptTemplate = `Analyze the current page and provide assistance based on: ${task.description}`;
      }

      tasks.push(task);
    }

    return tasks;
  };

  const handleImport = () => {
    if (parsedTasks.length > 0) {
      onImport(parsedTasks);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal import-modal">
        <div className="modal-header">
          <h3>Import Tasks</h3>
          <button className="btn btn-secondary" onClick={onClose}>✕</button>
        </div>
        
        <div className="modal-content">
          <div className="import-method">
            <div className="method-tabs">
              <button
                className={`tab ${importMethod === 'file' ? 'active' : ''}`}
                onClick={() => setImportMethod('file')}
              >
                Upload File
              </button>
              <button
                className={`tab ${importMethod === 'paste' ? 'active' : ''}`}
                onClick={() => setImportMethod('paste')}
              >
                Paste Data
              </button>
            </div>
          </div>

          {importMethod === 'file' && (
            <div className="file-import">
              <div className="file-input">
                <input
                  type="file"
                  accept=".json,.csv"
                  onChange={handleFileChange}
                  id="import-file"
                />
                <label htmlFor="import-file" className="file-label">
                  {importFile ? importFile.name : 'Choose JSON or CSV file...'}
                </label>
              </div>
              <small>Supported formats: JSON (exported tasks) or CSV</small>
            </div>
          )}

          {importMethod === 'paste' && (
            <div className="paste-import">
              <textarea
                value={importData}
                onChange={(e) => handleDataChange(e.target.value)}
                placeholder="Paste your JSON or CSV data here..."
                rows={8}
                className="import-textarea"
              />
              <small>Paste JSON array of tasks or CSV data with headers</small>
            </div>
          )}

          {parseError && (
            <div className="error-message">
              <span>{parseError}</span>
            </div>
          )}

          {parsedTasks.length > 0 && (
            <div className="import-preview">
              <h4>Import Preview</h4>
              <p>{parsedTasks.length} task{parsedTasks.length !== 1 ? 's' : ''} ready to import:</p>
              
              <div className="preview-list">
                {parsedTasks.slice(0, 5).map((task, index) => (
                  <div key={index} className="preview-task">
                    <div className="task-name">[✓] {task.name}</div>
                    <div className="task-details">
                      <small>{task.description}</small>
                      <small>{task.websitePatterns.length} website pattern{task.websitePatterns.length !== 1 ? 's' : ''}</small>
                    </div>
                  </div>
                ))}
                {parsedTasks.length > 5 && (
                  <div className="preview-more">
                    ... and {parsedTasks.length - 5} more tasks
                  </div>
                )}
              </div>
              
              <div className="import-warnings">
                <small>
                  Note: Imported tasks will be created as new tasks. Existing tasks with the same name will not be overwritten.
                </small>
              </div>
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleImport}
            disabled={parsedTasks.length === 0}
          >
            Import {parsedTasks.length} Task{parsedTasks.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FullTaskManagement;