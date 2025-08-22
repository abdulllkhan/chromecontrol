import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { FullTaskManagement } from '../TaskManagement';
import { TaskManager } from '../../services/taskManager';
import { ChromeStorageService } from '../../services/storage';
import { CustomTask, OutputFormat, UsageMetrics } from '../../types';

// Mock the services
vi.mock('../../services/taskManager');
vi.mock('../../services/storage');

const mockTaskManager = {
  getAllTasks: vi.fn(),
  duplicateTask: vi.fn(),
  deleteTask: vi.fn(),
  updateTask: vi.fn(),
  createTask: vi.fn()
} as unknown as TaskManager;

const mockStorageService = {
  getAllUsageStats: vi.fn()
} as unknown as ChromeStorageService;

const mockTasks: CustomTask[] = [
  {
    id: 'task-1',
    name: 'Test Task 1',
    description: 'A test task for social media',
    websitePatterns: ['twitter.com', 'facebook.com'],
    promptTemplate: 'Generate a social media post about {{topic}}',
    outputFormat: OutputFormat.PLAIN_TEXT,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
    usageCount: 5,
    isEnabled: true,
    tags: ['social', 'content']
  },
  {
    id: 'task-2',
    name: 'Test Task 2',
    description: 'A test task for e-commerce',
    websitePatterns: ['amazon.com', 'ebay.com'],
    promptTemplate: 'Analyze product {{product}} and provide insights',
    outputFormat: OutputFormat.JSON,
    createdAt: new Date('2024-01-03'),
    updatedAt: new Date('2024-01-04'),
    usageCount: 2,
    isEnabled: false,
    tags: ['ecommerce', 'analysis']
  }
];

const mockUsageStats: Record<string, UsageMetrics> = {
  'task-1': {
    taskId: 'task-1',
    usageCount: 5,
    successRate: 0.8,
    averageExecutionTime: 1500,
    lastUsed: new Date('2024-01-05'),
    errorCount: 1
  },
  'task-2': {
    taskId: 'task-2',
    usageCount: 2,
    successRate: 1.0,
    averageExecutionTime: 2000,
    lastUsed: new Date('2024-01-04'),
    errorCount: 0
  }
};

