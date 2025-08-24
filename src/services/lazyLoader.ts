/**
 * Lazy Loading Service
 * 
 * Provides intelligent lazy loading for suggestion categories, components,
 * and other resources to improve initial load performance.
 */

import { WebsiteCategory, Suggestion, PrioritizedSuggestion } from '../types/index.js';
import { CacheService } from './cacheService.js';
import { PerformanceMonitor } from './performanceMonitor.js';

// ============================================================================
// LAZY LOADING INTERFACES
// ============================================================================

export interface LazyLoadConfig {
  enablePreloading: boolean;
  preloadThreshold: number; // Distance from viewport to start preloading
  maxConcurrentLoads: number;
  cachePreloadedItems: boolean;
  priorityCategories: WebsiteCategory[];
}

export interface LoadableItem<T = any> {
  id: string;
  category: string;
  priority: number;
  loader: () => Promise<T>;
  isLoaded: boolean;
  isLoading: boolean;
  data?: T;
  error?: string;
  loadTime?: number;
}

export interface LazyLoadResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  fromCache: boolean;
  loadTime: number;
}

export interface PreloadStrategy {
  type: 'immediate' | 'viewport' | 'interaction' | 'idle' | 'priority';
  condition?: () => boolean;
  delay?: number;
}

// ============================================================================
// SUGGESTION CATEGORY LOADER
// ============================================================================

export class SuggestionCategoryLoader {
  private config: LazyLoadConfig;
  private loadableCategories = new Map<string, LoadableItem<Suggestion[]>>();
  private loadingQueue: string[] = [];
  private activeLoads = new Set<string>();
  private cacheService?: CacheService;
  private performanceMonitor?: PerformanceMonitor;
  private intersectionObserver?: IntersectionObserver;

  constructor(config: Partial<LazyLoadConfig> = {}) {
    this.config = {
      enablePreloading: true,
      preloadThreshold: 200, // 200px
      maxConcurrentLoads: 3,
      cachePreloadedItems: true,
      priorityCategories: [
        WebsiteCategory.SOCIAL_MEDIA,
        WebsiteCategory.PRODUCTIVITY,
        WebsiteCategory.ECOMMERCE
      ],
      ...config
    };

    this.initializeIntersectionObserver();
  }

  /**
   * Sets the cache service for caching loaded items
   */
  setCacheService(cacheService: CacheService): void {
    this.cacheService = cacheService;
  }

  /**
   * Sets the performance monitor for tracking load times
   */
  setPerformanceMonitor(performanceMonitor: PerformanceMonitor): void {
    this.performanceMonitor = performanceMonitor;
  }

  /**
   * Registers a suggestion category for lazy loading
   */
  registerCategory(
    category: WebsiteCategory,
    loader: () => Promise<Suggestion[]>,
    priority: number = 0
  ): void {
    const id = `category-${category}`;
    
    this.loadableCategories.set(id, {
      id,
      category: category.toString(),
      priority,
      loader,
      isLoaded: false,
      isLoading: false
    });

    console.log(`Registered lazy loadable category: ${category}`);
  }

  /**
   * Loads a specific category
   */
  async loadCategory(category: WebsiteCategory): Promise<LazyLoadResult<Suggestion[]>> {
    const id = `category-${category}`;
    const item = this.loadableCategories.get(id);

    if (!item) {
      return {
        success: false,
        error: `Category ${category} not registered`,
        fromCache: false,
        loadTime: 0
      };
    }

    // Return cached data if already loaded
    if (item.isLoaded && item.data) {
      return {
        success: true,
        data: item.data,
        fromCache: true,
        loadTime: item.loadTime || 0
      };
    }

    // Check cache first
    if (this.cacheService && this.config.cachePreloadedItems) {
      const cacheKey = `suggestions-${category}`;
      const cached = await this.cacheService.getCachedSuggestions<Suggestion>(cacheKey);
      
      if (cached) {
        item.data = cached;
        item.isLoaded = true;
        
        return {
          success: true,
          data: cached,
          fromCache: true,
          loadTime: 0
        };
      }
    }

    // Load the category
    return this.performLoad(item);
  }

