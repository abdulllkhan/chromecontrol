/**
 * Performance Caching Service
 * 
 * Provides comprehensive caching for AI responses, suggestion generation,
 * and performance monitoring with intelligent cache management.
 */

import {
  AIRequest,
  AIResponse,
  WebsiteContext,
  CachedResponse,
  ValidationUtils
} from '../types/index.js';

// ============================================================================
// CACHE INTERFACES
// ============================================================================

export interface CacheConfig {
  maxSize: number;
  defaultTTL: number; // Time to live in milliseconds
  cleanupInterval: number;
  enableCompression: boolean;
  enableMetrics: boolean;
}

export interface CacheEntry<T = any> {
  key: string;
  data: T;
  timestamp: number;
  expiresAt: number;
  hitCount: number;
  size: number;
  compressed?: boolean;
}

export interface CacheMetrics {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  totalSize: number;
  entryCount: number;
  averageResponseTime: number;
  lastCleanup: number;
}

export interface PerformanceMetrics {
  operationName: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  cacheHit?: boolean;
  dataSize?: number;
}

// ============================================================================
// CACHE STRATEGIES
// ============================================================================

export enum CacheStrategy {
  LRU = 'lru', // Least Recently Used
  LFU = 'lfu', // Least Frequently Used
  TTL = 'ttl', // Time To Live
  FIFO = 'fifo' // First In, First Out
}

export interface CacheKeyOptions {
  includeUserContext?: boolean;
  includeTimestamp?: boolean;
  customSuffix?: string;
  hashLength?: number;
}

// ============================================================================
// MAIN CACHE SERVICE
// ============================================================================

export class CacheService {
  private config: CacheConfig;
  private cache = new Map<string, CacheEntry>();
  private metrics: CacheMetrics;
  private performanceLog: PerformanceMetrics[] = [];
  private cleanupTimer: NodeJS.Timeout | null = null;
  private strategy: CacheStrategy;

  constructor(
    config: Partial<CacheConfig> = {},
    strategy: CacheStrategy = CacheStrategy.LRU
  ) {
    this.config = {
      maxSize: 50 * 1024 * 1024, // 50MB default
      defaultTTL: 1000 * 60 * 30, // 30 minutes
      cleanupInterval: 1000 * 60 * 5, // 5 minutes
      enableCompression: true,
      enableMetrics: true,
      ...config
    };

    this.strategy = strategy;
    this.metrics = this.initializeMetrics();
    this.startCleanupTimer();
  }

  /**
   * Initialize cache metrics
   */
  private initializeMetrics(): CacheMetrics {
    return {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      hitRate: 0,
      totalSize: 0,
      entryCount: 0,
      averageResponseTime: 0,
      lastCleanup: Date.now()
    };
  }

  /**
   * Generates a cache key for AI requests
   */
  generateAIRequestKey(
    request: AIRequest,
    options: CacheKeyOptions = {}
  ): string {
    const keyData = {
      prompt: request.prompt,
      taskType: request.taskType,
      outputFormat: request.outputFormat,
      domain: request.context.domain,
      category: request.context.category,
      pageType: request.context.pageType
    };

    // Add user context if requested
    if (options.includeUserContext && request.userInput) {
      (keyData as any).userInput = request.userInput;
    }

    // Add timestamp bucket for time-sensitive caching
    if (options.includeTimestamp) {
      const timeBucket = Math.floor(Date.now() / (1000 * 60 * 5)); // 5-minute buckets
      (keyData as any).timeBucket = timeBucket;
    }

    // Add custom suffix
    if (options.customSuffix) {
      (keyData as any).suffix = options.customSuffix;
    }

    const keyString = JSON.stringify(keyData);
    return this.hashString(keyString, options.hashLength || 16);
  }

  /**
   * Generates a cache key for website context
   */
  generateContextKey(context: WebsiteContext, suffix?: string): string {
    const keyData = {
      domain: context.domain,
      category: context.category,
      pageType: context.pageType,
      securityLevel: context.securityLevel,
      suffix: suffix || ''
    };

    const keyString = JSON.stringify(keyData);
    return this.hashString(keyString, 12);
  }

  /**
   * Caches an AI response
   */
  async cacheAIResponse(
    key: string,
    response: AIResponse,
    ttl?: number
  ): Promise<boolean> {
    const startTime = performance.now();

    try {
      const entry = await this.createCacheEntry(key, response, ttl);
      
      // Check if we need to make space
      if (this.needsEviction(entry.size)) {
        await this.evictEntries(entry.size);
      }

      this.cache.set(key, entry);
      this.updateMetricsOnSet(entry);

      this.recordPerformance('cacheAIResponse', startTime, true, entry.size);
      return true;

    } catch (error) {
      console.error('Failed to cache AI response:', error);
      this.recordPerformance('cacheAIResponse', startTime, false);
      return false;
    }
  }

