/**
 * Automation Engine Usage Examples
 * 
 * This file demonstrates how to use the AutomationEngine for various web automation tasks.
 */

import { AutomationEngine, AutomationPermissions, PageContext } from './automationEngine';
import { AutomationStep, SecurityLevel } from '../types';

// ============================================================================
// EXAMPLE USAGE
// ============================================================================

/**
 * Example: Basic form filling automation
 */
export async function fillLoginForm(username: string, password: string): Promise<void> {
  const engine = new AutomationEngine();
  
  // Define the automation steps
  const steps: AutomationStep[] = [
    {
      type: 'click',
      selector: '#username',
      description: 'Focus username field'
    },
    {
      type: 'type',
      selector: '#username',
      value: username,
      description: 'Enter username'
    },
    {
      type: 'click',
      selector: '#password',
      description: 'Focus password field'
    },
    {
      type: 'type',
      selector: '#password',
      value: password,
      description: 'Enter password'
    },
    {
      type: 'click',
      selector: '#login-button',
      description: 'Click login button'
    },
    {
      type: 'wait',
      selector: '',
      waitCondition: {
        type: 'url_change',
        value: 'dashboard'
      },
      description: 'Wait for redirect to dashboard'
    }
  ];

  // Set up page context
  const pageContext: PageContext = {
    url: window.location.href,
    domain: window.location.hostname,
    securityLevel: SecurityLevel.CAUTIOUS, // Login forms are sensitive
    hasUserGesture: true,
    permissions: {
      allowDOMManipulation: true,
      allowFormInteraction: true,
      allowNavigation: true,
      allowDataExtraction: false,
      restrictedDomains: [],
      maxExecutionTime: 30000
    }
  };

  // Execute the automation
  const result = await engine.executeSteps(steps, pageContext);
  
  if (result.success) {
    console.log('Login automation completed successfully');
  } else {
    console.error('Login automation failed:', result.error);
  }
}

/**
 * Example: E-commerce product search and data extraction
 */
export async function searchAndExtractProducts(searchTerm: string): Promise<any[]> {
  const engine = new AutomationEngine();
  const extractedProducts: any[] = [];
  
  // Set up progress monitoring
  engine.setProgressCallback((progress) => {
    console.log(`Automation progress: ${progress.currentStep}/${progress.totalSteps} - ${progress.message}`);
  });

  const steps: AutomationStep[] = [
    {
      type: 'click',
      selector: '#search-input',
      description: 'Focus search input'
    },
    {
      type: 'type',
      selector: '#search-input',
      value: searchTerm,
      description: 'Enter search term'
    },
    {
      type: 'click',
      selector: '#search-button',
      description: 'Click search button'
    },
    {
      type: 'wait',
      selector: '',
      waitCondition: {
        type: 'element',
        value: '.product-list'
      },
      description: 'Wait for search results'
    },
    {
      type: 'extract',
      selector: '.product-title',
      description: 'Extract product titles'
    },
    {
      type: 'extract',
      selector: '.product-price',
      description: 'Extract product prices'
    }
  ];

  const pageContext: PageContext = {
    url: window.location.href,
    domain: window.location.hostname,
    securityLevel: SecurityLevel.PUBLIC,
    hasUserGesture: true,
    permissions: {
      allowDOMManipulation: true,
      allowFormInteraction: true,
      allowNavigation: true,
      allowDataExtraction: true,
      restrictedDomains: [],
      maxExecutionTime: 45000
    }
  };

  const result = await engine.executeSteps(steps, pageContext);
  
  if (result.success && result.extractedData) {
    // Process extracted data
    Object.entries(result.extractedData).forEach(([key, value]) => {
      if (key.includes('product')) {
        extractedProducts.push(value);
      }
    });
  }

  return extractedProducts;
}

/**
 * Example: Social media post automation
 */
export async function createSocialMediaPost(content: string, hashtags: string[]): Promise<boolean> {
  const engine = new AutomationEngine();
  
  const steps: AutomationStep[] = [
    {
      type: 'click',
      selector: '[data-testid="tweetTextarea_0"]',
      description: 'Focus tweet compose area'
    },
    {
      type: 'type',
      selector: '[data-testid="tweetTextarea_0"]',
      value: `${content} ${hashtags.map(tag => `#${tag}`).join(' ')}`,
      description: 'Enter post content with hashtags'
    },
    {
      type: 'wait',
      selector: '',
      waitCondition: {
        type: 'timeout',
        value: 1000
      },
      description: 'Wait for content to be processed'
    },
    {
      type: 'click',
      selector: '[data-testid="tweetButtonInline"]',
      description: 'Click post button'
    }
  ];

  const pageContext: PageContext = {
    url: window.location.href,
    domain: window.location.hostname,
    securityLevel: SecurityLevel.PUBLIC,
    hasUserGesture: true,
    permissions: {
      allowDOMManipulation: true,
      allowFormInteraction: true,
      allowNavigation: false,
      allowDataExtraction: false,
      restrictedDomains: [],
      maxExecutionTime: 15000
    }
  };

  const result = await engine.executeSteps(steps, pageContext);
  return result.success;
}

/**
 * Example: Form validation and error handling
 */
