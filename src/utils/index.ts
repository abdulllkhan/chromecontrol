// Utility functions for the Agentic Chrome Extension
// These will be expanded in later tasks

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function sanitizeString(str: string): string {
  return str.replace(/[<>]/g, '');
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}// ===
=========================================================================
// STORAGE UTILITIES
// ============================================================================

/**
 * Creates a hash from a string for caching purposes
 */
export function createHash(input: string): string {
  let hash = 0;
  if (input.length === 0) return hash.toString();
  
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(36);
}

/**
 * Deep clones an object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item)) as unknown as T;
  }
  
  if (typeof obj === 'object') {
    const cloned = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
  
  return obj;
}

/**
 * Safely parses JSON with error handling
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    console.warn('Failed to parse JSON:', error);
    return fallback;
  }
}

/**
 * Safely stringifies JSON with error handling
 */
export function safeJsonStringify(obj: unknown, fallback: string = '{}'): string {
  try {
    return JSON.stringify(obj);
  } catch (error) {
    console.warn('Failed to stringify JSON:', error);
    return fallback;
  }
}

/**
 * Checks if a value is a valid Date object
 */
export function isValidDate(date: unknown): date is Date {
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Converts various date formats to Date object
 */
export function parseDate(dateInput: string | number | Date): Date {
  if (dateInput instanceof Date) {
    return dateInput;
  }
  
  const parsed = new Date(dateInput);
  if (isValidDate(parsed)) {
    return parsed;
  }
  
  throw new Error(`Invalid date input: ${dateInput}`);
}

/**
 * Generates a UUID v4
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Validates and sanitizes domain names
 */
export function sanitizeDomain(domain: string): string {
  return domain
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .trim();
}

/**
 * Checks if two objects are deeply equal
 */
export function deepEqual(obj1: unknown, obj2: unknown): boolean {
  if (obj1 === obj2) {
    return true;
  }
  
  if (obj1 == null || obj2 == null) {
    return obj1 === obj2;
  }
  
  if (typeof obj1 !== typeof obj2) {
    return false;
  }
  
  if (typeof obj1 !== 'object') {
    return obj1 === obj2;
  }
  
  if (Array.isArray(obj1) !== Array.isArray(obj2)) {
    return false;
  }
  
  const keys1 = Object.keys(obj1 as object);
  const keys2 = Object.keys(obj2 as object);
  
  if (keys1.length !== keys2.length) {
    return false;
  }
  
  for (const key of keys1) {
    if (!keys2.includes(key)) {
      return false;
    }
    
    if (!deepEqual((obj1 as any)[key], (obj2 as any)[key])) {
      return false;
    }
  }
  
  return true;
}

/**
 * Throttles function execution
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Retries an async function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

// ============================================================================
// PATTERN ENGINE UTILITIES
// ============================================================================

// Re-export pattern engine components for easy access
export {
  PatternEngine,
  UrlAnalyzer,
  WebsiteCategorizer,
  ContentExtractor,
  CustomPatternMatcher
} from '../services/patternEngine.js';