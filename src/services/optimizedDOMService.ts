/**
 * Optimized DOM Service
 * 
 * Provides high-performance DOM querying, manipulation, and content extraction
 * with intelligent caching, batching, and optimization strategies.
 */

import { PerformanceMonitor } from './performanceMonitor.js';
import { CacheService } from './cacheService.js';

// ============================================================================
// DOM SERVICE INTERFACES
// ============================================================================

export interface DOMConfig {
  enableCaching: boolean;
  cacheTTL: number;
  enableBatching: boolean;
  batchDelay: number;
  maxBatchSize: number;
  enableOptimizations: boolean;
  useDocumentFragments: boolean;
  enableQueryOptimization: boolean;
}

export interface QueryOptions {
  cache?: boolean;
  timeout?: number;
  retries?: number;
  useOptimizedSelector?: boolean;
  batchable?: boolean;
}

export interface DOMOperation {
  id: string;
  type: 'query' | 'extract' | 'manipulate' | 'observe';
  selector?: string;
  element?: Element;
  operation: () => any;
  options?: QueryOptions;
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

export interface ExtractionResult {
  success: boolean;
  data?: any;
  error?: string;
  fromCache: boolean;
  executionTime: number;
  elementsFound: number;
}

export interface BatchResult {
  operations: number;
  successful: number;
  failed: number;
  totalTime: number;
  results: Map<string, any>;
}

// ============================================================================
// OPTIMIZED SELECTOR ENGINE
// ============================================================================

export class OptimizedSelectorEngine {
  private selectorCache = new Map<string, string>();
  private performanceStats = new Map<string, { uses: number; avgTime: number }>();

  /**
   * Optimizes a CSS selector for better performance
   */
  optimizeSelector(selector: string): string {
    // Check cache first
    if (this.selectorCache.has(selector)) {
      return this.selectorCache.get(selector)!;
    }

    let optimized = selector;

    // Remove redundant spaces
    optimized = optimized.replace(/\s+/g, ' ').trim();

    // Optimize descendant selectors
    optimized = this.optimizeDescendantSelectors(optimized);

    // Optimize attribute selectors
    optimized = this.optimizeAttributeSelectors(optimized);

    // Optimize pseudo-selectors
    optimized = this.optimizePseudoSelectors(optimized);

    // Cache the result
    this.selectorCache.set(selector, optimized);

    return optimized;
  }

  /**
   * Suggests the most efficient selector for an element
   */
  suggestOptimalSelector(element: Element): string {
    const selectors: Array<{ selector: string; specificity: number; performance: number }> = [];

    // Try ID selector (most specific and fast)
    if (element.id) {
      selectors.push({
        selector: `#${element.id}`,
        specificity: 100,
        performance: 95
      });
    }

    // Try class selectors
    if (element.className) {
      const classes = element.className.split(' ').filter(c => c.trim());
      if (classes.length > 0) {
        const classSelector = '.' + classes.join('.');
        selectors.push({
          selector: classSelector,
          specificity: classes.length * 10,
          performance: 80
        });
      }
    }

    // Try attribute selectors
    const uniqueAttributes = this.findUniqueAttributes(element);
    for (const attr of uniqueAttributes) {
      selectors.push({
        selector: `[${attr.name}="${attr.value}"]`,
        specificity: 10,
        performance: 60
      });
    }

    // Try tag + position selector
    const tagName = element.tagName.toLowerCase();
    const siblings = Array.from(element.parentElement?.children || []);
    const index = siblings.indexOf(element);
    
    if (index >= 0) {
      selectors.push({
        selector: `${tagName}:nth-child(${index + 1})`,
        specificity: 5,
        performance: 40
      });
    }

    // Sort by performance and specificity
    selectors.sort((a, b) => {
      const scoreA = a.performance + (a.specificity * 0.1);
      const scoreB = b.performance + (b.specificity * 0.1);
      return scoreB - scoreA;
    });

    return selectors[0]?.selector || tagName;
  }

