/**
 * Tests for PromptDebugger component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PromptDebugger from '../PromptDebugger';
import { PromptManager } from '../../services/promptManager';
import { CustomTask, WebsiteCategory, OutputFormat, SecurityLevel, PageType } from '../../types';

// Mock the PromptManager
import { vi } from 'vitest';

describe('PromptDebugger', () => {
  let mockPromptManager: any;
  let mockTask: CustomTask;
  let mockOnClose: any;

  beforeEach(() => {
    mockPromptManager = {
      validatePromptTemplate: vi.fn(),
      testTemplateVariables: vi.fn(),
      getDebugHistory: vi.fn(),
      getSupportedVariables: vi.fn(),
      clearDebugHistory: vi.fn()
    };

    mockTask = {
      id: 'test-task-1',
      name: 'Test Task',
      description: 'A test task for debugging',
      websitePatterns: ['example.com'],
      promptTemplate: 'Analyze {{domain}} with title {{pageTitle}}',
      outputFormat: OutputFormat.PLAIN_TEXT,
      automationSteps: [],
      usageCount: 5,
      isEnabled: true,
      tags: ['test']
    };

    mockOnClose = vi.fn();

    // Setup default mock returns
    mockPromptManager.validatePromptTemplate.mockReturnValue({
      isValid: true,
      errors: [],
      warnings: [],
      variables: [
        { name: 'domain', type: 'string', required: true, description: 'Website domain' },
        { name: 'pageTitle', type: 'string', required: true, description: 'Page title' }
      ]
    });

    mockPromptManager.testTemplateVariables.mockResolvedValue({
      processedTemplate: 'Analyze example.com with title Sample Page',
      variables: { domain: 'injected', pageTitle: 'injected' },
      errors: []
    });

    mockPromptManager.getDebugHistory.mockReturnValue([]);

    mockPromptManager.getSupportedVariables.mockReturnValue([
      { name: 'domain', type: 'string', required: false, description: 'Website domain' },
      { name: 'pageTitle', type: 'string', required: false, description: 'Page title' },
      { name: 'selectedText', type: 'string', required: false, description: 'Selected text' }
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Validation Tab', () => {
    it('should render validation tab by default', () => {
      render(
        <PromptDebugger
          task={mockTask}
          promptManager={mockPromptManager}
          onClose={mockOnClose}
          mode="validation"
        />
      );

      expect(screen.getByText('Prompt Debugger')).toBeInTheDocument();
      expect(screen.getByText('Validation')).toBeInTheDocument();
      expect(screen.getByDisplayValue(mockTask.promptTemplate)).toBeInTheDocument();
    });

    it('should validate template on load', () => {
      render(
        <PromptDebugger
          task={mockTask}
          promptManager={mockPromptManager}
          onClose={mockOnClose}
          mode="validation"
        />
      );

      expect(mockPromptManager.validatePromptTemplate).toHaveBeenCalledWith(mockTask.promptTemplate);
    });

    it('should show validation results', async () => {
      render(
        <PromptDebugger
          task={mockTask}
          promptManager={mockPromptManager}
          onClose={mockOnClose}
          mode="validation"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Template is valid')).toBeInTheDocument();
      });
    });

    it('should show validation errors', async () => {
      mockPromptManager.validatePromptTemplate.mockReturnValue({
        isValid: false,
        errors: [
          { message: 'Unknown template variable: invalidVar', severity: 'error', variable: 'invalidVar' }
        ],
        warnings: ['Template is very short'],
        variables: []
      });

      render(
        <PromptDebugger
          task={mockTask}
          promptManager={mockPromptManager}
          onClose={mockOnClose}
          mode="validation"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Template has errors')).toBeInTheDocument();
        expect(screen.getByText('Unknown template variable: invalidVar')).toBeInTheDocument();
        expect(screen.getByText(/Template is very short/)).toBeInTheDocument();
      });
    });

    it('should validate template when text changes', async () => {
      render(
        <PromptDebugger
          task={mockTask}
          promptManager={mockPromptManager}
          onClose={mockOnClose}
          mode="validation"
        />
      );

      const textarea = screen.getByDisplayValue(mockTask.promptTemplate);
      fireEvent.change(textarea, { target: { value: 'New template {{domain}}' } });

      // Wait for debounced validation
      await waitFor(() => {
        expect(mockPromptManager.validatePromptTemplate).toHaveBeenCalledWith('New template {{domain}}');
      }, { timeout: 1000 });
    });
  });

  describe('Preview Tab', () => {
    it('should switch to preview tab', () => {
      render(
        <PromptDebugger
          task={mockTask}
          promptManager={mockPromptManager}
          onClose={mockOnClose}
          mode="preview"
        />
      );

      const previewTab = screen.getByText('Preview');
      fireEvent.click(previewTab);

      expect(screen.getByText('Preview with Sample Data')).toBeInTheDocument();
    });

    it('should generate preview when button clicked', async () => {
      render(
        <PromptDebugger
          task={mockTask}
          promptManager={mockPromptManager}
          onClose={mockOnClose}
          mode="preview"
        />
      );

      const previewButton = screen.getByText('Preview with Sample Data');
      fireEvent.click(previewButton);

      await waitFor(() => {
        expect(mockPromptManager.testTemplateVariables).toHaveBeenCalledWith(mockTask.promptTemplate);
      });
    });

    it('should show preview results', async () => {
      render(
        <PromptDebugger
          task={mockTask}
          promptManager={mockPromptManager}
          onClose={mockOnClose}
          mode="preview"
        />
      );

      const previewButton = screen.getByText('Preview with Sample Data');
      fireEvent.click(previewButton);

      await waitFor(() => {
        expect(screen.getByText('Analyze example.com with title Sample Page')).toBeInTheDocument();
      });
    });
  });

  describe('History Tab', () => {
    it('should show debug history', () => {
      const mockHistory = [
        {
          originalTemplate: 'Test {{domain}}',
          detectedVariables: ['domain'],
          injectedVariables: { domain: 'example.com' },
          processingSteps: ['Step 1', 'Step 2'],
          warnings: [],
          timestamp: new Date(),
          executionTime: 100
        }
      ];

      mockPromptManager.getDebugHistory.mockReturnValue(mockHistory);

      render(
        <PromptDebugger
          task={mockTask}
          promptManager={mockPromptManager}
          onClose={mockOnClose}
          mode="debug"
        />
      );

      expect(screen.getByText('Debug History for "Test Task"')).toBeInTheDocument();
      expect(screen.getByText('Test {{domain}}')).toBeInTheDocument();
    });

    it('should show no history message when empty', () => {
      render(
        <PromptDebugger
          task={mockTask}
          promptManager={mockPromptManager}
          onClose={mockOnClose}
          mode="debug"
        />
      );

      expect(screen.getByText('No debug history available.')).toBeInTheDocument();
    });

    it('should clear history when button clicked', () => {
      render(
        <PromptDebugger
          task={mockTask}
          promptManager={mockPromptManager}
          onClose={mockOnClose}
          mode="debug"
        />
      );

      const clearButton = screen.getByText('Clear History');
      fireEvent.click(clearButton);

      expect(mockPromptManager.clearDebugHistory).toHaveBeenCalledWith(mockTask.id);
    });
  });

  describe('Variables Tab', () => {
    it('should show supported variables', () => {
      render(
        <PromptDebugger
          task={mockTask}
          promptManager={mockPromptManager}
          onClose={mockOnClose}
          mode="validation"
        />
      );

      const variablesTab = screen.getByText('Variables');
      fireEvent.click(variablesTab);

      expect(screen.getByText('Available Template Variables')).toBeInTheDocument();
      expect(screen.getByText('{{domain}}')).toBeInTheDocument();
      expect(screen.getByText('{{pageTitle}}')).toBeInTheDocument();
      expect(screen.getByText('{{selectedText}}')).toBeInTheDocument();
    });

    it('should show usage examples', () => {
      render(
        <PromptDebugger
          task={mockTask}
          promptManager={mockPromptManager}
          onClose={mockOnClose}
          mode="validation"
        />
      );

      const variablesTab = screen.getByText('Variables');
      fireEvent.click(variablesTab);

      expect(screen.getByText('Usage Examples:')).toBeInTheDocument();
      expect(screen.getByText('Basic Context:')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors gracefully', async () => {
      mockPromptManager.validatePromptTemplate.mockImplementation(() => {
        throw new Error('Validation failed');
      });

      render(
        <PromptDebugger
          task={mockTask}
          promptManager={mockPromptManager}
          onClose={mockOnClose}
          mode="validation"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Validation failed')).toBeInTheDocument();
      });
    });

    it('should handle preview errors gracefully', async () => {
      mockPromptManager.testTemplateVariables.mockRejectedValue(new Error('Preview failed'));

      render(
        <PromptDebugger
          task={mockTask}
          promptManager={mockPromptManager}
          onClose={mockOnClose}
          mode="preview"
        />
      );

      const previewButton = screen.getByText('Preview with Sample Data');
      fireEvent.click(previewButton);

      await waitFor(() => {
        expect(screen.getByText('Preview failed')).toBeInTheDocument();
      });
    });
  });

  describe('Interaction', () => {
    it('should close when close button clicked', () => {
      render(
        <PromptDebugger
          task={mockTask}
          promptManager={mockPromptManager}
          onClose={mockOnClose}
          mode="validation"
        />
      );

      const closeButton = screen.getByLabelText(/close/i);
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should switch between tabs', () => {
      render(
        <PromptDebugger
          task={mockTask}
          promptManager={mockPromptManager}
          onClose={mockOnClose}
          mode="validation"
        />
      );

      // Switch to preview tab
      const previewTab = screen.getByText('Preview');
      fireEvent.click(previewTab);
      expect(screen.getByText('Preview with Sample Data')).toBeInTheDocument();

      // Switch to history tab
      const historyTab = screen.getByText('History');
      fireEvent.click(historyTab);
      expect(screen.getByText('Debug History for "Test Task"')).toBeInTheDocument();

      // Switch to variables tab
      const variablesTab = screen.getByText('Variables');
      fireEvent.click(variablesTab);
      expect(screen.getByText('Available Template Variables')).toBeInTheDocument();
    });
  });
});