  /**
   * Loads multiple categories in priority order
   */
  async loadCategories(categories: WebsiteCategory[]): Promise<Map<WebsiteCategory, LazyLoadResult<Suggestion[]>>> {
    const results = new Map<WebsiteCategory, LazyLoadResult<Suggestion[]>>();

    // Sort by priority
    const sortedCategories = categories
      .map(cat => ({
        category: cat,
        item: this.loadableCategories.get(`category-${cat}`)
      }))
      .filter(({ item }) => item !== undefined)
      .sort((a, b) => (b.item!.priority || 0) - (a.item!.priority || 0))
      .map(({ category }) => category);

    // Load categories with concurrency limit
    const loadPromises: Promise<void>[] = [];
    let activeLoads = 0;

    for (const category of sortedCategories) {
      if (activeLoads >= this.config.maxConcurrentLoads) {
        await Promise.race(loadPromises);
        activeLoads--;
      }

      const loadPromise = this.loadCategory(category).then(result => {
        results.set(category, result);
        activeLoads--;
      });

      loadPromises.push(loadPromise);
      activeLoads++;
    }

    // Wait for all loads to complete
    await Promise.all(loadPromises);

    return results;
  }

  /**
   * Preloads priority categories
   */
  async preloadPriorityCategories(): Promise<void> {
    if (!this.config.enablePreloading) return;

    const priorityCategories = this.config.priorityCategories;
    console.log(`Preloading ${priorityCategories.length} priority categories`);

    const preloadPromises = priorityCategories.map(async (category) => {
      try {
        await this.loadCategory(category);
      } catch (error) {
        console.warn(`Failed to preload category ${category}:`, error);
      }
    });

    await Promise.allSettled(preloadPromises);
  }

  /**
   * Preloads categories based on strategy
   */
  async preloadWithStrategy(
    categories: WebsiteCategory[],
    strategy: PreloadStrategy
  ): Promise<void> {
    switch (strategy.type) {
      case 'immediate':
        await this.loadCategories(categories);
        break;

      case 'idle':
        this.scheduleIdlePreload(categories, strategy.delay || 0);
        break;

      case 'priority':
        const priorityCategories = categories.filter(cat => 
          this.config.priorityCategories.includes(cat)
        );
        await this.loadCategories(priorityCategories);
        break;

      case 'interaction':
        // Preload on next user interaction
        this.scheduleInteractionPreload(categories);
        break;

      default:
        console.warn(`Unknown preload strategy: ${strategy.type}`);
    }
  }

  /**
   * Gets loading status for all categories
   */
  getLoadingStatus(): Map<string, { isLoaded: boolean; isLoading: boolean; error?: string }> {
    const status = new Map();

    for (const [id, item] of this.loadableCategories) {
      status.set(id, {
        isLoaded: item.isLoaded,
        isLoading: item.isLoading,
        error: item.error
      });
    }

    return status;
  }

  /**
   * Clears loaded data to free memory
   */
  clearLoadedData(categories?: WebsiteCategory[]): void {
    const categoriesToClear = categories || Array.from(this.loadableCategories.keys());

    for (const categoryId of categoriesToClear) {
      const item = this.loadableCategories.get(categoryId);
      if (item && item.isLoaded) {
        item.data = undefined;
        item.isLoaded = false;
        item.error = undefined;
      }
    }

    console.log(`Cleared loaded data for ${categoriesToClear.length} categories`);
  }

