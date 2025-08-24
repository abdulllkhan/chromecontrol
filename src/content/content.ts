// Content script for the Agentic Chrome Extension
import type { PageContent, FormElement, LinkElement, AutomationStep, AutomationResult, SecurityLevel } from '../types';
import { AutomationEngine, AutomationPermissions, PageContext } from '../services/automationEngine';
import { OptimizedDOMService, createOptimizedDOMService, DOM_CONFIGS } from '../services/optimizedDOMService';
import { PerformanceMonitor, createPerformanceMonitor, PERFORMANCE_CONFIGS } from '../services/performanceMonitor';

console.log('Agentic Chrome Extension content script loaded on:', window.location.href);

// Initialize performance monitoring and optimized DOM service
const performanceMonitor = createPerformanceMonitor(PERFORMANCE_CONFIGS.PRODUCTION);
const optimizedDOM = createOptimizedDOMService(DOM_CONFIGS.BALANCED);

// Connect services
optimizedDOM.setPerformanceMonitor(performanceMonitor);

// ============================================================================
// PAGE CONTENT EXTRACTION
// ============================================================================

/**
 * Extracts comprehensive page content for analysis
 */
async function extractPageContent(): Promise<PageContent> {
  const operationId = performanceMonitor.startOperation('extract-page-content');
  
  try {
    const [headings, textContent, forms, links, metadata] = await Promise.all([
      extractHeadings(),
      extractTextContent(),
      extractForms(),
      extractLinks(),
      extractMetadata()
    ]);

    const content: PageContent = {
      url: window.location.href,
      title: document.title,
      headings,
      textContent,
      forms,
      links,
      metadata,
      extractedAt: new Date()
    };

    performanceMonitor.endOperation(operationId, true);
    return content;
  } catch (error) {
    performanceMonitor.endOperation(operationId, false, error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

/**
 * Extracts all headings from the page using optimized DOM service
 */
async function extractHeadings(): Promise<string[]> {
  const result = await optimizedDOM.extractText('h1, h2, h3, h4, h5, h6', {
    includeHidden: false,
    maxLength: 200,
    sanitize: true
  });
  
  return result.success ? result.data || [] : [];
}

/**
 * Extracts main text content from the page, excluding navigation and ads
 */
async function extractTextContent(): Promise<string> {
  const operationId = performanceMonitor.startOperation('extract-text-content');
  
  try {
    // Try main content areas first
    const contentSelectors = [
      'main', 'article', '[role="main"]', '.content', '#content',
      '.post', '.article', '.entry-content', '.page-content'
    ];
    
    for (const selector of contentSelectors) {
      const result = await optimizedDOM.extractText(selector, {
        includeHidden: false,
        maxLength: 5000,
        sanitize: true
      });
      
      if (result.success && result.data && result.data.length > 0) {
        const text = result.data.join(' ');
        if (text.length > 100) {
          performanceMonitor.endOperation(operationId, true);
          return text;
        }
      }
    }
    
    // Fallback to body content, excluding unwanted elements
    const excludeSelectors = [
      'script', 'style', 'nav', 'header', 'footer', 
      '[class*="ad"]', '[class*="advertisement"]', '[id*="ad"]',
      '[class*="sidebar"]', '[class*="menu"]', '[role="navigation"]'
    ].join(', ');
    
    const bodyResult = await optimizedDOM.extractText(`body *:not(${excludeSelectors})`, {
      includeHidden: false,
      maxLength: 5000,
      sanitize: true
    });
    
    const textContent = bodyResult.success && bodyResult.data 
      ? bodyResult.data.join(' ').slice(0, 5000)
      : '';
    
    performanceMonitor.endOperation(operationId, true);
    return textContent;
  } catch (error) {
    performanceMonitor.endOperation(operationId, false, error instanceof Error ? error.message : 'Unknown error');
    return '';
  }
}

/**
 * Extracts form information from the page using optimized DOM service
 */
async function extractForms(): Promise<FormElement[]> {
  const operationId = performanceMonitor.startOperation('extract-forms');
  
  try {
    const result = await optimizedDOM.extractFormData();
    
    if (!result.success || !result.data) {
      performanceMonitor.endOperation(operationId, true);
      return [];
    }
    
    const forms: FormElement[] = [];
    
    // Also get form element attributes
    const attributeResult = await optimizedDOM.extractAttributes(
      'form input, form textarea, form select',
      ['id', 'name', 'type', 'placeholder', 'required']
    );
    
    if (attributeResult.success && attributeResult.data) {
      for (const attrs of attributeResult.data) {
        forms.push({
          id: attrs.id || undefined,
          name: attrs.name || undefined,
          type: attrs.type || 'text',
          placeholder: attrs.placeholder || undefined,
          required: attrs.required === 'true' || attrs.required === '',
          value: undefined // Don't extract values for security
        });
      }
    }
    
    performanceMonitor.endOperation(operationId, true);
    return forms;
  } catch (error) {
    performanceMonitor.endOperation(operationId, false, error instanceof Error ? error.message : 'Unknown error');
    return [];
  }
}

/**
 * Extracts links from the page using optimized DOM service
 */
async function extractLinks(): Promise<LinkElement[]> {
  const operationId = performanceMonitor.startOperation('extract-links');
  
  try {
    // Extract link attributes and text in parallel
    const [attributeResult, textResult] = await Promise.all([
      optimizedDOM.extractAttributes('a[href]', ['href', 'title']),
      optimizedDOM.extractText('a[href]', { includeHidden: false, maxLength: 100, sanitize: true })
    ]);
    
    const links: LinkElement[] = [];
    
    if (attributeResult.success && attributeResult.data && textResult.success && textResult.data) {
      const maxLinks = Math.min(50, attributeResult.data.length, textResult.data.length);
      
      for (let i = 0; i < maxLinks; i++) {
        const attrs = attributeResult.data[i];
        const text = textResult.data[i];
        
        if (attrs.href && text) {
          links.push({
            href: attrs.href,
            text: text.trim(),
            title: attrs.title || undefined
          });
        }
      }
    }
    
    performanceMonitor.endOperation(operationId, true);
    return links;
  } catch (error) {
    performanceMonitor.endOperation(operationId, false, error instanceof Error ? error.message : 'Unknown error');
    return [];
  }
}

/**
 * Extracts metadata from the page using optimized DOM service
 */
async function extractMetadata(): Promise<Record<string, string>> {
  const operationId = performanceMonitor.startOperation('extract-metadata');
  
  try {
    const metadata: Record<string, string> = {};
    
    // Extract meta tags in parallel
    const [metaResult, ogResult] = await Promise.all([
      optimizedDOM.extractAttributes('meta[name][content], meta[property][content]', ['name', 'property', 'content']),
      optimizedDOM.extractAttributes('meta[property^="og:"], meta[name^="twitter:"]', ['property', 'name', 'content'])
    ]);
    
    // Process regular meta tags
    if (metaResult.success && metaResult.data) {
      for (const attrs of metaResult.data) {
        const name = attrs.name || attrs.property;
        const content = attrs.content;
        
        if (name && content) {
          metadata[name] = content;
        }
      }
    }
    
    // Process Open Graph and Twitter Card data
    if (ogResult.success && ogResult.data) {
      for (const attrs of ogResult.data) {
        const property = attrs.property || attrs.name;
        const content = attrs.content;
        
        if (property && content) {
          metadata[property] = content;
        }
      }
    }
    
    // Add page-specific metadata
    metadata.url = window.location.href;
    metadata.domain = window.location.hostname;
    metadata.pathname = window.location.pathname;
    metadata.title = document.title;
    metadata.lang = document.documentElement.lang || 'en';
    metadata.charset = document.characterSet;
    
    performanceMonitor.endOperation(operationId, true);
    return metadata;
  } catch (error) {
    performanceMonitor.endOperation(operationId, false, error instanceof Error ? error.message : 'Unknown error');
    return {
      url: window.location.href,
      domain: window.location.hostname,
      pathname: window.location.pathname,
      title: document.title,
      lang: document.documentElement.lang || 'en',
      charset: document.characterSet
    };
  }
}

// ============================================================================
// CONTENT SANITIZATION
// ============================================================================

/**
 * Sanitizes page content before sending to AI services
 */
function sanitizePageContent(content: PageContent): PageContent {
  const sensitivePatterns = [
    // Email patterns
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    // Phone patterns
    /(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
    // Credit card patterns (basic)
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    // SSN patterns
    /\b\d{3}-\d{2}-\d{4}\b/g,
    // API keys and tokens (basic patterns)
    /\b[A-Za-z0-9]{32,}\b/g
  ];
  
  const sanitizedContent = { ...content };
  
  // Sanitize text content
  sensitivePatterns.forEach(pattern => {
    sanitizedContent.textContent = sanitizedContent.textContent.replace(pattern, '[REDACTED]');
  });
  
  // Sanitize headings
  sanitizedContent.headings = sanitizedContent.headings.map(heading => {
    let sanitized = heading;
    sensitivePatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });
    return sanitized;
  });
  
  // Remove sensitive form data
  sanitizedContent.forms = sanitizedContent.forms.map(form => ({
    ...form,
    value: form.type === 'password' || form.type === 'email' ? undefined : form.value
  }));
  
  // Sanitize metadata
  const sanitizedMetadata: Record<string, string> = {};
  Object.entries(sanitizedContent.metadata).forEach(([key, value]) => {
    let sanitizedValue = value;
    sensitivePatterns.forEach(pattern => {
      sanitizedValue = sanitizedValue.replace(pattern, '[REDACTED]');
    });
    sanitizedMetadata[key] = sanitizedValue;
  });
  sanitizedContent.metadata = sanitizedMetadata;
  
  return sanitizedContent;
}

/**
 * Checks if the current page contains sensitive information
 */
function detectSensitiveContent(): boolean {
  const sensitiveIndicators = [
    // Form indicators
    'input[type="password"]',
    'input[type="email"]',
    'input[name*="credit"]',
    'input[name*="card"]',
    'input[name*="ssn"]',
    'input[name*="social"]',
    
    // URL indicators
    'login', 'signin', 'signup', 'register', 'checkout', 'payment', 'billing'
  ];
  
  // Check for sensitive form elements
  for (const selector of sensitiveIndicators.slice(0, 6)) {
    if (document.querySelector(selector)) {
      return true;
    }
  }
  
  // Check URL for sensitive keywords
  const url = window.location.href.toLowerCase();
  for (const keyword of sensitiveIndicators.slice(6)) {
    if (url.includes(keyword)) {
      return true;
    }
  }
  
  return false;
}

// ============================================================================
// DOM MANIPULATION UTILITIES
// ============================================================================

/**
 * Safely clicks an element
 */
function clickElement(selector: string): boolean {
  try {
    const element = document.querySelector(selector) as HTMLElement;
    if (!element) {
      console.warn(`Element not found: ${selector}`);
      return false;
    }
    
    if (!isElementInteractable(element)) {
      console.warn(`Element not interactable: ${selector}`);
      return false;
    }
    
    element.click();
    return true;
  } catch (error) {
    console.error(`Error clicking element ${selector}:`, error);
    return false;
  }
}

/**
 * Safely types text into an input element
 */
function typeIntoElement(selector: string, text: string): boolean {
  try {
    const element = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
    if (!element) {
      console.warn(`Element not found: ${selector}`);
      return false;
    }
    
    if (!isElementInteractable(element)) {
      console.warn(`Element not interactable: ${selector}`);
      return false;
    }
    
    // Clear existing content
    element.value = '';
    element.focus();
    
    // Type text character by character to simulate real typing
    for (let i = 0; i < text.length; i++) {
      element.value += text[i];
      
      // Dispatch input events
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    element.blur();
    return true;
  } catch (error) {
    console.error(`Error typing into element ${selector}:`, error);
    return false;
  }
}

/**
 * Safely selects an option from a select element
 */
function selectOption(selector: string, value: string): boolean {
  try {
    const element = document.querySelector(selector) as HTMLSelectElement;
    if (!element) {
      console.warn(`Element not found: ${selector}`);
      return false;
    }
    
    if (!isElementInteractable(element)) {
      console.warn(`Element not interactable: ${selector}`);
      return false;
    }
    
    element.value = value;
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  } catch (error) {
    console.error(`Error selecting option in ${selector}:`, error);
    return false;
  }
}

/**
 * Extracts text content from an element
 */
function extractFromElement(selector: string): string | null {
  try {
    const element = document.querySelector(selector);
    if (!element) {
      console.warn(`Element not found: ${selector}`);
      return null;
    }
    
    return element.textContent?.trim() || null;
  } catch (error) {
    console.error(`Error extracting from element ${selector}:`, error);
    return null;
  }
}

/**
 * Checks if an element is interactable
 */
function isElementInteractable(element: Element): boolean {
  const htmlElement = element as HTMLElement;
  
  // Check if element is visible
  const style = window.getComputedStyle(htmlElement);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }
  
  // Check if element is disabled
  if ('disabled' in htmlElement && htmlElement.disabled) {
    return false;
  }
  
  // Check if element is readonly
  if ('readOnly' in htmlElement && htmlElement.readOnly) {
    return false;
  }
  
  return true;
}

/**
 * Waits for an element to appear or a condition to be met
 */
function waitForCondition(condition: { type: string; value: string | number }): Promise<boolean> {
  return new Promise((resolve) => {
    const timeout = 10000; // 10 seconds max wait
    const startTime = Date.now();
    
    const checkCondition = () => {
      if (Date.now() - startTime > timeout) {
        resolve(false);
        return;
      }
      
      switch (condition.type) {
        case 'element':
          if (document.querySelector(condition.value as string)) {
            resolve(true);
            return;
          }
          break;
        case 'timeout':
          if (Date.now() - startTime >= (condition.value as number)) {
            resolve(true);
            return;
          }
          break;
        case 'url_change':
          if (window.location.href.includes(condition.value as string)) {
            resolve(true);
            return;
          }
          break;
      }
      
      setTimeout(checkCondition, 100);
    };
    
    checkCondition();
  });
}

// ============================================================================
// AUTOMATION ENGINE INTEGRATION
// ============================================================================

// Initialize automation engine
const automationEngine = new AutomationEngine();

/**
 * Gets the current page context for automation
 */
function getPageContext(): PageContext {
  const hasSensitive = detectSensitiveContent();
  
  // Determine security level based on page content and URL
  let securityLevel: SecurityLevel = SecurityLevel.PUBLIC;
  
  if (hasSensitive) {
    securityLevel = SecurityLevel.CAUTIOUS;
  }
  
  // Check for high-security domains
  const highSecurityDomains = ['bank', 'paypal', 'stripe', 'healthcare', 'medical'];
  const domain = window.location.hostname.toLowerCase();
  
  if (highSecurityDomains.some(keyword => domain.includes(keyword))) {
    securityLevel = SecurityLevel.RESTRICTED;
  }
  
  // Get automation permissions (these would typically come from user settings)
  const permissions: AutomationPermissions = {
    allowDOMManipulation: true,
    allowFormInteraction: !hasSensitive, // Restrict form interaction on sensitive pages
    allowNavigation: true,
    allowDataExtraction: true,
    restrictedDomains: [], // Would be populated from user settings
    maxExecutionTime: 30000
  };
  
  return {
    url: window.location.href,
    domain: window.location.hostname,
    securityLevel,
    hasUserGesture: true, // Assume user gesture in content script context
    permissions
  };
}

/**
 * Executes a series of automation steps using the automation engine
 */
async function executeAutomationSteps(steps: AutomationStep[]): Promise<AutomationResult> {
  try {
    const pageContext = getPageContext();
    
    // Set up progress callback to report to background script
    automationEngine.setProgressCallback((progress) => {
      chrome.runtime.sendMessage({
        type: 'AUTOMATION_PROGRESS',
        progress
      }).catch(() => {
        // Ignore errors if background script is not ready
      });
    });
    
    const result = await automationEngine.executeSteps(steps, pageContext);
    
    // Convert result format to match expected interface
    return {
      success: result.success,
      completedSteps: result.completedSteps,
      extractedData: result.extractedData,
      error: result.error,
      executionTime: result.executionTime,
      stepResults: result.stepResults
    };
    
  } catch (error) {
    return {
      success: false,
      completedSteps: 0,
      extractedData: {},
      error: error instanceof Error ? error.message : 'Unknown error during automation',
      executionTime: 0,
      stepResults: []
    };
  }
}

/**
 * Aborts current automation execution
 */
function abortAutomation(): boolean {
  try {
    automationEngine.abortExecution();
    return true;
  } catch (error) {
    console.error('Failed to abort automation:', error);
    return false;
  }
}

/**
 * Checks if automation is currently running
 */
function isAutomationRunning(): boolean {
  return automationEngine.isCurrentlyExecuting();
}

// ============================================================================
// PAGE CHANGE DETECTION
// ============================================================================

let lastUrl = window.location.href;
let lastTitle = document.title;
let pageChangeObserver: MutationObserver | null = null;
let contentChangeTimeout: NodeJS.Timeout | null = null;

/**
 * Initializes page change detection using MutationObserver
 */
function initializePageChangeDetection(): void {
  // Clean up existing observer
  if (pageChangeObserver) {
    pageChangeObserver.disconnect();
  }
  
  pageChangeObserver = new MutationObserver((mutations) => {
    let significantChange = false;
    
    // Check for URL changes (SPA navigation)
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      significantChange = true;
      console.log('URL changed to:', lastUrl);
    }
    
    // Check for title changes
    if (document.title !== lastTitle) {
      lastTitle = document.title;
      significantChange = true;
      console.log('Title changed to:', lastTitle);
    }
    
    // Check for significant DOM changes
    const hasSignificantMutation = mutations.some(mutation => {
      // Check for added/removed nodes that might indicate content changes
      if (mutation.type === 'childList') {
        const addedNodes = Array.from(mutation.addedNodes);
        const removedNodes = Array.from(mutation.removedNodes);
        
        // Look for significant elements being added/removed
        const significantElements = addedNodes.concat(removedNodes).some(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            const tagName = element.tagName?.toLowerCase();
            
            // Consider these elements as significant changes
            return ['article', 'main', 'section', 'div', 'form', 'table'].includes(tagName) &&
                   element.textContent && element.textContent.length > 50;
          }
          return false;
        });
        
        return significantElements;
      }
      
      return false;
    });
    
    if (hasSignificantMutation) {
      significantChange = true;
    }
    
    // Debounce content change notifications
    if (significantChange) {
      if (contentChangeTimeout) {
        clearTimeout(contentChangeTimeout);
      }
      
      contentChangeTimeout = setTimeout(() => {
        notifyPageChange();
      }, 500); // Wait 500ms for changes to settle
    }
  });
  
  // Observe changes to the entire document
  pageChangeObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false,
    characterData: false
  });
  
  // Also observe head changes for title updates
  if (document.head) {
    pageChangeObserver.observe(document.head, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false
    });
  }
}