describe('FullTaskManagement', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock implementations
    (mockTaskManager.getAllTasks as any).mockResolvedValue({
      'task-1': mockTasks[0],
      'task-2': mockTasks[1]
    });
    
    (mockStorageService.getAllUsageStats as any).mockResolvedValue(mockUsageStats);
  });

  it('should render task management interface', async () => {
    render(
      <FullTaskManagement
        taskManager={mockTaskManager}
        storageService={mockStorageService}
        onClose={mockOnClose}
      />
    );

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Task Management')).toBeInTheDocument();
    });

    expect(screen.getByText('📚 Library')).toBeInTheDocument();
    expect(screen.getByText('📥 Import')).toBeInTheDocument();
  });

  it('should display tasks in library view', async () => {
    render(
      <FullTaskManagement
        taskManager={mockTaskManager}
        storageService={mockStorageService}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Task 1')).toBeInTheDocument();
      expect(screen.getByText('Test Task 2')).toBeInTheDocument();
    });

    expect(screen.getByText('A test task for social media')).toBeInTheDocument();
    expect(screen.getByText('A test task for e-commerce')).toBeInTheDocument();
  });

  it('should show task statistics', async () => {
    render(
      <FullTaskManagement
        taskManager={mockTaskManager}
        storageService={mockStorageService}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Task 1')).toBeInTheDocument();
    });

    // Check usage statistics are displayed
    expect(screen.getByText('Used: 5 times')).toBeInTheDocument();
    expect(screen.getByText('Success: 80%')).toBeInTheDocument();
    expect(screen.getByText('Used: 2 times')).toBeInTheDocument();
    expect(screen.getByText('Success: 100%')).toBeInTheDocument();
  });

  it('should handle task duplication', async () => {
    (mockTaskManager.duplicateTask as any).mockResolvedValue('new-task-id');
    
    render(
      <FullTaskManagement
        taskManager={mockTaskManager}
        storageService={mockStorageService}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Task 1')).toBeInTheDocument();
    });

    // Find and click duplicate button for first task
    const duplicateButtons = screen.getAllByText('📋 Duplicate');
    fireEvent.click(duplicateButtons[0]);

    await waitFor(() => {
      expect(mockTaskManager.duplicateTask).toHaveBeenCalledWith('task-1');
    });
  });

  it('should handle task deletion with confirmation', async () => {
    // Mock window.confirm
    const originalConfirm = window.confirm;
    window.confirm = vi.fn(() => true);

    (mockTaskManager.deleteTask as any).mockResolvedValue(true);
    
    render(
      <FullTaskManagement
        taskManager={mockTaskManager}
        storageService={mockStorageService}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Task 1')).toBeInTheDocument();
    });

    // Find and click delete button for first task
    const deleteButtons = screen.getAllByText('🗑️ Delete');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete this task?');
      expect(mockTaskManager.deleteTask).toHaveBeenCalledWith('task-1');
    });

    // Restore original confirm
    window.confirm = originalConfirm;
  });

  it('should handle task toggle (enable/disable)', async () => {
    (mockTaskManager.updateTask as any).mockResolvedValue(true);
    
    render(
      <FullTaskManagement
        taskManager={mockTaskManager}
        storageService={mockStorageService}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Task 1')).toBeInTheDocument();
    });

    // Find and click status toggle for second task (disabled)
    const statusToggles = screen.getAllByTitle(/Disable task|Enable task/);
    fireEvent.click(statusToggles[1]); // Second task is disabled

    await waitFor(() => {
      expect(mockTaskManager.updateTask).toHaveBeenCalledWith('task-2', { isEnabled: true });
    });
  });

  it('should filter tasks by search query', async () => {
    render(
      <FullTaskManagement
        taskManager={mockTaskManager}
        storageService={mockStorageService}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Task 1')).toBeInTheDocument();
      expect(screen.getByText('Test Task 2')).toBeInTheDocument();
    });

    // Find search input and type
    const searchInput = screen.getByPlaceholderText('Search tasks...');
    fireEvent.change(searchInput, { target: { value: 'social' } });

    // Should show only the first task
    await waitFor(() => {
      expect(screen.getByText('Test Task 1')).toBeInTheDocument();
      expect(screen.queryByText('Test Task 2')).not.toBeInTheDocument();
    });
  });

  it('should sort tasks by different criteria', async () => {
    render(
      <FullTaskManagement
        taskManager={mockTaskManager}
        storageService={mockStorageService}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Task 1')).toBeInTheDocument();
    });

    // Find sort dropdown by label
    const sortSelect = screen.getByLabelText('Sort by:');
    fireEvent.change(sortSelect, { target: { value: 'usage' } });

    // Tasks should be sorted by usage in ascending order (Task 2 with lower usage first)
    await waitFor(() => {
      const taskNames = screen.getAllByRole('heading', { level: 4 });
      expect(taskNames[0]).toHaveTextContent('Test Task 2'); // Lower usage first (ascending)
      expect(taskNames[1]).toHaveTextContent('Test Task 1'); // Higher usage second
    });
  });

  it('should show task statistics modal', async () => {
    render(
      <FullTaskManagement
        taskManager={mockTaskManager}
        storageService={mockStorageService}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Task 1')).toBeInTheDocument();
    });

    // Find and click stats button for first task
    const statsButtons = screen.getAllByText('📊 Stats');
    fireEvent.click(statsButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('📊 Task Statistics: Test Task 1')).toBeInTheDocument();
      expect(screen.getByText('Usage Count')).toBeInTheDocument();
      expect(screen.getByText('Success Rate')).toBeInTheDocument();
      // Use getAllByText since there might be multiple 80% values
      expect(screen.getAllByText('80%').length).toBeGreaterThan(0);
    });
  });

  it('should handle bulk selection and export', async () => {
    render(
      <FullTaskManagement
        taskManager={mockTaskManager}
        storageService={mockStorageService}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Task 1')).toBeInTheDocument();
    });

    // Show bulk actions
    const bulkActionsButton = screen.getByText('Show Bulk Actions');
    fireEvent.click(bulkActionsButton);

    await waitFor(() => {
      expect(screen.getByText('Select All (0 selected)')).toBeInTheDocument();
    });

    // Select all tasks
    const selectAllCheckbox = screen.getByLabelText(/Select All/);
    fireEvent.click(selectAllCheckbox);

    await waitFor(() => {
      expect(screen.getByText('📤 Export Selected')).toBeInTheDocument();
    });

    // Click export
    const exportButton = screen.getByText('📤 Export Selected');
    fireEvent.click(exportButton);

    // Should show export modal
    await waitFor(() => {
      expect(screen.getByText('📤 Export Tasks')).toBeInTheDocument();
    });
  });

  it('should handle import functionality', async () => {
    render(
      <FullTaskManagement
        taskManager={mockTaskManager}
        storageService={mockStorageService}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('📥 Import')).toBeInTheDocument();
    });

    // Click import button
    const importButton = screen.getByText('📥 Import');
    fireEvent.click(importButton);

    await waitFor(() => {
      expect(screen.getByText('📥 Import Tasks')).toBeInTheDocument();
      expect(screen.getByText('📁 Upload File')).toBeInTheDocument();
      expect(screen.getByText('📋 Paste Data')).toBeInTheDocument();
    });
  });

  it('should handle errors gracefully', async () => {
    // Mock error in getAllTasks
    (mockTaskManager.getAllTasks as any).mockRejectedValue(new Error('Storage error'));
    
    render(
      <FullTaskManagement
        taskManager={mockTaskManager}
        storageService={mockStorageService}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('❌ Storage error')).toBeInTheDocument();
    });
  });

  it('should close when close button is clicked', async () => {
    render(
      <FullTaskManagement
        taskManager={mockTaskManager}
        storageService={mockStorageService}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('✕ Close')).toBeInTheDocument();
    });

    const closeButton = screen.getByText('✕ Close');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should group tasks by category when grouping is enabled', async () => {
    render(
      <FullTaskManagement
        taskManager={mockTaskManager}
        storageService={mockStorageService}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Task 1')).toBeInTheDocument();
    });

    // Change grouping to website by finding the group select
    const groupSelect = screen.getByLabelText('Group by:');
    fireEvent.change(groupSelect, { target: { value: 'website' } });

    await waitFor(() => {
      // Should show group headers for website patterns
      expect(screen.getByRole('heading', { name: /twitter.com/ })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /amazon.com/ })).toBeInTheDocument();
    });
  });
});