  /**
   * Performs the actual loading of an item
   */
  private async performLoad<T>(item: LoadableItem<T>): Promise<LazyLoadResult<T>> {
    if (item.isLoading) {
      // Wait for existing load to complete
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!item.isLoading) {
            clearInterval(checkInterval);
            resolve({
              success: item.isLoaded && !item.error,
              data: item.data,
              error: item.error,
              fromCache: false,
              loadTime: item.loadTime || 0
            });
          }
        }, 10);
      });
    }

    item.isLoading = true;
    const startTime = performance.now();
    let operationId = '';

    if (this.performanceMonitor) {
      operationId = this.performanceMonitor.startOperation(`lazy-load-${item.category}`, {
        itemId: item.id,
        category: item.category
      });
    }

    try {
      const data = await item.loader();
      const loadTime = performance.now() - startTime;

      item.data = data;
      item.isLoaded = true;
      item.isLoading = false;
      item.loadTime = loadTime;
      item.error = undefined;

      // Cache the loaded data
      if (this.cacheService && this.config.cachePreloadedItems) {
        const cacheKey = `suggestions-${item.category}`;
        await this.cacheService.cacheSuggestions(cacheKey, data);
      }

      if (this.performanceMonitor) {
        this.performanceMonitor.endOperation(operationId, true);
      }

      console.log(`Loaded category ${item.category} in ${loadTime.toFixed(2)}ms`);

      return {
        success: true,
        data,
        fromCache: false,
        loadTime
      };

    } catch (error) {
      const loadTime = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      item.isLoading = false;
      item.error = errorMessage;
      item.loadTime = loadTime;

      if (this.performanceMonitor) {
        this.performanceMonitor.endOperation(operationId, false, errorMessage);
      }

      console.error(`Failed to load category ${item.category}:`, error);

      return {
        success: false,
        error: errorMessage,
        fromCache: false,
        loadTime
      };
    }
  }

  /**
   * Schedules idle preloading
   */
  private scheduleIdlePreload(categories: WebsiteCategory[], delay: number): void {
    const preload = () => {
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => {
          this.loadCategories(categories);
        });
      } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(() => {
          this.loadCategories(categories);
        }, delay);
      }
    };

    if (delay > 0) {
      setTimeout(preload, delay);
    } else {
      preload();
    }
  }

  /**
   * Schedules interaction-based preloading
   */
  private scheduleInteractionPreload(categories: WebsiteCategory[]): void {
    const events = ['click', 'keydown', 'scroll', 'mousemove'];
    let hasPreloaded = false;

    const preloadOnce = () => {
      if (hasPreloaded) return;
      hasPreloaded = true;

      // Remove event listeners
      events.forEach(event => {
        document.removeEventListener(event, preloadOnce, { passive: true });
      });

      // Preload categories
      this.loadCategories(categories);
    };

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, preloadOnce, { passive: true });
    });
  }

  /**
   * Initializes intersection observer for viewport-based preloading
   */
  private initializeIntersectionObserver(): void {
    if (!('IntersectionObserver' in window)) return;

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const categoryId = entry.target.getAttribute('data-category-id');
            if (categoryId) {
              const item = this.loadableCategories.get(categoryId);
              if (item && !item.isLoaded && !item.isLoading) {
                this.performLoad(item);
              }
            }
          }
        }
      },
      {
        rootMargin: `${this.config.preloadThreshold}px`
      }
    );
  }

  /**
   * Observes an element for viewport-based preloading
   */
  observeElement(element: Element, categoryId: string): void {
    if (this.intersectionObserver) {
      element.setAttribute('data-category-id', categoryId);
      this.intersectionObserver.observe(element);
    }
  }

  /**
   * Stops observing an element
   */
  unobserveElement(element: Element): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.unobserve(element);
    }
  }

  /**
   * Destroys the lazy loader
   */
  destroy(): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = undefined;
    }

    this.loadableCategories.clear();
    this.loadingQueue = [];
    this.activeLoads.clear();
  }
}

// ============================================================================
// COMPONENT LAZY LOADER
// ============================================================================

export class ComponentLazyLoader {
  private loadedComponents = new Map<string, any>();
  private loadingPromises = new Map<string, Promise<any>>();
  private cacheService?: CacheService;

  constructor(cacheService?: CacheService) {
    this.cacheService = cacheService;
  }

