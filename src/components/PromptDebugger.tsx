/**
 * Prompt Debugging and Validation Component
 * 
 * Provides debugging interface for viewing final prompts sent to AI,
 * template validation, prompt preview, and error reporting.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  CustomTask,
  TemplateValidationResult,
  PromptDebugInfo,
  PromptPreviewResult,
  TemplateVariable,
  ExecutionContext,
  WebsiteContext,
  PageContent
} from '../types';
import { PromptManager } from '../services/promptManager';
import { CheckIcon, ErrorIcon, CloseIcon, CopyIcon, RefreshIcon } from './icons/IconComponents';

// ============================================================================
// INTERFACES
// ============================================================================

interface PromptDebuggerProps {
  task?: CustomTask;
  promptManager: PromptManager;
  executionContext?: ExecutionContext;
  onClose: () => void;
  mode: 'validation' | 'preview' | 'debug';
}

interface DebugSession {
  taskId: string;
  taskName: string;
  debugHistory: PromptDebugInfo[];
  lastExecution?: Date;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const PromptDebugger: React.FC<PromptDebuggerProps> = ({
  task,
  promptManager,
  executionContext,
  onClose,
  mode
}) => {
  // State management
  const [activeTab, setActiveTab] = useState<'validation' | 'preview' | 'history' | 'variables'>(
    mode === 'debug' ? 'history' : mode === 'preview' ? 'preview' : 'validation'
  );
  const [validationResult, setValidationResult] = useState<TemplateValidationResult | null>(null);
  const [previewResult, setPreviewResult] = useState<PromptPreviewResult | null>(null);
  const [debugHistory, setDebugHistory] = useState<PromptDebugInfo[]>([]);
  const [supportedVariables, setSupportedVariables] = useState<TemplateVariable[]>([]);
  const [testTemplate, setTestTemplate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize component
  useEffect(() => {
    if (task) {
      setTestTemplate(task.promptTemplate);
      validateTemplate(task.promptTemplate);
      loadDebugHistory(task.id);
    }
    loadSupportedVariables();
  }, [task]);

  // Load supported template variables
  const loadSupportedVariables = useCallback(() => {
    try {
      const variables = promptManager.getSupportedVariables();
      setSupportedVariables(variables);
    } catch (error) {
      console.error('Failed to load supported variables:', error);
      setError('Failed to load template variables');
    }
  }, [promptManager]);

  // Validate template
  const validateTemplate = useCallback(async (template: string) => {
    if (!template.trim()) {
      setValidationResult(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = promptManager.validatePromptTemplate(template);
      setValidationResult(result);
    } catch (error) {
      console.error('Template validation failed:', error);
      setError(error instanceof Error ? error.message : 'Validation failed');
      setValidationResult(null);
    } finally {
      setIsLoading(false);
    }
  }, [promptManager]);

  // Preview template with sample data
  const previewTemplate = useCallback(async (template: string) => {
    if (!template.trim()) {
      setPreviewResult(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const testResult = await promptManager.testTemplateVariables(template);
      const validationResult = promptManager.validatePromptTemplate(template);

      const previewResult: PromptPreviewResult = {
        processedPrompt: testResult.processedTemplate,
        variables: testResult.variables,
        errors: testResult.errors,
        warnings: validationResult.warnings,
        validationResult
      };

      setPreviewResult(previewResult);
    } catch (error) {
      console.error('Template preview failed:', error);
      setError(error instanceof Error ? error.message : 'Preview failed');
      setPreviewResult(null);
    } finally {
      setIsLoading(false);
    }
  }, [promptManager]);

  // Load debug history for task
  const loadDebugHistory = useCallback((taskId: string) => {
    try {
      const history = promptManager.getDebugHistory(taskId);
      setDebugHistory(history);
    } catch (error) {
      console.error('Failed to load debug history:', error);
      setError('Failed to load debug history');
    }
  }, [promptManager]);

  // Handle template change
  const handleTemplateChange = useCallback((newTemplate: string) => {
    setTestTemplate(newTemplate);
    
    // Auto-validate and preview on change (debounced)
    const timeoutId = setTimeout(() => {
      validateTemplate(newTemplate);
      if (activeTab === 'preview') {
        previewTemplate(newTemplate);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [validateTemplate, previewTemplate, activeTab]);

  // Copy to clipboard
  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Could add a toast notification here
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }, []);

  // Clear debug history
  const clearDebugHistory = useCallback(() => {
    if (task) {
      promptManager.clearDebugHistory(task.id);
      setDebugHistory([]);
    }
  }, [task, promptManager]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderValidationTab = () => (
    <div className="debug-tab-content">
      <div className="template-editor">
        <label htmlFor="template-input">Template to Validate:</label>
        <textarea
          id="template-input"
          value={testTemplate}
          onChange={(e) => handleTemplateChange(e.target.value)}
          placeholder="Enter your prompt template here..."
          rows={6}
          className="template-textarea"
        />
        <button
          onClick={() => validateTemplate(testTemplate)}
          disabled={isLoading || !testTemplate.trim()}
          className="validate-button"
        >
          {isLoading ? 'Validating...' : 'Validate Template'}
        </button>
      </div>

      {validationResult && (
        <div className="validation-results">
          <div className={`validation-status ${validationResult.isValid ? 'valid' : 'invalid'}`}>
            {validationResult.isValid ? <CheckIcon /> : <ErrorIcon />}
            <span>{validationResult.isValid ? 'Template is valid' : 'Template has errors'}</span>
          </div>

          {validationResult.errors.length > 0 && (
            <div className="validation-errors">
              <h4>Errors:</h4>
              <ul>
                {validationResult.errors.map((error, index) => (
                  <li key={index} className="error-item">
                    <ErrorIcon />
                    <span>{error.message}</span>
                    {error.variable && <code>{`{{${error.variable}}}`}</code>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {validationResult.warnings.length > 0 && (
            <div className="validation-warnings">
              <h4>Warnings:</h4>
              <ul>
                {validationResult.warnings.map((warning, index) => (
                  <li key={index} className="warning-item">
                    <span>⚠️ {warning}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {validationResult.variables.length > 0 && (
            <div className="detected-variables">
              <h4>Detected Variables:</h4>
              <div className="variables-grid">
                {validationResult.variables.map((variable, index) => (
                  <div key={index} className="variable-item">
                    <code>{`{{${variable.name}}}`}</code>
                    <span className="variable-description">{variable.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderPreviewTab = () => (
    <div className="debug-tab-content">
      <div className="template-editor">
        <label htmlFor="preview-template-input">Template to Preview:</label>
        <textarea
          id="preview-template-input"
          value={testTemplate}
          onChange={(e) => handleTemplateChange(e.target.value)}
          placeholder="Enter your prompt template here..."
          rows={4}
          className="template-textarea"
        />
        <button
          onClick={() => previewTemplate(testTemplate)}
          disabled={isLoading || !testTemplate.trim()}
          className="preview-button"
        >
          {isLoading ? 'Generating Preview...' : 'Preview with Sample Data'}
        </button>
      </div>

      {previewResult && (
        <div className="preview-results">
          <div className="preview-output">
            <div className="preview-header">
              <h4>Preview Output:</h4>
              <button
                onClick={() => copyToClipboard(previewResult.processedPrompt)}
                className="copy-button"
                title="Copy to clipboard"
              >
                <CopyIcon />
              </button>
            </div>
            <div className="preview-content">
              <pre>{previewResult.processedPrompt}</pre>
            </div>
          </div>

          {Object.keys(previewResult.variables).length > 0 && (
            <div className="injected-variables">
              <h4>Injected Variables:</h4>
              <div className="variables-list">
                {Object.entries(previewResult.variables).map(([name, status]) => (
                  <div key={name} className="variable-status">
                    <code>{`{{${name}}}`}</code>
                    <span className={`status ${status}`}>{status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {previewResult.errors.length > 0 && (
            <div className="preview-errors">
              <h4>Errors:</h4>
              <ul>
                {previewResult.errors.map((error, index) => (
                  <li key={index} className="error-item">
                    <ErrorIcon />
                    <span>{error}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderHistoryTab = () => (
    <div className="debug-tab-content">
      <div className="history-header">
        <h4>Debug History {task && `for "${task.name}"`}</h4>
        <div className="history-actions">
          <button onClick={() => task && loadDebugHistory(task.id)} className="refresh-button">
            <RefreshIcon />
          </button>
          <button onClick={clearDebugHistory} className="clear-button">
            Clear History
          </button>
        </div>
      </div>

      {debugHistory.length === 0 ? (
        <div className="no-history">
          <p>No debug history available.</p>
          <p>Execute the task to see debugging information here.</p>
        </div>
      ) : (
        <div className="history-list">
          {debugHistory.map((entry, index) => (
            <div key={index} className="history-entry">
              <div className="entry-header">
                <span className="entry-timestamp">
                  {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : `Execution ${index + 1}`}
                </span>
                {entry.executionTime && (
                  <span className="execution-time">{entry.executionTime}ms</span>
                )}
              </div>

              <div className="entry-content">
                <div className="original-template">
                  <h5>Original Template:</h5>
                  <pre>{entry.originalTemplate}</pre>
                </div>

                <div className="detected-variables">
                  <h5>Detected Variables:</h5>
                  <div className="variables-tags">
                    {entry.detectedVariables.map((variable, vIndex) => (
                      <code key={vIndex} className="variable-tag">{`{{${variable}}}`}</code>
                    ))}
                  </div>
                </div>

                <div className="injected-values">
                  <h5>Injected Values:</h5>
                  <div className="values-list">
                    {Object.entries(entry.injectedVariables).map(([key, value]) => (
                      <div key={key} className="value-item">
                        <code>{key}:</code>
                        <span>{String(value).substring(0, 100)}...</span>
                      </div>
                    ))}
                  </div>
                </div>

                {entry.processingSteps.length > 0 && (
                  <div className="processing-steps">
                    <h5>Processing Steps:</h5>
                    <ul>
                      {entry.processingSteps.map((step, sIndex) => (
                        <li key={sIndex}>{step}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {entry.warnings.length > 0 && (
                  <div className="entry-warnings">
                    <h5>Warnings:</h5>
                    <ul>
                      {entry.warnings.map((warning, wIndex) => (
                        <li key={wIndex} className="warning-item">⚠️ {warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderVariablesTab = () => (
    <div className="debug-tab-content">
      <div className="variables-reference">
        <h4>Available Template Variables</h4>
        <p>Use these variables in your prompt templates by wrapping them in double curly braces.</p>
        
        <div className="variables-grid">
          {supportedVariables.map((variable, index) => (
            <div key={index} className="variable-reference-item">
              <div className="variable-syntax">
                <code>{`{{${variable.name}}}`}</code>
                <button
                  onClick={() => copyToClipboard(`{{${variable.name}}}`)}
                  className="copy-variable-button"
                  title="Copy variable syntax"
                >
                  <CopyIcon />
                </button>
              </div>
              <div className="variable-info">
                <span className="variable-type">{variable.type}</span>
                <span className="variable-description">{variable.description}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="usage-examples">
          <h5>Usage Examples:</h5>
          <div className="example-templates">
            <div className="example-item">
              <h6>Basic Context:</h6>
              <code>Analyze the content on {`{{domain}}`} titled "{`{{pageTitle}}`}"</code>
            </div>
            <div className="example-item">
              <h6>Selected Text Analysis:</h6>
              <code>Please explain this text from {`{{domain}}`}: "{`{{selectedText}}`}"</code>
            </div>
            <div className="example-item">
              <h6>Page Summary:</h6>
              <code>Summarize the main content: {`{{mainText}}`}</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="prompt-debugger">
      <div className="debugger-header">
        <h3>Prompt Debugger</h3>
        <button onClick={onClose} className="close-button" aria-label="Close debugger">
          <CloseIcon />
        </button>
      </div>

      {error && (
        <div className="debugger-error">
          <ErrorIcon />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="dismiss-error">
            <CloseIcon />
          </button>
        </div>
      )}

      <div className="debugger-tabs">
        <button
          className={`tab-button ${activeTab === 'validation' ? 'active' : ''}`}
          onClick={() => setActiveTab('validation')}
        >
          Validation
        </button>
        <button
          className={`tab-button ${activeTab === 'preview' ? 'active' : ''}`}
          onClick={() => setActiveTab('preview')}
        >
          Preview
        </button>
        <button
          className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          History
        </button>
        <button
          className={`tab-button ${activeTab === 'variables' ? 'active' : ''}`}
          onClick={() => setActiveTab('variables')}
        >
          Variables
        </button>
      </div>

      <div className="debugger-content">
        {activeTab === 'validation' && renderValidationTab()}
        {activeTab === 'preview' && renderPreviewTab()}
        {activeTab === 'history' && renderHistoryTab()}
        {activeTab === 'variables' && renderVariablesTab()}
      </div>
    </div>
  );
};

export default PromptDebugger;