  /**
   * Records performance statistics for a selector
   */
  recordSelectorPerformance(selector: string, executionTime: number): void {
    const stats = this.performanceStats.get(selector) || { uses: 0, avgTime: 0 };
    
    stats.uses++;
    stats.avgTime = ((stats.avgTime * (stats.uses - 1)) + executionTime) / stats.uses;
    
    this.performanceStats.set(selector, stats);
  }

  /**
   * Gets performance statistics for selectors
   */
  getSelectorStats(): Map<string, { uses: number; avgTime: number }> {
    return new Map(this.performanceStats);
  }

  /**
   * Optimizes descendant selectors
   */
  private optimizeDescendantSelectors(selector: string): string {
    // Convert inefficient descendant selectors to more specific ones
    return selector
      .replace(/\s+>\s+/g, ' > ') // Normalize child selectors
      .replace(/(\w+)\s+(\w+)/g, (match, parent, child) => {
        // If both are tag names, make it more specific
        if (this.isTagName(parent) && this.isTagName(child)) {
          return `${parent} > ${child}`;
        }
        return match;
      });
  }

  /**
   * Optimizes attribute selectors
   */
  private optimizeAttributeSelectors(selector: string): string {
    // Optimize common attribute patterns
    return selector
      .replace(/\[class\*="([^"]+)"\]/g, '.$1') // Convert class attribute to class selector
      .replace(/\[id="([^"]+)"\]/g, '#$1'); // Convert id attribute to id selector
  }

  /**
   * Optimizes pseudo-selectors
   */
  private optimizePseudoSelectors(selector: string): string {
    // Optimize common pseudo-selector patterns
    return selector
      .replace(/:nth-child\(1\)/g, ':first-child')
      .replace(/:nth-last-child\(1\)/g, ':last-child');
  }

  /**
   * Finds unique attributes for an element
   */
  private findUniqueAttributes(element: Element): Array<{ name: string; value: string }> {
    const attributes: Array<{ name: string; value: string }> = [];
    const commonAttributes = ['data-testid', 'data-id', 'name', 'type', 'role'];

    for (const attrName of commonAttributes) {
      const value = element.getAttribute(attrName);
      if (value && this.isUniqueAttribute(element, attrName, value)) {
        attributes.push({ name: attrName, value });
      }
    }

    return attributes;
  }

  /**
   * Checks if an attribute value is unique in the document
   */
  private isUniqueAttribute(element: Element, attrName: string, value: string): boolean {
    const selector = `[${attrName}="${value}"]`;
    const elements = document.querySelectorAll(selector);
    return elements.length === 1 && elements[0] === element;
  }

  /**
   * Checks if a string is a valid HTML tag name
   */
  private isTagName(str: string): boolean {
    return /^[a-z][a-z0-9]*$/i.test(str);
  }
}

// ============================================================================
// OPTIMIZED DOM SERVICE
// ============================================================================

export class OptimizedDOMService {
  private config: DOMConfig;
  private cacheService?: CacheService;
  private performanceMonitor?: PerformanceMonitor;
  private selectorEngine: OptimizedSelectorEngine;
  private operationQueue: DOMOperation[] = [];
  private batchTimer?: NodeJS.Timeout;
  private queryCache = new Map<string, { result: any; timestamp: number }>();
  private mutationObserver?: MutationObserver;
  private observedElements = new Set<Element>();

  constructor(config: Partial<DOMConfig> = {}) {
    this.config = {
      enableCaching: true,
      cacheTTL: 30000, // 30 seconds
      enableBatching: true,
      batchDelay: 10, // 10ms
      maxBatchSize: 50,
      enableOptimizations: true,
      useDocumentFragments: true,
      enableQueryOptimization: true,
      ...config
    };

    this.selectorEngine = new OptimizedSelectorEngine();
    this.initializeMutationObserver();
  }