  /**
   * Loads a component lazily
   */
  async loadComponent<T = any>(
    name: string,
    loader: () => Promise<T>
  ): Promise<T> {
    // Return cached component if already loaded
    if (this.loadedComponents.has(name)) {
      return this.loadedComponents.get(name);
    }

    // Return existing loading promise if already loading
    if (this.loadingPromises.has(name)) {
      return this.loadingPromises.get(name);
    }

    // Start loading
    const loadingPromise = this.performComponentLoad(name, loader);
    this.loadingPromises.set(name, loadingPromise);

    try {
      const component = await loadingPromise;
      this.loadedComponents.set(name, component);
      this.loadingPromises.delete(name);
      return component;
    } catch (error) {
      this.loadingPromises.delete(name);
      throw error;
    }
  }

  /**
   * Preloads multiple components
   */
  async preloadComponents(
    components: Array<{ name: string; loader: () => Promise<any> }>
  ): Promise<void> {
    const loadPromises = components.map(({ name, loader }) =>
      this.loadComponent(name, loader).catch(error => {
        console.warn(`Failed to preload component ${name}:`, error);
      })
    );

    await Promise.allSettled(loadPromises);
  }

  /**
   * Performs the actual component loading
   */
  private async performComponentLoad<T>(
    name: string,
    loader: () => Promise<T>
  ): Promise<T> {
    try {
      console.log(`Loading component: ${name}`);
      const component = await loader();
      console.log(`Component loaded: ${name}`);
      return component;
    } catch (error) {
      console.error(`Failed to load component ${name}:`, error);
      throw error;
    }
  }

  /**
   * Clears loaded components to free memory
   */
  clearComponents(names?: string[]): void {
    if (names) {
      names.forEach(name => this.loadedComponents.delete(name));
    } else {
      this.loadedComponents.clear();
    }
  }

  /**
   * Gets loading status
   */
  getLoadingStatus(): Map<string, { isLoaded: boolean; isLoading: boolean }> {
    const status = new Map();

    // Add loaded components
    for (const name of this.loadedComponents.keys()) {
      status.set(name, { isLoaded: true, isLoading: false });
    }

    // Add loading components
    for (const name of this.loadingPromises.keys()) {
      if (!status.has(name)) {
        status.set(name, { isLoaded: false, isLoading: true });
      }
    }

    return status;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Creates a suggestion category loader
 */
export function createSuggestionCategoryLoader(
  config?: Partial<LazyLoadConfig>
): SuggestionCategoryLoader {
  return new SuggestionCategoryLoader(config);
}

/**
 * Creates a component lazy loader
 */
export function createComponentLazyLoader(
  cacheService?: CacheService
): ComponentLazyLoader {
  return new ComponentLazyLoader(cacheService);
}

/**
 * Default lazy loading configurations
 */
export const LAZY_LOAD_CONFIGS = {
  AGGRESSIVE: {
    enablePreloading: true,
    preloadThreshold: 500,
    maxConcurrentLoads: 5,
    cachePreloadedItems: true,
    priorityCategories: [
      WebsiteCategory.SOCIAL_MEDIA,
      WebsiteCategory.PRODUCTIVITY,
      WebsiteCategory.ECOMMERCE,
      WebsiteCategory.PROFESSIONAL
    ]
  },
  CONSERVATIVE: {
    enablePreloading: false,
    preloadThreshold: 100,
    maxConcurrentLoads: 2,
    cachePreloadedItems: true,
    priorityCategories: [
      WebsiteCategory.PRODUCTIVITY
    ]
  },
  BALANCED: {
    enablePreloading: true,
    preloadThreshold: 200,
    maxConcurrentLoads: 3,
    cachePreloadedItems: true,
    priorityCategories: [
      WebsiteCategory.SOCIAL_MEDIA,
      WebsiteCategory.PRODUCTIVITY,
      WebsiteCategory.ECOMMERCE
    ]
  }
} as const;