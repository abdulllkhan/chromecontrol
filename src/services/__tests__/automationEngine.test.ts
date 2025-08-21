/**
 * Tests for AutomationEngine
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { AutomationEngine, AutomationResult, PageContext, AutomationPermissions } from '../automationEngine';
import { AutomationStep, SecurityLevel, ValidationError } from '../../types';

// Mock DOM methods
const mockQuerySelector = vi.fn();
const mockScrollIntoView = vi.fn();
const mockGetBoundingClientRect = vi.fn();
const mockDispatchEvent = vi.fn();
const mockFocus = vi.fn();

// Mock element
const createMockElement = (tagName: string = 'DIV', properties: Record<string, any> = {}) => ({
  tagName,
  scrollIntoView: mockScrollIntoView,
  getBoundingClientRect: mockGetBoundingClientRect,
  dispatchEvent: mockDispatchEvent,
  focus: mockFocus,
  textContent: 'Mock text content',
  ...properties
});

// Mock Chrome API
const mockChromePermissions = {
  request: vi.fn()
};

// Setup global mocks
beforeEach(() => {
  // Reset all mocks
  vi.clearAllMocks();
  
  // Mock document.querySelector
  Object.defineProperty(global, 'document', {
    value: {
      querySelector: mockQuerySelector
    },
    writable: true
  });

  // Mock window
  Object.defineProperty(global, 'window', {
    value: {
      location: { href: 'https://example.com' },
      innerHeight: 800,
      innerWidth: 1200
    },
    writable: true
  });

  // Mock Chrome API
  Object.defineProperty(global, 'chrome', {
    value: {
      permissions: mockChromePermissions
    },
    writable: true
  });

  // Setup default mock returns
  mockGetBoundingClientRect.mockReturnValue({
    width: 100,
    height: 50,
    top: 100,
    left: 100,
    bottom: 150,
    right: 200
  });

  mockChromePermissions.request.mockResolvedValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AutomationEngine', () => {
  let engine: AutomationEngine;
  let mockContext: PageContext;
  let mockPermissions: AutomationPermissions;

  beforeEach(() => {
    engine = new AutomationEngine();
    
    mockPermissions = {
      allowDOMManipulation: true,
      allowFormInteraction: true,
      allowNavigation: true,
      allowDataExtraction: true,
      restrictedDomains: [],
      maxExecutionTime: 30000
    };

    mockContext = {
      url: 'https://example.com',
      domain: 'example.com',
      securityLevel: SecurityLevel.PUBLIC,
      hasUserGesture: true,
      permissions: mockPermissions
    };
  });

  describe('executeSteps', () => {
    it('should execute a simple click step successfully', async () => {
      const mockElement = createMockElement('BUTTON');
      mockQuerySelector.mockReturnValue(mockElement);

      const steps: AutomationStep[] = [{
        type: 'click',
        selector: '#test-button',
        description: 'Click test button'
      }];

      const result = await engine.executeSteps(steps, mockContext);

      expect(result.success).toBe(true);
      expect(result.completedSteps).toBe(1);
      expect(result.totalSteps).toBe(1);
      expect(mockQuerySelector).toHaveBeenCalledWith('#test-button');
      expect(mockScrollIntoView).toHaveBeenCalled();
      expect(mockDispatchEvent).toHaveBeenCalled();
    });

    it('should execute a type step successfully', async () => {
      const mockElement = createMockElement('INPUT', { 
        value: '',
        focus: mockFocus
      });
      mockQuerySelector.mockReturnValue(mockElement);

      const steps: AutomationStep[] = [{
        type: 'type',
        selector: '#test-input',
        value: 'test value',
        description: 'Type in input field'
      }];

      const result = await engine.executeSteps(steps, mockContext);

      expect(result.success).toBe(true);
      expect(result.completedSteps).toBe(1);
      expect(mockElement.value).toBe('test value');
      expect(mockFocus).toHaveBeenCalled();
    });

    it('should execute a select step successfully', async () => {
      const mockOption = { value: 'option1', text: 'Option 1' };
      const mockElement = createMockElement('SELECT', {
        tagName: 'SELECT',
        value: '',
        options: [mockOption],
        dispatchEvent: mockDispatchEvent
      });
      mockQuerySelector.mockReturnValue(mockElement);

      const steps: AutomationStep[] = [{
        type: 'select',
        selector: '#test-select',
        value: 'option1',
        description: 'Select option'
      }];

      const result = await engine.executeSteps(steps, mockContext);

      expect(result.success).toBe(true);
      expect(result.completedSteps).toBe(1);
      expect(mockElement.value).toBe('option1');
    });

    it('should execute an extract step successfully', async () => {
      const mockElement = createMockElement('DIV', {
        textContent: 'Extracted text'
      });
      mockQuerySelector.mockReturnValue(mockElement);

      const steps: AutomationStep[] = [{
        type: 'extract',
        selector: '#test-element',
        description: 'Extract text content'
      }];

      const result = await engine.executeSteps(steps, mockContext);

      expect(result.success).toBe(true);
      expect(result.completedSteps).toBe(1);
      expect(result.extractedData).toEqual({
        'step_0_extract': 'Extracted text'
      });
    });

    it('should execute a wait step with timeout', async () => {
      const steps: AutomationStep[] = [{
        type: 'wait',
        selector: '',
        waitCondition: {
          type: 'timeout',
          value: 100
        },
        description: 'Wait for timeout'
      }];

      const startTime = Date.now();
      const result = await engine.executeSteps(steps, mockContext);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.completedSteps).toBe(1);
      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });

    it('should handle multiple steps in sequence', async () => {
      const mockButton = createMockElement('BUTTON');
      const mockInput = createMockElement('INPUT', { value: '' });
      
      mockQuerySelector
        .mockReturnValueOnce(mockButton)
        .mockReturnValueOnce(mockInput);

      const steps: AutomationStep[] = [
        {
          type: 'click',
          selector: '#button',
          description: 'Click button'
        },
        {
          type: 'type',
          selector: '#input',
          value: 'test',
          description: 'Type in input'
        }
      ];

      const result = await engine.executeSteps(steps, mockContext);

      expect(result.success).toBe(true);
      expect(result.completedSteps).toBe(2);
      expect(result.totalSteps).toBe(2);
    });

    it('should continue after recoverable errors like element not found', async () => {
      mockQuerySelector.mockReturnValue(null);

      const steps: AutomationStep[] = [{
        type: 'click',
        selector: '#nonexistent',
        description: 'Click nonexistent element'
      }];

      const result = await engine.executeSteps(steps, mockContext);

      // Element not found is now treated as recoverable, so execution continues
      expect(result.success).toBe(true);
      expect(result.completedSteps).toBe(0);
      expect(result.stepResults[0].success).toBe(false);
      expect(result.stepResults[0].error).toContain('Element not found');
    });

    it('should fail when permissions are insufficient', async () => {
      const restrictedContext = {
        ...mockContext,
        permissions: {
          ...mockPermissions,
          allowDOMManipulation: false
        }
      };

      const steps: AutomationStep[] = [{
        type: 'click',
        selector: '#button',
        description: 'Click button'
      }];

      const result = await engine.executeSteps(steps, restrictedContext);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('DOM manipulation permission required');
    });

    it('should fail on restricted domains', async () => {
      const restrictedContext = {
        ...mockContext,
        permissions: {
          ...mockPermissions,
          restrictedDomains: ['example.com']
        }
      };

      const steps: AutomationStep[] = [{
        type: 'click',
        selector: '#button',
        description: 'Click button'
      }];

      const result = await engine.executeSteps(steps, restrictedContext);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Automation is not allowed on domain');
    });

    it('should fail on restricted security level', async () => {
      const restrictedContext = {
        ...mockContext,
        securityLevel: SecurityLevel.RESTRICTED
      };

      const steps: AutomationStep[] = [{
        type: 'click',
        selector: '#button',
        description: 'Click button'
      }];

      const result = await engine.executeSteps(steps, restrictedContext);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Automation is not allowed on restricted security level sites');
    });

    it('should validate steps before execution', async () => {
      const invalidSteps = [{
        type: 'invalid_type',
        selector: '#button',
        description: 'Invalid step'
      }] as AutomationStep[];

      await expect(engine.executeSteps(invalidSteps, mockContext))
        .rejects.toThrow(ValidationError);
    });

    it('should handle empty steps array', async () => {
      await expect(engine.executeSteps([], mockContext))
        .rejects.toThrow('Steps must be a non-empty array');
    });

    it('should prevent concurrent executions', async () => {
      const mockElement = createMockElement('BUTTON');
      mockQuerySelector.mockReturnValue(mockElement);

      const steps: AutomationStep[] = [{
        type: 'click',
        selector: '#button',
        description: 'Click button'
      }];

      // Start first execution
      const firstExecution = engine.executeSteps(steps, mockContext);

      // Try to start second execution
      await expect(engine.executeSteps(steps, mockContext))
        .rejects.toThrow('Automation engine is already executing steps');

      // Wait for first execution to complete
      await firstExecution;
    });
  });

  describe('validatePermissions', () => {
    it('should validate permissions for different step types', async () => {
      const steps: AutomationStep[] = [
        { type: 'click', selector: '#btn', description: 'Click' },
        { type: 'type', selector: '#input', value: 'text', description: 'Type' },
        { type: 'select', selector: '#select', value: 'option', description: 'Select' },
        { type: 'extract', selector: '#div', description: 'Extract' }
      ];

      await expect(engine.validatePermissions(steps, mockContext))
        .resolves.toBe(true);
    });

    it('should request Chrome permissions when needed', async () => {
      const steps: AutomationStep[] = [{
        type: 'click',
        selector: '#button',
        description: 'Click button'
      }];

      await engine.validatePermissions(steps, mockContext);

      expect(mockChromePermissions.request).toHaveBeenCalledWith({
        permissions: ['activeTab']
      });
    });

    it('should fail when Chrome permissions are denied', async () => {
      mockChromePermissions.request.mockResolvedValue(false);

      const steps: AutomationStep[] = [{
        type: 'click',
        selector: '#button',
        description: 'Click button'
      }];

      await expect(engine.validatePermissions(steps, mockContext))
        .rejects.toThrow('Required permissions were not granted');
    });
  });

  describe('progress reporting', () => {
    it('should report progress during execution', async () => {
      const mockElement = createMockElement('BUTTON');
      mockQuerySelector.mockReturnValue(mockElement);

      const progressCallback = vi.fn();
      engine.setProgressCallback(progressCallback);

      const steps: AutomationStep[] = [{
        type: 'click',
        selector: '#button',
        description: 'Click button'
      }];

      await engine.executeSteps(steps, mockContext);

      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          currentStep: 0,
          totalSteps: 1,
          status: 'running',
          message: 'Starting automation execution'
        })
      );

      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          currentStep: 1,
          totalSteps: 1,
          status: 'completed',
          message: 'Automation execution completed successfully'
        })
      );
    });
  });

  describe('abortExecution', () => {
    it('should abort execution when requested', async () => {
      const mockElement = createMockElement('BUTTON');
      mockQuerySelector.mockReturnValue(mockElement);

      const steps: AutomationStep[] = [
        { type: 'click', selector: '#btn1', description: 'Click 1' },
        { type: 'click', selector: '#btn2', description: 'Click 2' }
      ];

      // Start execution
      const executionPromise = engine.executeSteps(steps, mockContext);

      // Abort immediately
      engine.abortExecution();

      const result = await executionPromise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('aborted');
    });
  });

  describe('isCurrentlyExecuting', () => {
    it('should return true during execution', async () => {
      const mockElement = createMockElement('BUTTON');
      mockQuerySelector.mockReturnValue(mockElement);

      const steps: AutomationStep[] = [{
        type: 'wait',
        selector: '',
        waitCondition: { type: 'timeout', value: 100 },
        description: 'Wait'
      }];

      const executionPromise = engine.executeSteps(steps, mockContext);

      expect(engine.isCurrentlyExecuting()).toBe(true);

      await executionPromise;

      expect(engine.isCurrentlyExecuting()).toBe(false);
    });
  });

  describe('error recovery', () => {
    it('should continue execution after recoverable errors', async () => {
      const mockButton = createMockElement('BUTTON');
      
      // Mock querySelector to return null for #missing and button for #existing
      mockQuerySelector.mockImplementation((selector: string) => {
        if (selector === '#missing') {
          return null;
        } else if (selector === '#existing') {
          return mockButton;
        }
        return null;
      });

      const steps: AutomationStep[] = [
        { type: 'click', selector: '#missing', description: 'Click missing' },
        { type: 'click', selector: '#existing', description: 'Click existing' }
      ];

      const result = await engine.executeSteps(steps, mockContext);

      expect(result.success).toBe(true);
      expect(result.completedSteps).toBe(1);
      expect(result.stepResults).toHaveLength(2);
      expect(result.stepResults[0].success).toBe(false);
      expect(result.stepResults[1].success).toBe(true);
    });
  });

  describe('wait conditions', () => {
    it('should wait for element to appear', async () => {
      const mockElement = createMockElement('DIV');
      
      // First few calls return null, then return element
      mockQuerySelector
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null)
        .mockReturnValue(mockElement);

      const steps: AutomationStep[] = [{
        type: 'wait',
        selector: '',
        waitCondition: {
          type: 'element',
          value: '#delayed-element'
        },
        description: 'Wait for element'
      }];

      const result = await engine.executeSteps(steps, mockContext);

      expect(result.success).toBe(true);
      expect(mockQuerySelector).toHaveBeenCalledWith('#delayed-element');
    });

    it('should wait for URL change', async () => {
      const steps: AutomationStep[] = [{
        type: 'wait',
        selector: '',
        waitCondition: {
          type: 'url_change',
          value: 'success'
        },
        description: 'Wait for URL change'
      }];

      // Simulate URL change after a delay
      setTimeout(() => {
        Object.defineProperty(window, 'location', {
          value: { href: 'https://example.com/success' },
          writable: true
        });
      }, 50);

      const result = await engine.executeSteps(steps, mockContext);

      expect(result.success).toBe(true);
    });
  });

  describe('element visibility', () => {
    it('should scroll element into view before interaction', async () => {
      const mockElement = createMockElement('BUTTON');
      mockQuerySelector.mockReturnValue(mockElement);

      const steps: AutomationStep[] = [{
        type: 'click',
        selector: '#button',
        description: 'Click button'
      }];

      await engine.executeSteps(steps, mockContext);

      expect(mockScrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center'
      });
    });
  });
});