  /**
   * Retrieves a cached AI response
   */
  async getCachedAIResponse(key: string): Promise<AIResponse | null> {
    const startTime = performance.now();
    this.metrics.totalRequests++;

    try {
      const entry = this.cache.get(key);

      if (!entry) {
        this.metrics.cacheMisses++;
        this.recordPerformance('getCachedAIResponse', startTime, false, 0, false);
        return null;
      }

      // Check if expired
      if (Date.now() > entry.expiresAt) {
        this.cache.delete(key);
        this.metrics.cacheMisses++;
        this.recordPerformance('getCachedAIResponse', startTime, false, 0, false);
        return null;
      }

      // Update access metrics
      entry.hitCount++;
      entry.timestamp = Date.now(); // Update for LRU

      this.metrics.cacheHits++;
      this.updateHitRate();

      const data = await this.extractCacheData<AIResponse>(entry);
      this.recordPerformance('getCachedAIResponse', startTime, true, entry.size, true);

      return data;

    } catch (error) {
      console.error('Failed to get cached AI response:', error);
      this.metrics.cacheMisses++;
      this.recordPerformance('getCachedAIResponse', startTime, false, 0, false);
      return null;
    }
  }

  /**
   * Caches suggestion data
   */
  async cacheSuggestions(
    key: string,
    suggestions: any[],
    ttl?: number
  ): Promise<boolean> {
    const startTime = performance.now();

    try {
      const entry = await this.createCacheEntry(key, suggestions, ttl);
      
      if (this.needsEviction(entry.size)) {
        await this.evictEntries(entry.size);
      }

      this.cache.set(key, entry);
      this.updateMetricsOnSet(entry);

      this.recordPerformance('cacheSuggestions', startTime, true, entry.size);
      return true;

    } catch (error) {
      console.error('Failed to cache suggestions:', error);
      this.recordPerformance('cacheSuggestions', startTime, false);
      return false;
    }
  }

  /**
   * Retrieves cached suggestions
   */
  async getCachedSuggestions<T = any>(key: string): Promise<T[] | null> {
    const startTime = performance.now();
    this.metrics.totalRequests++;

    try {
      const entry = this.cache.get(key);

      if (!entry || Date.now() > entry.expiresAt) {
        if (entry) this.cache.delete(key);
        this.metrics.cacheMisses++;
        this.recordPerformance('getCachedSuggestions', startTime, false, 0, false);
        return null;
      }

      entry.hitCount++;
      entry.timestamp = Date.now();

      this.metrics.cacheHits++;
      this.updateHitRate();

      const data = await this.extractCacheData<T[]>(entry);
      this.recordPerformance('getCachedSuggestions', startTime, true, entry.size, true);

      return data;

    } catch (error) {
      console.error('Failed to get cached suggestions:', error);
      this.metrics.cacheMisses++;
      this.recordPerformance('getCachedSuggestions', startTime, false, 0, false);
      return null;
    }
  }

  /**
   * Caches website analysis data
   */
  async cacheWebsiteAnalysis(
    key: string,
    analysis: any,
    ttl?: number
  ): Promise<boolean> {
    const startTime = performance.now();

    try {
      const entry = await this.createCacheEntry(key, analysis, ttl || 1000 * 60 * 60); // 1 hour default
      
      if (this.needsEviction(entry.size)) {
        await this.evictEntries(entry.size);
      }

      this.cache.set(key, entry);
      this.updateMetricsOnSet(entry);

      this.recordPerformance('cacheWebsiteAnalysis', startTime, true, entry.size);
      return true;

    } catch (error) {
      console.error('Failed to cache website analysis:', error);
      this.recordPerformance('cacheWebsiteAnalysis', startTime, false);
      return false;
    }
  }

