/**
 * Utility Functions Tests
 * 
 * Tests for utility functions and helper methods used throughout the extension.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  debounce,
  throttle,
  sanitizeHTML,
  validateURL,
  extractDomain,
  generateHash,
  formatFileSize,
  isValidRegex,
  escapeRegex,
  deepClone,
  mergeObjects,
  formatTimestamp,
  calculateReadingTime,
  truncateText,
  generateSlug,
  validateEmail,
  parseTemplateVariables,
  replaceTemplateVariables,
  estimateTokenCount,
  compressData,
  decompressData
} from '../index';

describe('Utility Functions', () => {
  describe('Timing Utilities', () => {
    describe('debounce', () => {
      it('should delay function execution', async () => {
        const mockFn = vi.fn();
        const debouncedFn = debounce(mockFn, 100);

        debouncedFn('test1');
        debouncedFn('test2');
        debouncedFn('test3');

        expect(mockFn).not.toHaveBeenCalled();

        await new Promise(resolve => setTimeout(resolve, 150));

        expect(mockFn).toHaveBeenCalledTimes(1);
        expect(mockFn).toHaveBeenCalledWith('test3');
      });

      it('should cancel previous calls', async () => {
        const mockFn = vi.fn();
        const debouncedFn = debounce(mockFn, 100);

        debouncedFn('first');
        await new Promise(resolve => setTimeout(resolve, 50));
        debouncedFn('second');
        await new Promise(resolve => setTimeout(resolve, 150));

        expect(mockFn).toHaveBeenCalledTimes(1);
        expect(mockFn).toHaveBeenCalledWith('second');
      });
    });

    describe('throttle', () => {
      it('should limit function execution rate', async () => {
        const mockFn = vi.fn();
        const throttledFn = throttle(mockFn, 100);

        throttledFn('call1');
        throttledFn('call2');
        throttledFn('call3');

        expect(mockFn).toHaveBeenCalledTimes(1);
        expect(mockFn).toHaveBeenCalledWith('call1');

        await new Promise(resolve => setTimeout(resolve, 150));

        throttledFn('call4');
        expect(mockFn).toHaveBeenCalledTimes(2);
        expect(mockFn).toHaveBeenCalledWith('call4');
      });

      it('should execute immediately on first call', () => {
        const mockFn = vi.fn();
        const throttledFn = throttle(mockFn, 100);

        throttledFn('immediate');

        expect(mockFn).toHaveBeenCalledTimes(1);
        expect(mockFn).toHaveBeenCalledWith('immediate');
      });
    });
  });

  describe('String Utilities', () => {
    describe('sanitizeHTML', () => {
      it('should remove script tags', () => {
        const input = '<div>Safe content</div><script>alert("xss")</script>';
        const result = sanitizeHTML(input);

        expect(result).toBe('<div>Safe content</div>');
        expect(result).not.toContain('<script>');
      });

      it('should remove dangerous attributes', () => {
        const input = '<div onclick="alert(1)" onload="evil()">Content</div>';
        const result = sanitizeHTML(input);

        expect(result).toBe('<div>Content</div>');
        expect(result).not.toContain('onclick');
        expect(result).not.toContain('onload');
      });

      it('should preserve safe HTML', () => {
        const input = '<div class="safe"><p><strong>Bold</strong> and <em>italic</em></p></div>';
        const result = sanitizeHTML(input);

        expect(result).toContain('<div class="safe">');
        expect(result).toContain('<strong>Bold</strong>');
        expect(result).toContain('<em>italic</em>');
      });

      it('should handle malformed HTML', () => {
        const input = '<div><p>Unclosed paragraph<div>Nested</div>';
        const result = sanitizeHTML(input);

        expect(result).toBeDefined();
        expect(result).not.toContain('<script>');
      });
    });

    describe('truncateText', () => {
      it('should truncate long text', () => {
        const text = 'This is a very long text that should be truncated';
        const result = truncateText(text, 20);

        expect(result).toBe('This is a very long...');
        expect(result.length).toBeLessThanOrEqual(23); // 20 + '...'
      });

      it('should not truncate short text', () => {
        const text = 'Short text';
        const result = truncateText(text, 20);

        expect(result).toBe('Short text');
      });

      it('should handle custom suffix', () => {
        const text = 'Long text that needs truncation';
        const result = truncateText(text, 10, ' [more]');

        expect(result).toBe('Long text [more]');
      });

      it('should handle edge cases', () => {
        expect(truncateText('', 10)).toBe('');
        expect(truncateText('Short', 0)).toBe('...');
        expect(truncateText('Test', 4)).toBe('Test');
      });
    });

    describe('generateSlug', () => {
      it('should create URL-friendly slugs', () => {
        expect(generateSlug('Hello World')).toBe('hello-world');
        expect(generateSlug('Test Task #1')).toBe('test-task-1');
        expect(generateSlug('Special Characters!@#$%')).toBe('special-characters');
      });

      it('should handle unicode characters', () => {
        expect(generateSlug('Café & Restaurant')).toBe('cafe-restaurant');
        expect(generateSlug('Naïve résumé')).toBe('naive-resume');
      });

      it('should handle multiple spaces and dashes', () => {
        expect(generateSlug('Multiple   Spaces')).toBe('multiple-spaces');
        expect(generateSlug('Already-Has-Dashes')).toBe('already-has-dashes');
      });
    });
  });

  describe('URL and Domain Utilities', () => {
    describe('validateURL', () => {
      it('should validate correct URLs', () => {
        expect(validateURL('https://example.com')).toBe(true);
        expect(validateURL('http://test.org/path')).toBe(true);
        expect(validateURL('https://sub.domain.com:8080/path?query=1')).toBe(true);
      });

      it('should reject invalid URLs', () => {
        expect(validateURL('not-a-url')).toBe(false);
        expect(validateURL('ftp://example.com')).toBe(false);
        expect(validateURL('javascript:alert(1)')).toBe(false);
        expect(validateURL('')).toBe(false);
      });

      it('should handle edge cases', () => {
        expect(validateURL('https://')).toBe(false);
        expect(validateURL('https://localhost')).toBe(true);
        expect(validateURL('https://192.168.1.1')).toBe(true);
      });
    });

    describe('extractDomain', () => {
      it('should extract domains from URLs', () => {
        expect(extractDomain('https://example.com/path')).toBe('example.com');
        expect(extractDomain('http://sub.domain.org:8080/test')).toBe('sub.domain.org');
        expect(extractDomain('https://localhost:3000')).toBe('localhost');
      });

      it('should handle invalid URLs', () => {
        expect(extractDomain('not-a-url')).toBe('');
        expect(extractDomain('')).toBe('');
        expect(extractDomain('javascript:void(0)')).toBe('');
      });

      it('should handle special cases', () => {
        expect(extractDomain('https://www.example.com')).toBe('www.example.com');
        expect(extractDomain('https://example.com/')).toBe('example.com');
      });
    });
  });

  describe('Validation Utilities', () => {
    describe('validateEmail', () => {
      it('should validate correct email addresses', () => {
        expect(validateEmail('test@example.com')).toBe(true);
        expect(validateEmail('user.name+tag@domain.co.uk')).toBe(true);
        expect(validateEmail('simple@localhost')).toBe(true);
      });

      it('should reject invalid email addresses', () => {
        expect(validateEmail('invalid-email')).toBe(false);
        expect(validateEmail('@example.com')).toBe(false);
        expect(validateEmail('test@')).toBe(false);
        expect(validateEmail('')).toBe(false);
      });
    });

    describe('isValidRegex', () => {
      it('should validate correct regex patterns', () => {
        expect(isValidRegex('.*')).toBe(true);
        expect(isValidRegex('\\d+')).toBe(true);
        expect(isValidRegex('[a-zA-Z0-9]+')).toBe(true);
      });

      it('should reject invalid regex patterns', () => {
        expect(isValidRegex('[')).toBe(false);
        expect(isValidRegex('*')).toBe(false);
        expect(isValidRegex('(?')).toBe(false);
      });
    });

    describe('escapeRegex', () => {
      it('should escape special regex characters', () => {
        expect(escapeRegex('example.com')).toBe('example\\.com');
        expect(escapeRegex('test[1]')).toBe('test\\[1\\]');
        expect(escapeRegex('(group)*')).toBe('\\(group\\)\\*');
      });

      it('should handle strings without special characters', () => {
        expect(escapeRegex('simple')).toBe('simple');
        expect(escapeRegex('test123')).toBe('test123');
      });
    });
  });

  describe('Object Utilities', () => {
    describe('deepClone', () => {
      it('should create deep copies of objects', () => {
        const original = {
          name: 'test',
          nested: { value: 42, array: [1, 2, 3] },
          date: new Date('2024-01-01')
        };

        const cloned = deepClone(original);

        expect(cloned).toEqual(original);
        expect(cloned).not.toBe(original);
        expect(cloned.nested).not.toBe(original.nested);
        expect(cloned.nested.array).not.toBe(original.nested.array);
      });

      it('should handle arrays', () => {
        const original = [1, { nested: 'value' }, [2, 3]];
        const cloned = deepClone(original);

        expect(cloned).toEqual(original);
        expect(cloned).not.toBe(original);
        expect(cloned[1]).not.toBe(original[1]);
      });

      it('should handle null and undefined', () => {
        expect(deepClone(null)).toBe(null);
        expect(deepClone(undefined)).toBe(undefined);
      });
    });

    describe('mergeObjects', () => {
      it('should merge objects deeply', () => {
        const obj1 = { a: 1, b: { c: 2 } };
        const obj2 = { b: { d: 3 }, e: 4 };

        const result = mergeObjects(obj1, obj2);

        expect(result).toEqual({
          a: 1,
          b: { c: 2, d: 3 },
          e: 4
        });
      });

      it('should handle array merging', () => {
        const obj1 = { arr: [1, 2] };
        const obj2 = { arr: [3, 4] };

        const result = mergeObjects(obj1, obj2);

        expect(result.arr).toEqual([3, 4]); // Should replace, not merge arrays
      });

      it('should not mutate original objects', () => {
        const obj1 = { a: 1, b: { c: 2 } };
        const obj2 = { b: { d: 3 } };

        const result = mergeObjects(obj1, obj2);

        expect(obj1.b).toEqual({ c: 2 });
        expect(obj2.b).toEqual({ d: 3 });
        expect(result.b).toEqual({ c: 2, d: 3 });
      });
    });
  });

  describe('Template Utilities', () => {
    describe('parseTemplateVariables', () => {
      it('should extract template variables', () => {
        const template = 'Hello {{name}}, welcome to {{site}}!';
        const variables = parseTemplateVariables(template);

        expect(variables).toEqual(['name', 'site']);
      });

      it('should handle duplicate variables', () => {
        const template = '{{name}} and {{name}} are friends';
        const variables = parseTemplateVariables(template);

        expect(variables).toEqual(['name']);
      });

      it('should handle nested braces', () => {
        const template = 'Value: {{data.nested.value}}';
        const variables = parseTemplateVariables(template);

        expect(variables).toEqual(['data.nested.value']);
      });
    });

    describe('replaceTemplateVariables', () => {
      it('should replace template variables', () => {
        const template = 'Hello {{name}}, you have {{count}} messages';
        const variables = { name: 'John', count: '5' };

        const result = replaceTemplateVariables(template, variables);

        expect(result).toBe('Hello John, you have 5 messages');
      });

      it('should handle missing variables', () => {
        const template = 'Hello {{name}}, {{missing}} variable';
        const variables = { name: 'John' };

        const result = replaceTemplateVariables(template, variables);

        expect(result).toBe('Hello John, {{missing}} variable');
      });

      it('should handle nested object variables', () => {
        const template = 'User: {{user.name}} ({{user.email}})';
        const variables = { 
          'user.name': 'John Doe',
          'user.email': 'john@example.com'
        };

        const result = replaceTemplateVariables(template, variables);

        expect(result).toBe('User: John Doe (john@example.com)');
      });
    });
  });

  describe('Formatting Utilities', () => {
    describe('formatFileSize', () => {
      it('should format file sizes correctly', () => {
        expect(formatFileSize(0)).toBe('0 B');
        expect(formatFileSize(1024)).toBe('1.0 KB');
        expect(formatFileSize(1048576)).toBe('1.0 MB');
        expect(formatFileSize(1073741824)).toBe('1.0 GB');
      });

      it('should handle decimal places', () => {
        expect(formatFileSize(1536)).toBe('1.5 KB');
        expect(formatFileSize(2621440)).toBe('2.5 MB');
      });

      it('should handle very large sizes', () => {
        expect(formatFileSize(1099511627776)).toBe('1.0 TB');
      });
    });

    describe('formatTimestamp', () => {
      it('should format timestamps correctly', () => {
        const date = new Date('2024-01-15T10:30:00Z');
        
        expect(formatTimestamp(date, 'short')).toMatch(/1\/15\/2024/);
        expect(formatTimestamp(date, 'long')).toContain('January 15, 2024');
        expect(formatTimestamp(date, 'time')).toMatch(/10:30|02:30/);
      });

      it('should handle relative time', () => {
        const now = new Date();
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
        
        const result = formatTimestamp(fiveMinutesAgo, 'relative');
        expect(result).toContain('minute');
      });
    });

    describe('calculateReadingTime', () => {
      it('should calculate reading time for text', () => {
        const shortText = 'This is a short text.';
        const longText = 'word '.repeat(150); // ~150 words

        expect(calculateReadingTime(shortText)).toBe(1);
        expect(calculateReadingTime(longText)).toBe(1); // ~1 minute at 200 WPM
      });

      it('should handle empty text', () => {
        expect(calculateReadingTime('')).toBe(0);
      });

      it('should handle very long text', () => {
        const veryLongText = 'word '.repeat(1000); // ~1000 words
        expect(calculateReadingTime(veryLongText)).toBe(5); // ~5 minutes
      });
    });
  });

  describe('Crypto and Hashing Utilities', () => {
    describe('generateHash', () => {
      it('should generate consistent hashes', () => {
        const input = 'test string';
        const hash1 = generateHash(input);
        const hash2 = generateHash(input);

        expect(hash1).toBe(hash2);
        expect(hash1).toHaveLength(64); // SHA-256 hex length
      });

      it('should generate different hashes for different inputs', () => {
        const hash1 = generateHash('input1');
        const hash2 = generateHash('input2');

        expect(hash1).not.toBe(hash2);
      });

      it('should handle empty strings', () => {
        const hash = generateHash('');
        expect(hash).toHaveLength(64);
      });
    });

    describe('estimateTokenCount', () => {
      it('should estimate token count for text', () => {
        const shortText = 'Hello world';
        const longText = 'This is a longer text with more words and punctuation.';

        expect(estimateTokenCount(shortText)).toBe(3); // 2 words / 0.75 = ~3 tokens
        expect(estimateTokenCount(longText)).toBeGreaterThan(10);
      });

      it('should handle special characters', () => {
        const textWithSpecialChars = 'Hello, world! How are you?';
        const tokenCount = estimateTokenCount(textWithSpecialChars);

        expect(tokenCount).toBeGreaterThan(4);
      });

      it('should handle empty text', () => {
        expect(estimateTokenCount('')).toBe(0);
      });
    });
  });

  describe('Compression Utilities', () => {
    describe('compressData and decompressData', () => {
      it('should compress and decompress data', async () => {
        const originalData = {
          message: 'This is test data that should be compressed',
          numbers: [1, 2, 3, 4, 5],
          nested: { key: 'value' }
        };

        const compressed = await compressData(originalData);
        expect(compressed).toBeDefined();
        expect(typeof compressed).toBe('string');

        const decompressed = await decompressData(compressed);
        expect(decompressed).toEqual(originalData);
      });

      it('should handle large data objects', async () => {
        const largeData = {
          items: Array.from({ length: 100 }, (_, i) => ({
            id: i,
            name: `Item ${i}`,
            description: `Description for item ${i}`.repeat(5)
          }))
        };

        const compressed = await compressData(largeData);
        const decompressed = await decompressData(compressed);

        expect(decompressed).toEqual(largeData);
        // Just verify compression works, not necessarily that it's smaller
        expect(compressed).toBeDefined();
        expect(typeof compressed).toBe('string');
      });

      it('should handle compression errors', async () => {
        // Test with circular reference (should be handled gracefully)
        const circularData: any = { name: 'test' };
        circularData.self = circularData;

        await expect(compressData(circularData)).rejects.toThrow();
      });
    });
  });

  describe('Performance Utilities', () => {
    it('should handle performance measurement', () => {
      const start = performance.now();
      
      // Simulate some work
      for (let i = 0; i < 1000; i++) {
        Math.random();
      }
      
      const end = performance.now();
      const duration = end - start;

      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100); // Should be very fast
    });
  });

  describe('Error Handling Utilities', () => {
    it('should handle function errors gracefully', () => {
      const safeFunction = (fn: () => any, fallback: any) => {
        try {
          return fn();
        } catch {
          return fallback;
        }
      };

      const throwingFunction = () => {
        throw new Error('Test error');
      };

      const result = safeFunction(throwingFunction, 'fallback');
      expect(result).toBe('fallback');

      const successFunction = () => 'success';
      const successResult = safeFunction(successFunction, 'fallback');
      expect(successResult).toBe('success');
    });
  });
});