  /**
   * Sets the cache service
   */
  setCacheService(cacheService: CacheService): void {
    this.cacheService = cacheService;
  }

  /**
   * Sets the performance monitor
   */
  setPerformanceMonitor(performanceMonitor: PerformanceMonitor): void {
    this.performanceMonitor = performanceMonitor;
  }

  /**
   * Optimized element querying with caching
   */
  async queryElements(
    selector: string,
    options: QueryOptions = {}
  ): Promise<ExtractionResult> {
    const startTime = performance.now();
    let operationId = '';

    if (this.performanceMonitor) {
      operationId = this.performanceMonitor.startOperation('dom-query', {
        selector,
        options
      });
    }

    try {
      // Check cache first
      if (options.cache !== false && this.config.enableCaching) {
        const cached = this.getCachedQuery(selector);
        if (cached) {
          const executionTime = performance.now() - startTime;
          
          if (this.performanceMonitor) {
            this.performanceMonitor.endOperation(operationId, true);
          }

          return {
            success: true,
            data: cached.result,
            fromCache: true,
            executionTime,
            elementsFound: cached.result?.length || 0
          };
        }
      }

      // Optimize selector if enabled
      const optimizedSelector = this.config.enableQueryOptimization
        ? this.selectorEngine.optimizeSelector(selector)
        : selector;

      // Perform query
      const elements = document.querySelectorAll(optimizedSelector);
      const result = Array.from(elements);
      const executionTime = performance.now() - startTime;

      // Cache result
      if (options.cache !== false && this.config.enableCaching) {
        this.cacheQuery(selector, result);
      }

      // Record performance stats
      this.selectorEngine.recordSelectorPerformance(optimizedSelector, executionTime);

      if (this.performanceMonitor) {
        this.performanceMonitor.endOperation(operationId, true);
      }

      return {
        success: true,
        data: result,
        fromCache: false,
        executionTime,
        elementsFound: result.length
      };

    } catch (error) {
      const executionTime = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (this.performanceMonitor) {
        this.performanceMonitor.endOperation(operationId, false, errorMessage);
      }

      return {
        success: false,
        error: errorMessage,
        fromCache: false,
        executionTime,
        elementsFound: 0
      };
    }
  }

  /**
   * Optimized single element querying
   */
  async querySelector(
    selector: string,
    options: QueryOptions = {}
  ): Promise<ExtractionResult> {
    const result = await this.queryElements(selector, options);
    
    if (result.success && result.data) {
      return {
        ...result,
        data: result.data[0] || null,
        elementsFound: result.data[0] ? 1 : 0
      };
    }

    return result;
  }

  /**
   * Batched DOM operations for better performance
   */
  async batchOperations<T>(
    operations: Array<() => T>
  ): Promise<BatchResult> {
    const startTime = performance.now();
    const results = new Map<string, any>();
    let successful = 0;
    let failed = 0;

    if (this.config.useDocumentFragments && operations.length > 1) {
      // Use document fragment for DOM modifications
      const fragment = document.createDocumentFragment();
      
      for (let i = 0; i < operations.length; i++) {
        const operationId = `batch-op-${i}`;
        
        try {
          const result = operations[i]();
          results.set(operationId, result);
          successful++;
        } catch (error) {
          results.set(operationId, { error: error instanceof Error ? error.message : 'Unknown error' });
          failed++;
        }
      }
    } else {
      // Execute operations normally
      for (let i = 0; i < operations.length; i++) {
        const operationId = `batch-op-${i}`;
        
        try {
          const result = operations[i]();
          results.set(operationId, result);
          successful++;
        } catch (error) {
          results.set(operationId, { error: error instanceof Error ? error.message : 'Unknown error' });
          failed++;
        }
      }
    }

    const totalTime = performance.now() - startTime;

    return {
      operations: operations.length,
      successful,
      failed,
      totalTime,
      results
    };
  }