export async function fillFormWithValidation(formData: Record<string, string>): Promise<{ success: boolean; errors: string[] }> {
  const engine = new AutomationEngine();
  const errors: string[] = [];
  
  const steps: AutomationStep[] = [];
  
  // Generate steps for each form field
  Object.entries(formData).forEach(([fieldName, value]) => {
    steps.push(
      {
        type: 'click',
        selector: `#${fieldName}`,
        description: `Focus ${fieldName} field`
      },
      {
        type: 'type',
        selector: `#${fieldName}`,
        value: value,
        description: `Enter ${fieldName}`
      }
    );
  });

  // Add submit step
  steps.push({
    type: 'click',
    selector: '#submit-button',
    description: 'Submit form'
  });

  // Add validation check
  steps.push({
    type: 'wait',
    selector: '',
    waitCondition: {
      type: 'timeout',
      value: 2000
    },
    description: 'Wait for form processing'
  });

  // Check for error messages
  steps.push({
    type: 'extract',
    selector: '.error-message',
    description: 'Extract any error messages'
  });

  const pageContext: PageContext = {
    url: window.location.href,
    domain: window.location.hostname,
    securityLevel: SecurityLevel.CAUTIOUS,
    hasUserGesture: true,
    permissions: {
      allowDOMManipulation: true,
      allowFormInteraction: true,
      allowNavigation: true,
      allowDataExtraction: true,
      restrictedDomains: [],
      maxExecutionTime: 30000
    }
  };

  const result = await engine.executeSteps(steps, pageContext);
  
  if (result.extractedData) {
    Object.values(result.extractedData).forEach(value => {
      if (typeof value === 'string' && value.trim()) {
        errors.push(value);
      }
    });
  }

  return {
    success: result.success && errors.length === 0,
    errors
  };
}

/**
 * Example: Multi-step workflow with error recovery
 */
export async function complexWorkflowWithRecovery(): Promise<void> {
  const engine = new AutomationEngine();
  
  // Set up comprehensive progress monitoring
  engine.setProgressCallback((progress) => {
    console.log(`[${progress.status.toUpperCase()}] Step ${progress.currentStep}/${progress.totalSteps}: ${progress.message}`);
    
    if (progress.status === 'failed') {
      console.error('Automation failed, attempting recovery...');
    }
  });

  const steps: AutomationStep[] = [
    {
      type: 'click',
      selector: '#start-workflow',
      description: 'Start the workflow'
    },
    {
      type: 'wait',
      selector: '',
      waitCondition: {
        type: 'element',
        value: '#step-1-container'
      },
      description: 'Wait for step 1 to load'
    },
    {
      type: 'type',
      selector: '#step-1-input',
      value: 'Step 1 data',
      description: 'Fill step 1 data'
    },
    {
      type: 'click',
      selector: '#next-step-1',
      description: 'Proceed to step 2'
    },
    {
      type: 'wait',
      selector: '',
      waitCondition: {
        type: 'element',
        value: '#step-2-container'
      },
      description: 'Wait for step 2 to load'
    },
    {
      type: 'select',
      selector: '#step-2-dropdown',
      value: 'option-a',
      description: 'Select option in step 2'
    },
    {
      type: 'click',
      selector: '#complete-workflow',
      description: 'Complete the workflow'
    },
    {
      type: 'wait',
      selector: '',
      waitCondition: {
        type: 'element',
        value: '#success-message'
      },
      description: 'Wait for success confirmation'
    }
  ];

  const pageContext: PageContext = {
    url: window.location.href,
    domain: window.location.hostname,
    securityLevel: SecurityLevel.PUBLIC,
    hasUserGesture: true,
    permissions: {
      allowDOMManipulation: true,
      allowFormInteraction: true,
      allowNavigation: true,
      allowDataExtraction: true,
      restrictedDomains: [],
      maxExecutionTime: 60000 // Longer timeout for complex workflow
    }
  };

  try {
    const result = await engine.executeSteps(steps, pageContext);
    
    if (result.success) {
      console.log('Complex workflow completed successfully');
      console.log(`Completed ${result.completedSteps}/${result.totalSteps} steps in ${result.executionTime}ms`);
    } else {
      console.error('Workflow failed:', result.error);
      console.log('Step results:', result.stepResults);
    }
  } catch (error) {
    console.error('Unexpected error during workflow:', error);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a basic page context for testing
 */
export function createTestPageContext(overrides: Partial<PageContext> = {}): PageContext {
  return {
    url: 'https://example.com',
    domain: 'example.com',
    securityLevel: SecurityLevel.PUBLIC,
    hasUserGesture: true,
    permissions: {
      allowDOMManipulation: true,
      allowFormInteraction: true,
      allowNavigation: true,
      allowDataExtraction: true,
      restrictedDomains: [],
      maxExecutionTime: 30000
    },
    ...overrides
  };
}

/**
 * Create restrictive permissions for sensitive sites
 */
export function createRestrictivePermissions(): AutomationPermissions {
  return {
    allowDOMManipulation: false,
    allowFormInteraction: false,
    allowNavigation: false,
    allowDataExtraction: false,
    restrictedDomains: ['bank.com', 'paypal.com', 'healthcare.gov'],
    maxExecutionTime: 10000
  };
}

/**
 * Validate automation steps before execution
 */
export async function validateStepsBeforeExecution(
  steps: AutomationStep[], 
  context: PageContext
): Promise<{ valid: boolean; errors: string[] }> {
  const engine = new AutomationEngine();
  const errors: string[] = [];
  
  try {
    await engine.validatePermissions(steps, context);
    return { valid: true, errors: [] };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown validation error');
    return { valid: false, errors };
  }
}