  /**
   * Retrieves cached website analysis
   */
  async getCachedWebsiteAnalysis<T = any>(key: string): Promise<T | null> {
    const startTime = performance.now();
    this.metrics.totalRequests++;

    try {
      const entry = this.cache.get(key);

      if (!entry || Date.now() > entry.expiresAt) {
        if (entry) this.cache.delete(key);
        this.metrics.cacheMisses++;
        this.recordPerformance('getCachedWebsiteAnalysis', startTime, false, 0, false);
        return null;
      }

      entry.hitCount++;
      entry.timestamp = Date.now();

      this.metrics.cacheHits++;
      this.updateHitRate();

      const data = await this.extractCacheData<T>(entry);
      this.recordPerformance('getCachedWebsiteAnalysis', startTime, true, entry.size, true);

      return data;

    } catch (error) {
      console.error('Failed to get cached website analysis:', error);
      this.metrics.cacheMisses++;
      this.recordPerformance('getCachedWebsiteAnalysis', startTime, false, 0, false);
      return null;
    }
  }

  /**
   * Invalidates cache entries by pattern
   */
  invalidateByPattern(pattern: string): number {
    const regex = new RegExp(pattern);
    let invalidated = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        this.metrics.totalSize -= entry.size;
        this.metrics.entryCount--;
        invalidated++;
      }
    }

    console.log(`Invalidated ${invalidated} cache entries matching pattern: ${pattern}`);
    return invalidated;
  }

  /**
   * Invalidates cache entries for a specific domain
   */
  invalidateDomain(domain: string): number {
    return this.invalidateByPattern(`"domain":"${domain}"`);
  }

  /**
   * Preloads cache with common data
   */
  async preloadCache(preloadData: Array<{
    key: string;
    data: any;
    ttl?: number;
  }>): Promise<number> {
    let loaded = 0;

    for (const item of preloadData) {
      try {
        const success = await this.cacheGeneric(item.key, item.data, item.ttl);
        if (success) loaded++;
      } catch (error) {
        console.warn(`Failed to preload cache item ${item.key}:`, error);
      }
    }

    console.log(`Preloaded ${loaded}/${preloadData.length} cache entries`);
    return loaded;
  }

  /**
   * Generic cache method
   */
  private async cacheGeneric(
    key: string,
    data: any,
    ttl?: number
  ): Promise<boolean> {
    try {
      const entry = await this.createCacheEntry(key, data, ttl);
      
      if (this.needsEviction(entry.size)) {
        await this.evictEntries(entry.size);
      }

      this.cache.set(key, entry);
      this.updateMetricsOnSet(entry);

      return true;
    } catch (error) {
      console.error('Failed to cache data:', error);
      return false;
    }
  }

  /**
   * Creates a cache entry with optional compression
   */
  private async createCacheEntry<T>(
    key: string,
    data: T,
    ttl?: number
  ): Promise<CacheEntry<T>> {
    const now = Date.now();
    const expiresAt = now + (ttl || this.config.defaultTTL);
    
    let processedData = data;
    let size = this.estimateSize(data);
    let compressed = false;

    // Compress large data if enabled
    if (this.config.enableCompression && size > 1024) {
      try {
        const serialized = JSON.stringify(data);
        const compressed_data = await this.compressString(serialized);
        
        if (compressed_data.length < serialized.length * 0.8) {
          processedData = compressed_data as any;
          size = compressed_data.length;
          compressed = true;
        }
      } catch (error) {
        console.warn('Compression failed, storing uncompressed:', error);
      }
    }

    return {
      key,
      data: processedData,
      timestamp: now,
      expiresAt,
      hitCount: 0,
      size,
      compressed
    };
  }

  /**
   * Extracts data from cache entry with decompression if needed
   */
  private async extractCacheData<T>(entry: CacheEntry): Promise<T> {
    if (entry.compressed) {
      try {
        const decompressed = await this.decompressString(entry.data as string);
        return JSON.parse(decompressed);
      } catch (error) {
        console.error('Decompression failed:', error);
        throw error;
      }
    }

    return entry.data as T;
  }

  /**
   * Checks if cache needs eviction
   */
  private needsEviction(newEntrySize: number): boolean {
    return this.metrics.totalSize + newEntrySize > this.config.maxSize;
  }

  /**
   * Evicts cache entries based on strategy
   */
  private async evictEntries(spaceNeeded: number): Promise<void> {
    const entries = Array.from(this.cache.entries());
    let freedSpace = 0;

    // Sort entries based on eviction strategy
    entries.sort(([, a], [, b]) => {
      switch (this.strategy) {
        case CacheStrategy.LRU:
          return a.timestamp - b.timestamp; // Oldest first
        case CacheStrategy.LFU:
          return a.hitCount - b.hitCount; // Least used first
        case CacheStrategy.TTL:
          return a.expiresAt - b.expiresAt; // Expires soonest first
        case CacheStrategy.FIFO:
        default:
          return a.timestamp - b.timestamp; // Oldest first
      }
    });

    // Remove entries until we have enough space
    for (const [key, entry] of entries) {
      if (freedSpace >= spaceNeeded) break;

      this.cache.delete(key);
      freedSpace += entry.size;
      this.metrics.totalSize -= entry.size;
      this.metrics.entryCount--;
    }

    console.log(`Evicted entries, freed ${freedSpace} bytes`);
  }

  /**
   * Updates metrics when setting cache entry
   */
  private updateMetricsOnSet(entry: CacheEntry): void {
    this.metrics.totalSize += entry.size;
    this.metrics.entryCount++;
  }

  /**
   * Updates hit rate metric
   */
  private updateHitRate(): void {
    this.metrics.hitRate = this.metrics.totalRequests > 0 
      ? (this.metrics.cacheHits / this.metrics.totalRequests) * 100 
      : 0;
  }

  /**
   * Records performance metrics
   */
  private recordPerformance(
    operationName: string,
    startTime: number,
    success: boolean,
    dataSize?: number,
    cacheHit?: boolean
  ): void {
    if (!this.config.enableMetrics) return;

    const endTime = performance.now();
    const metric: PerformanceMetrics = {
      operationName,
      startTime,
      endTime,
      duration: endTime - startTime,
      success,
      cacheHit,
      dataSize
    };

    this.performanceLog.push(metric);

    // Keep only last 1000 entries
    if (this.performanceLog.length > 1000) {
      this.performanceLog = this.performanceLog.slice(-1000);
    }

    // Update average response time
    const successfulOps = this.performanceLog.filter(m => m.success);
    if (successfulOps.length > 0) {
      this.metrics.averageResponseTime = 
        successfulOps.reduce((sum, m) => sum + m.duration, 0) / successfulOps.length;
    }
  }

  /**
   * Starts the cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Performs cache cleanup
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        this.metrics.totalSize -= entry.size;
        this.metrics.entryCount--;
        cleaned++;
      }
    }

    this.metrics.lastCleanup = now;

    if (cleaned > 0) {
      console.log(`Cache cleanup: removed ${cleaned} expired entries`);
    }
  }

  /**
   * Gets current cache metrics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Gets performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics[] {
    return [...this.performanceLog];
  }

  /**
   * Clears all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.metrics = this.initializeMetrics();
    this.performanceLog = [];
    console.log('Cache cleared');
  }

  /**
   * Destroys the cache service
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Estimates the size of data in bytes
   */
  private estimateSize(data: any): number {
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch {
      // Fallback estimation
      const str = JSON.stringify(data);
      return str.length * 2; // Rough estimate for UTF-16
    }
  }

  /**
   * Simple string hashing function
   */
  private hashString(str: string, length: number = 16): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36).padStart(length, '0').slice(0, length);
  }

  /**
   * Compresses a string using built-in compression
   */
  private async compressString(str: string): Promise<string> {
    // Simple compression using btoa/atob for now
    // In a real implementation, you might use a proper compression library
    try {
      return btoa(str);
    } catch {
      return str; // Fallback to original string
    }
  }

  /**
   * Decompresses a string
   */
  private async decompressString(compressed: string): Promise<string> {
    try {
      return atob(compressed);
    } catch {
      throw new Error('Decompression failed');
    }
  }
}

