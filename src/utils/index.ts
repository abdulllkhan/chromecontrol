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
}

// ============================================================================
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

// ============================================================================
// STRING UTILITIES
// ============================================================================

export function sanitizeHTML(html: string): string {
  // Remove script tags and dangerous attributes
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '');
}

export function truncateText(text: string, maxLength: number, suffix: string = '...'): string {
  if (text.length <= maxLength) {
    return text;
  }
  if (maxLength <= 0) {
    return suffix;
  }
  // Trim the text to avoid trailing spaces before suffix
  return text.substring(0, maxLength).trim() + suffix;
}

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim();
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

export function validateURL(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

export function validateEmail(email: string): boolean {
  // More flexible email regex that allows localhost and single-word domains
  const emailRegex = /^[^\s@]+@[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

export function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================================
// OBJECT UTILITIES
// ============================================================================

export function mergeObjects<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      const sourceValue = source[key];
      const targetValue = result[key];
      
      if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue) &&
          targetValue && typeof targetValue === 'object' && !Array.isArray(targetValue)) {
        result[key] = mergeObjects(targetValue, sourceValue);
      } else {
        result[key] = sourceValue as T[Extract<keyof T, string>];
      }
    }
  }
  
  return result;
}

// ============================================================================
// TEMPLATE UTILITIES
// ============================================================================

export function parseTemplateVariables(template: string): string[] {
  const matches = template.match(/\{\{([^}]+)\}\}/g);
  if (!matches) return [];
  
  return [...new Set(matches.map(match => match.slice(2, -2).trim()))];
}

export function replaceTemplateVariables(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const trimmedKey = key.trim();
    return variables[trimmedKey] !== undefined ? variables[trimmedKey] : match;
  });
}

// ============================================================================
// FORMATTING UTILITIES
// ============================================================================

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  const value = (bytes / Math.pow(k, i)).toFixed(1);
  return value + ' ' + sizes[i];
}

export function formatTimestamp(date: Date, format: 'short' | 'long' | 'time' | 'relative'): string {
  switch (format) {
    case 'short':
      return date.toLocaleDateString('en-US');
    case 'long':
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    case 'time':
      return date.toLocaleTimeString('en-US', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      });
    case 'relative':
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const minutes = Math.floor(diff / 60000);
      
      if (minutes < 1) return 'just now';
      if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
      
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
      
      const days = Math.floor(hours / 24);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    default:
      return date.toISOString();
  }
}

export function calculateReadingTime(text: string, wordsPerMinute: number = 200): number {
  if (!text || text.trim() === '') return 0;
  
  const words = text.trim().split(/\s+/).length;
  const minutes = Math.ceil(words / wordsPerMinute);
  return Math.max(1, minutes);
}

// ============================================================================
// CRYPTO AND HASHING UTILITIES
// ============================================================================

export function generateHash(input: string): string {
  // Simple hash function for non-cryptographic purposes
  let hash = 0;
  if (input.length === 0) return '0'.repeat(64);
  
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  // Convert to hex and pad to 64 characters
  return Math.abs(hash).toString(16).padStart(64, '0');
}

export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  
  // More accurate estimation: count words and divide by ~0.75 (average tokens per word)
  const words = text.trim().split(/\s+/).length;
  return Math.ceil(words / 0.75);
}

// ============================================================================
// COMPRESSION UTILITIES
// ============================================================================

export async function compressData(data: any): Promise<string> {
  try {
    const jsonString = JSON.stringify(data);
    // Simple base64 encoding as compression placeholder
    return btoa(jsonString);
  } catch (error) {
    throw new Error(`Compression failed: ${error}`);
  }
}

export async function decompressData(compressedData: string): Promise<any> {
  try {
    const jsonString = atob(compressedData);
    return JSON.parse(jsonString);
  } catch (error) {
    throw new Error(`Decompression failed: ${error}`);
  }
}