  /**
   * Optimized text extraction from elements
   */
  async extractText(
    selector: string,
    options: { 
      includeHidden?: boolean;
      maxLength?: number;
      sanitize?: boolean;
    } = {}
  ): Promise<ExtractionResult> {
    const queryResult = await this.queryElements(selector);
    
    if (!queryResult.success || !queryResult.data) {
      return queryResult;
    }

    try {
      const elements = queryResult.data as Element[];
      const texts: string[] = [];

      for (const element of elements) {
        let text = '';

        // Check if element is visible (unless includeHidden is true)
        if (!options.includeHidden && !this.isElementVisible(element)) {
          continue;
        }

        // Extract text content
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
          text = (element as HTMLInputElement).value || '';
        } else {
          text = element.textContent || '';
        }

        // Sanitize text if requested
        if (options.sanitize) {
          text = this.sanitizeText(text);
        }

        // Apply length limit
        if (options.maxLength && text.length > options.maxLength) {
          text = text.slice(0, options.maxLength) + '...';
        }

        if (text.trim()) {
          texts.push(text.trim());
        }
      }

      return {
        ...queryResult,
        data: texts,
        elementsFound: texts.length
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Text extraction failed',
        fromCache: false,
        executionTime: queryResult.executionTime,
        elementsFound: 0
      };
    }
  }

  /**
   * Optimized attribute extraction
   */
  async extractAttributes(
    selector: string,
    attributes: string[]
  ): Promise<ExtractionResult> {
    const queryResult = await this.queryElements(selector);
    
    if (!queryResult.success || !queryResult.data) {
      return queryResult;
    }

    try {
      const elements = queryResult.data as Element[];
      const attributeData: Array<Record<string, string | null>> = [];

      for (const element of elements) {
        const attrs: Record<string, string | null> = {};
        
        for (const attrName of attributes) {
          attrs[attrName] = element.getAttribute(attrName);
        }
        
        attributeData.push(attrs);
      }

      return {
        ...queryResult,
        data: attributeData,
        elementsFound: attributeData.length
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Attribute extraction failed',
        fromCache: false,
        executionTime: queryResult.executionTime,
        elementsFound: 0
      };
    }
  }

  /**
   * Optimized form data extraction
   */
  async extractFormData(formSelector?: string): Promise<ExtractionResult> {
    const selector = formSelector || 'form';
    const queryResult = await this.queryElements(selector);
    
    if (!queryResult.success || !queryResult.data) {
      return queryResult;
    }

    try {
      const forms = queryResult.data as HTMLFormElement[];
      const formData: Array<Record<string, any>> = [];

      for (const form of forms) {
        const data: Record<string, any> = {};
        const formElements = form.querySelectorAll('input, textarea, select');

        for (const element of formElements) {
          const input = element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
          const name = input.name || input.id;
          
          if (name) {
            if (input.type === 'checkbox' || input.type === 'radio') {
              data[name] = (input as HTMLInputElement).checked;
            } else {
              data[name] = input.value;
            }
          }
        }

        formData.push(data);
      }

      return {
        ...queryResult,
        data: formData,
        elementsFound: formData.length
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Form data extraction failed',
        fromCache: false,
        executionTime: queryResult.executionTime,
        elementsFound: 0
      };
    }
  }

  /**
   * Observes elements for changes
   */
  observeElements(
    selector: string,
    callback: (mutations: MutationRecord[]) => void,
    options: MutationObserverInit = {}
  ): void {
    const elements = document.querySelectorAll(selector);
    
    for (const element of elements) {
      if (!this.observedElements.has(element)) {
        this.observedElements.add(element);
        
        if (this.mutationObserver) {
          this.mutationObserver.observe(element, {
            childList: true,
            attributes: true,
            characterData: true,
            ...options
          });
        }
      }
    }
  }