/**
 * Notifies the background script of page changes
 */
function notifyPageChange(): void {
  const pageData = {
    url: window.location.href,
    title: document.title,
    domain: window.location.hostname,
    pathname: window.location.pathname,
    timestamp: Date.now(),
    hasSensitiveContent: detectSensitiveContent()
  };
  
  chrome.runtime.sendMessage({ 
    type: 'PAGE_CHANGED', 
    url: window.location.href,
    pageData
  }).catch(() => {
    // Ignore errors if background script is not ready
  });
}

// ============================================================================
// MESSAGE HANDLING
// ============================================================================

/**
 * Handles messages from the background script and popup
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request.type);
  
  switch (request.type) {
    case 'GET_PAGE_CONTENT':
      extractPageContent()
        .then(content => {
          const sanitized = request.sanitize ? sanitizePageContent(content) : content;
          sendResponse({ success: true, content: sanitized });
        })
        .catch(error => {
          sendResponse({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Failed to extract page content' 
          });
        });
      return true; // Keep message channel open for async response
      
    case 'GET_PAGE_INFO':
      try {
        const pageInfo = {
          url: window.location.href,
          title: document.title,
          domain: window.location.hostname,
          pathname: window.location.pathname,
          hasSensitiveContent: detectSensitiveContent(),
          timestamp: Date.now()
        };
        sendResponse({ success: true, pageInfo });
      } catch (error) {
        sendResponse({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to get page info' 
        });
      }
      break;
      
    case 'EXECUTE_AUTOMATION':
      if (request.steps && Array.isArray(request.steps)) {
        executeAutomationSteps(request.steps)
          .then(result => {
            sendResponse({ success: true, result });
          })
          .catch(error => {
            sendResponse({ 
              success: false, 
              error: error instanceof Error ? error.message : 'Automation failed' 
            });
          });
        return true; // Keep message channel open for async response
      } else {
        sendResponse({ success: false, error: 'Invalid automation steps' });
      }
      break;
      
    case 'ABORT_AUTOMATION':
      try {
        const success = abortAutomation();
        sendResponse({ success });
      } catch (error) {
        sendResponse({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to abort automation' 
        });
      }
      break;
      
    case 'CHECK_AUTOMATION_STATUS':
      try {
        const isRunning = isAutomationRunning();
        sendResponse({ success: true, isRunning });
      } catch (error) {
        sendResponse({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to check automation status' 
        });
      }
      break;
      
    case 'VALIDATE_AUTOMATION_PERMISSIONS':
      if (request.steps && Array.isArray(request.steps)) {
        try {
          const pageContext = getPageContext();
          automationEngine.validatePermissions(request.steps, pageContext)
            .then(valid => {
              sendResponse({ success: true, valid });
            })
            .catch(error => {
              sendResponse({ 
                success: false, 
                error: error instanceof Error ? error.message : 'Permission validation failed' 
              });
            });
          return true; // Keep message channel open for async response
        } catch (error) {
          sendResponse({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Failed to validate permissions' 
          });
        }
      } else {
        sendResponse({ success: false, error: 'Invalid automation steps' });
      }
      break;
      
    case 'CLICK_ELEMENT':
      if (request.selector) {
        const success = clickElement(request.selector);
        sendResponse({ success });
      } else {
        sendResponse({ success: false, error: 'No selector provided' });
      }
      break;
      
    case 'TYPE_TEXT':
      if (request.selector && request.text) {
        const success = typeIntoElement(request.selector, request.text);
        sendResponse({ success });
      } else {
        sendResponse({ success: false, error: 'Selector and text required' });
      }
      break;
      
    case 'EXTRACT_TEXT':
      if (request.selector) {
        const text = extractFromElement(request.selector);
        sendResponse({ success: text !== null, text });
      } else {
        sendResponse({ success: false, error: 'No selector provided' });
      }
      break;
      
    case 'CHECK_SENSITIVE_CONTENT':
      try {
        const hasSensitive = detectSensitiveContent();
        sendResponse({ success: true, hasSensitiveContent: hasSensitive });
      } catch (error) {
        sendResponse({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to check sensitive content' 
        });
      }
      break;
      
    case 'REINITIALIZE':
      try {
        initializePageChangeDetection();
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to reinitialize' 
        });
      }
      break;
      
    default:
      sendResponse({ success: false, error: 'Unknown request type' });
  }
  
  return true; // Keep message channel open for async responses
});

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initializes the content script
 */
function initialize(): void {
  console.log('Initializing Agentic Chrome Extension content script');
  
  // Initialize page change detection
  initializePageChangeDetection();
  
  // Notify background script that content script is ready
  chrome.runtime.sendMessage({ 
    type: 'CONTENT_SCRIPT_READY', 
    url: window.location.href,
    pageData: {
      url: window.location.href,
      title: document.title,
      domain: window.location.hostname,
      pathname: window.location.pathname,
      hasSensitiveContent: detectSensitiveContent(),
      timestamp: Date.now()
    }
  }).catch(() => {
    // Ignore errors if background script is not ready
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (pageChangeObserver) {
    pageChangeObserver.disconnect();
  }
  if (contentChangeTimeout) {
    clearTimeout(contentChangeTimeout);
  }
});