// ============================================================================
// CACHE FACTORY
// ============================================================================

/**
 * Creates a cache service instance with default configuration
 */
export function createCacheService(
  config?: Partial<CacheConfig>,
  strategy?: CacheStrategy
): CacheService {
  return new CacheService(config, strategy);
}

/**
 * Default cache configurations for different use cases
 */
export const CACHE_CONFIGS = {
  AI_RESPONSES: {
    maxSize: 20 * 1024 * 1024, // 20MB
    defaultTTL: 1000 * 60 * 30, // 30 minutes
    cleanupInterval: 1000 * 60 * 5, // 5 minutes
    enableCompression: true,
    enableMetrics: true
  },
  SUGGESTIONS: {
    maxSize: 10 * 1024 * 1024, // 10MB
    defaultTTL: 1000 * 60 * 15, // 15 minutes
    cleanupInterval: 1000 * 60 * 3, // 3 minutes
    enableCompression: false,
    enableMetrics: true
  },
  WEBSITE_ANALYSIS: {
    maxSize: 5 * 1024 * 1024, // 5MB
    defaultTTL: 1000 * 60 * 60, // 1 hour
    cleanupInterval: 1000 * 60 * 10, // 10 minutes
    enableCompression: true,
    enableMetrics: true
  }
} as const;