  /**
   * Stops observing elements
   */
  unobserveElements(selector?: string): void {
    if (selector) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        this.observedElements.delete(element);
      }
    } else {
      this.observedElements.clear();
    }

    // Reconnect observer with remaining elements
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.initializeMutationObserver();
    }
  }

  /**
   * Gets performance statistics
   */
  getPerformanceStats(): {
    selectorStats: Map<string, { uses: number; avgTime: number }>;
    cacheStats: { size: number; hitRate: number };
    operationStats: { queued: number; completed: number };
  } {
    const cacheHits = Array.from(this.queryCache.values()).reduce(
      (sum, entry) => sum + (entry.result ? 1 : 0), 0
    );
    
    return {
      selectorStats: this.selectorEngine.getSelectorStats(),
      cacheStats: {
        size: this.queryCache.size,
        hitRate: this.queryCache.size > 0 ? (cacheHits / this.queryCache.size) * 100 : 0
      },
      operationStats: {
        queued: this.operationQueue.length,
        completed: 0 // Would need to track this separately
      }
    };
  }

  /**
   * Clears all caches
   */
  clearCaches(): void {
    this.queryCache.clear();
    this.selectorEngine = new OptimizedSelectorEngine();
    console.log('DOM service caches cleared');
  }

  /**
   * Destroys the DOM service
   */
  destroy(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }

    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = undefined;
    }

    this.clearCaches();
    this.observedElements.clear();
    this.operationQueue = [];
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Gets cached query result
   */
  private getCachedQuery(selector: string): { result: any; timestamp: number } | null {
    const cached = this.queryCache.get(selector);
    
    if (cached && (Date.now() - cached.timestamp) < this.config.cacheTTL) {
      return cached;
    }

    if (cached) {
      this.queryCache.delete(selector);
    }

    return null;
  }

  /**
   * Caches query result
   */
  private cacheQuery(selector: string, result: any): void {
    this.queryCache.set(selector, {
      result,
      timestamp: Date.now()
    });

    // Limit cache size
    if (this.queryCache.size > 100) {
      const oldestKey = this.queryCache.keys().next().value;
      this.queryCache.delete(oldestKey);
    }
  }

  /**
   * Checks if an element is visible
   */
  private isElementVisible(element: Element): boolean {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0';
  }

  /**
   * Sanitizes extracted text
   */
  private sanitizeText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[\r\n\t]/g, ' ') // Remove line breaks and tabs
      .trim();
  }

  /**
   * Initializes mutation observer
   */
  private initializeMutationObserver(): void {
    if ('MutationObserver' in window) {
      this.mutationObserver = new MutationObserver((mutations) => {
        // Clear cache when DOM changes
        if (this.config.enableCaching) {
          this.queryCache.clear();
        }
      });
    }
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Creates an optimized DOM service
 */
export function createOptimizedDOMService(config?: Partial<DOMConfig>): OptimizedDOMService {
  return new OptimizedDOMService(config);
}

/**
 * Default DOM service configurations
 */
export const DOM_CONFIGS = {
  HIGH_PERFORMANCE: {
    enableCaching: true,
    cacheTTL: 60000, // 1 minute
    enableBatching: true,
    batchDelay: 5,
    maxBatchSize: 100,
    enableOptimizations: true,
    useDocumentFragments: true,
    enableQueryOptimization: true
  },
  MEMORY_EFFICIENT: {
    enableCaching: false,
    cacheTTL: 10000, // 10 seconds
    enableBatching: true,
    batchDelay: 20,
    maxBatchSize: 25,
    enableOptimizations: true,
    useDocumentFragments: false,
    enableQueryOptimization: true
  },
  BALANCED: {
    enableCaching: true,
    cacheTTL: 30000, // 30 seconds
    enableBatching: true,
    batchDelay: 10,
    maxBatchSize: 50,
    enableOptimizations: true,
    useDocumentFragments: true,
    enableQueryOptimization: true
  }
} as const;