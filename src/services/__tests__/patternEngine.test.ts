/**
 * Tests for Website Pattern Recognition Engine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PatternEngine,
  UrlAnalyzer,
  WebsiteCategorizer,
  ContentExtractor,
  CustomPatternMatcher
} from '../patternEngine.js';
import {
  WebsiteCategory,
  PageType,
  SecurityLevel,
  CustomPattern
} from '../../types/index.js';

// ============================================================================
// URL ANALYZER TESTS
// ============================================================================

describe('UrlAnalyzer', () => {
  describe('extractDomain', () => {
    it('should extract domain from standard URLs', () => {
      expect(UrlAnalyzer.extractDomain('https://www.example.com/path')).toBe('example.com');
      expect(UrlAnalyzer.extractDomain('http://subdomain.example.com')).toBe('subdomain.example.com');
      expect(UrlAnalyzer.extractDomain('https://example.org/page?param=value')).toBe('example.org');
    });

    it('should handle URLs without protocol', () => {
      expect(UrlAnalyzer.extractDomain('www.example.com/path')).toBe('example.com');
      expect(UrlAnalyzer.extractDomain('example.com')).toBe('example.com');
    });

    it('should handle malformed URLs gracefully', () => {
      expect(UrlAnalyzer.extractDomain('not-a-url')).toBe('not-a-url');
      expect(UrlAnalyzer.extractDomain('')).toBe('');
    });
  });

  describe('extractPathSegments', () => {
    it('should extract path segments correctly', () => {
      expect(UrlAnalyzer.extractPathSegments('https://example.com/path/to/page')).toEqual(['path', 'to', 'page']);
      expect(UrlAnalyzer.extractPathSegments('https://example.com/')).toEqual([]);
      expect(UrlAnalyzer.extractPathSegments('https://example.com/single')).toEqual(['single']);
    });

    it('should handle URLs without paths', () => {
      expect(UrlAnalyzer.extractPathSegments('https://example.com')).toEqual([]);
    });

    it('should handle malformed URLs', () => {
      expect(UrlAnalyzer.extractPathSegments('not-a-url')).toEqual([]);
    });
  });

  describe('extractQueryParams', () => {
    it('should extract query parameters correctly', () => {
      const params = UrlAnalyzer.extractQueryParams('https://example.com?param1=value1&param2=value2');
      expect(params).toEqual({ param1: 'value1', param2: 'value2' });
    });

    it('should handle URLs without query parameters', () => {
      expect(UrlAnalyzer.extractQueryParams('https://example.com/path')).toEqual({});
    });

    it('should handle malformed URLs', () => {
      expect(UrlAnalyzer.extractQueryParams('not-a-url')).toEqual({});
    });
  });

  describe('detectPageType', () => {
    it('should detect product pages', () => {
      expect(UrlAnalyzer.detectPageType('https://example.com/product/123', ['product', '123'])).toBe(PageType.PRODUCT);
      expect(UrlAnalyzer.detectPageType('https://amazon.com/dp/B123', ['dp', 'B123'])).toBe(PageType.PRODUCT);
      expect(UrlAnalyzer.detectPageType('https://shop.com/item/abc', ['item', 'abc'])).toBe(PageType.PRODUCT);
    });

    it('should detect article pages', () => {
      expect(UrlAnalyzer.detectPageType('https://blog.com/article/title', ['article', 'title'])).toBe(PageType.ARTICLE);
      expect(UrlAnalyzer.detectPageType('https://news.com/story/123', ['story', '123'])).toBe(PageType.ARTICLE);
      expect(UrlAnalyzer.detectPageType('https://medium.com/post/abc', ['post', 'abc'])).toBe(PageType.ARTICLE);
    });

    it('should detect profile pages', () => {
      expect(UrlAnalyzer.detectPageType('https://social.com/profile/user', ['profile', 'user'])).toBe(PageType.PROFILE);
      expect(UrlAnalyzer.detectPageType('https://linkedin.com/user/john', ['user', 'john'])).toBe(PageType.PROFILE);
      expect(UrlAnalyzer.detectPageType('https://twitter.com/@username', ['@username'])).toBe(PageType.PROFILE);
    });

    it('should detect form pages', () => {
      expect(UrlAnalyzer.detectPageType('https://example.com/contact', ['contact'])).toBe(PageType.FORM);
      expect(UrlAnalyzer.detectPageType('https://site.com/signup', ['signup'])).toBe(PageType.FORM);
      expect(UrlAnalyzer.detectPageType('https://app.com/login', ['login'])).toBe(PageType.FORM);
    });

    it('should detect home pages', () => {
      expect(UrlAnalyzer.detectPageType('https://example.com', [])).toBe(PageType.HOME);
      expect(UrlAnalyzer.detectPageType('https://example.com/', [])).toBe(PageType.HOME);
      expect(UrlAnalyzer.detectPageType('https://example.com/home', ['home'])).toBe(PageType.HOME);
    });

    it('should default to OTHER for unrecognized patterns', () => {
      expect(UrlAnalyzer.detectPageType('https://example.com/random/path', ['random', 'path'])).toBe(PageType.OTHER);
    });
  });

  describe('analyzeUrl', () => {
    it('should provide comprehensive URL analysis', () => {
      const analysis = UrlAnalyzer.analyzeUrl('https://www.example.com/product/123?color=red');
      
      expect(analysis.domain).toBe('example.com');
      expect(analysis.pathSegments).toEqual(['product', '123']);
      expect(analysis.queryParams).toEqual({ color: 'red' });
      expect(analysis.pageType).toBe(PageType.PRODUCT);
      expect(analysis.isSecure).toBe(true);
    });

    it('should handle insecure URLs', () => {
      const analysis = UrlAnalyzer.analyzeUrl('http://example.com');
      expect(analysis.isSecure).toBe(false);
    });
  });
});

// ============================================================================
// WEBSITE CATEGORIZER TESTS
// ============================================================================

describe('WebsiteCategorizer', () => {
  describe('categorizeByDomain', () => {
    it('should categorize social media sites correctly', () => {
      const result = WebsiteCategorizer.categorizeByDomain('facebook.com');
      expect(result.category).toBe(WebsiteCategory.SOCIAL_MEDIA);
      expect(result.securityLevel).toBe(SecurityLevel.CAUTIOUS);
      expect(result.confidence).toBe(0.9);
    });

    it('should categorize e-commerce sites correctly', () => {
      const result = WebsiteCategorizer.categorizeByDomain('amazon.com');
      expect(result.category).toBe(WebsiteCategory.ECOMMERCE);
      expect(result.securityLevel).toBe(SecurityLevel.CAUTIOUS);
      expect(result.confidence).toBe(0.9);
    });

    it('should categorize professional sites correctly', () => {
      const result = WebsiteCategorizer.categorizeByDomain('linkedin.com');
      expect(result.category).toBe(WebsiteCategory.SOCIAL_MEDIA); // LinkedIn is in social media patterns
      expect(result.securityLevel).toBe(SecurityLevel.CAUTIOUS);
    });

    it('should categorize news sites correctly', () => {
      const result = WebsiteCategorizer.categorizeByDomain('cnn.com');
      expect(result.category).toBe(WebsiteCategory.NEWS_CONTENT);
      expect(result.securityLevel).toBe(SecurityLevel.PUBLIC);
    });

    it('should handle subdomains correctly', () => {
      const result = WebsiteCategorizer.categorizeByDomain('shop.amazon.com');
      expect(result.category).toBe(WebsiteCategory.ECOMMERCE);
    });

    it('should detect restricted domains', () => {
      const result = WebsiteCategorizer.categorizeByDomain('bankofamerica.com');
      expect(result.securityLevel).toBe(SecurityLevel.RESTRICTED);
    });

    it('should categorize by keywords for unknown domains', () => {
      const result = WebsiteCategorizer.categorizeByDomain('myshop.com');
      expect(result.category).toBe(WebsiteCategory.ECOMMERCE);
      expect(result.confidence).toBe(0.3);
    });

    it('should default to CUSTOM for unrecognized domains', () => {
      const result = WebsiteCategorizer.categorizeByDomain('randomsite.com');
      expect(result.category).toBe(WebsiteCategory.CUSTOM);
      expect(result.confidence).toBe(0.3);
    });
  });
});

// ============================================================================
// CONTENT EXTRACTOR TESTS
// ============================================================================

describe('ContentExtractor', () => {
  let mockDocument: Document;

  beforeEach(() => {
    // Create a mock document
    mockDocument = {
      querySelector: (selector: string) => {
        if (selector === 'title') {
          return { textContent: 'Test Page Title' };
        }
        if (selector === 'main') {
          return { textContent: 'Main content of the page' };
        }
        return null;
      },
      querySelectorAll: (selector: string) => {
        if (selector === 'h1, h2, h3, h4, h5, h6') {
          return [
            { textContent: 'Heading 1' },
            { textContent: 'Heading 2' },
            { textContent: '   ' }, // Should be filtered out
            { textContent: 'Heading 3' }
          ];
        }
        if (selector === 'input, textarea, select') {
          return [
            {
              id: 'email',
              name: 'email',
              type: 'email',
              placeholder: 'Enter email',
              required: true,
              value: ''
            },
            {
              type: 'password', // Should be filtered out
              value: 'secret'
            },
            {
              name: 'message',
              type: 'textarea',
              required: false,
              value: 'Hello'
            }
          ];
        }
        if (selector === 'a[href]') {
          return [
            {
              getAttribute: (attr: string) => {
                if (attr === 'href') return 'https://example.com';
                if (attr === 'title') return 'Example Link';
                return null;
              },
              textContent: 'Example'
            },
            {
              getAttribute: (attr: string) => {
                if (attr === 'href') return '/internal';
                return null;
              },
              textContent: 'Internal Link'
            }
          ];
        }
        if (selector === 'meta') {
          return [
            {
              getAttribute: (attr: string) => {
                if (attr === 'name') return 'description';
                if (attr === 'content') return 'Page description';
                return null;
              }
            },
            {
              getAttribute: (attr: string) => {
                if (attr === 'property') return 'og:title';
                if (attr === 'content') return 'Open Graph Title';
                return null;
              }
            }
          ];
        }
        if (selector === 'script, style, nav, header, footer') {
          return [];
        }
        return [];
      },
      body: {
        textContent: 'Full body content with lots of text'
      }
    } as unknown as Document;
  });

  describe('extractPageContent', () => {
    it('should extract comprehensive page content', () => {
      const content = ContentExtractor.extractPageContent(mockDocument, 'https://example.com');
      
      expect(content.url).toBe('https://example.com');
      expect(content.title).toBe('Test Page Title');
      expect(content.headings).toEqual(['Heading 1', 'Heading 2', 'Heading 3']);
      expect(content.textContent).toBe('Main content of the page');
      expect(content.forms).toHaveLength(2); // Password field should be filtered out
      expect(content.links).toHaveLength(2);
      expect(content.metadata).toEqual({
        'description': 'Page description',
        'og:title': 'Open Graph Title'
      });
      expect(content.extractedAt).toBeInstanceOf(Date);
    });

    it('should handle pages without main content', () => {
      const mockDocWithoutMain = {
        ...mockDocument,
        querySelector: (selector: string) => {
          if (selector === 'title') {
            return { textContent: 'Test Page' };
          }
          return null; // No main content found
        }
      } as unknown as Document;

      const content = ContentExtractor.extractPageContent(mockDocWithoutMain, 'https://example.com');
      expect(content.textContent).toBe('Full body content with lots of text');
    });
  });
});

// ============================================================================
// CUSTOM PATTERN MATCHER TESTS
// ============================================================================

describe('CustomPatternMatcher', () => {
  let matcher: CustomPatternMatcher;
  let testPatterns: CustomPattern[];

  beforeEach(() => {
    testPatterns = [
      {
        id: 'pattern1',
        name: 'GitHub Pattern',
        urlPattern: 'github\\.com',
        category: WebsiteCategory.PRODUCTIVITY,
        suggestions: ['Review code', 'Create issue']
      },
      {
        id: 'pattern2',
        name: 'Local Dev Pattern',
        urlPattern: 'localhost:\\d+',
        category: WebsiteCategory.CUSTOM,
        suggestions: ['Debug app', 'Test feature']
      }
    ];
    matcher = new CustomPatternMatcher(testPatterns);
  });

  describe('findMatchingPatterns', () => {
    it('should find matching patterns', () => {
      const matches = matcher.findMatchingPatterns('https://github.com/user/repo');
      expect(matches).toHaveLength(1);
      expect(matches[0].id).toBe('pattern1');
    });

    it('should find multiple matching patterns', () => {
      // Add a pattern that would also match github
      matcher.addPattern({
        id: 'pattern3',
        name: 'Git Pattern',
        urlPattern: 'git',
        category: WebsiteCategory.PRODUCTIVITY,
        suggestions: ['Git operations']
      });

      const matches = matcher.findMatchingPatterns('https://github.com/user/repo');
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle regex patterns', () => {
      const matches = matcher.findMatchingPatterns('http://localhost:3000/app');
      expect(matches).toHaveLength(1);
      expect(matches[0].id).toBe('pattern2');
    });

    it('should return empty array for non-matching URLs', () => {
      const matches = matcher.findMatchingPatterns('https://example.com');
      expect(matches).toHaveLength(0);
    });

    it('should handle invalid regex patterns gracefully during matching', () => {
      // Manually add an invalid pattern to test graceful handling during matching
      const invalidPattern: CustomPattern = {
        id: 'invalid',
        name: 'Invalid Pattern',
        urlPattern: '[invalid regex',
        category: WebsiteCategory.CUSTOM,
        suggestions: []
      };
      
      // Bypass validation by directly accessing the private array
      (matcher as any).customPatterns.push(invalidPattern);

      // Should not throw error during matching, just skip invalid patterns
      const matches = matcher.findMatchingPatterns('https://example.com');
      expect(matches).toHaveLength(0);
    });
  });

  describe('addPattern', () => {
    it('should add valid patterns', () => {
      const newPattern: CustomPattern = {
        id: 'new',
        name: 'New Pattern',
        urlPattern: 'example\\.com',
        category: WebsiteCategory.CUSTOM,
        suggestions: ['Test']
      };

      matcher.addPattern(newPattern);
      const matches = matcher.findMatchingPatterns('https://example.com');
      expect(matches).toHaveLength(1);
      expect(matches[0].id).toBe('new');
    });

    it('should validate patterns before adding', () => {
      const invalidPattern: CustomPattern = {
        id: 'invalid',
        name: 'Invalid',
        urlPattern: '[invalid',
        category: WebsiteCategory.CUSTOM,
        suggestions: []
      };

      expect(() => matcher.addPattern(invalidPattern)).toThrow();
    });
  });

  describe('removePattern', () => {
    it('should remove existing patterns', () => {
      expect(matcher.removePattern('pattern1')).toBe(true);
      const matches = matcher.findMatchingPatterns('https://github.com/user/repo');
      expect(matches).toHaveLength(0);
    });

    it('should return false for non-existent patterns', () => {
      expect(matcher.removePattern('nonexistent')).toBe(false);
    });
  });

  describe('updatePattern', () => {
    it('should update existing patterns', () => {
      const updates = { name: 'Updated GitHub Pattern' };
      expect(matcher.updatePattern('pattern1', updates)).toBe(true);
      
      const patterns = matcher.getAllPatterns();
      const updated = patterns.find(p => p.id === 'pattern1');
      expect(updated?.name).toBe('Updated GitHub Pattern');
    });

    it('should validate URL pattern updates', () => {
      const updates = { urlPattern: '[invalid' };
      expect(() => matcher.updatePattern('pattern1', updates)).toThrow();
    });

    it('should return false for non-existent patterns', () => {
      expect(matcher.updatePattern('nonexistent', { name: 'Test' })).toBe(false);
    });
  });

  describe('getAllPatterns', () => {
    it('should return all patterns', () => {
      const patterns = matcher.getAllPatterns();
      expect(patterns).toHaveLength(2);
      expect(patterns[0].id).toBe('pattern1');
      expect(patterns[1].id).toBe('pattern2');
    });

    it('should return a copy of patterns', () => {
      const patterns = matcher.getAllPatterns();
      patterns.push({
        id: 'test',
        name: 'Test',
        urlPattern: 'test',
        category: WebsiteCategory.CUSTOM,
        suggestions: []
      });
      
      // Original should not be modified
      expect(matcher.getAllPatterns()).toHaveLength(2);
    });
  });
});

// ============================================================================
// PATTERN ENGINE INTEGRATION TESTS
// ============================================================================

describe('PatternEngine', () => {
  let engine: PatternEngine;
  let customPatterns: CustomPattern[];

  beforeEach(() => {
    customPatterns = [
      {
        id: 'custom1',
        name: 'Custom GitHub',
        urlPattern: 'github\\.com',
        category: WebsiteCategory.PRODUCTIVITY,
        suggestions: ['Custom GitHub suggestion']
      }
    ];
    engine = new PatternEngine(customPatterns);
  });

  describe('analyzeWebsite', () => {
    it('should provide comprehensive website analysis', () => {
      const context = engine.analyzeWebsite('https://www.facebook.com/profile/user');
      
      expect(context.domain).toBe('facebook.com');
      expect(context.category).toBe(WebsiteCategory.SOCIAL_MEDIA);
      expect(context.pageType).toBe(PageType.PROFILE);
      expect(context.securityLevel).toBe(SecurityLevel.CAUTIOUS);
      expect(context.extractedData).toBeDefined();
      expect(context.timestamp).toBeInstanceOf(Date);
    });

    it('should prefer custom patterns over built-in categorization', () => {
      const context = engine.analyzeWebsite('https://github.com/user/repo');
      
      expect(context.domain).toBe('github.com');
      expect(context.category).toBe(WebsiteCategory.PRODUCTIVITY); // From custom pattern
      expect(context.extractedData.customMatches).toEqual(['custom1']);
    });

    it('should maintain restrictive security levels', () => {
      // Add a custom pattern for a banking site
      engine.registerCustomPattern({
        id: 'bank',
        name: 'Bank Pattern',
        urlPattern: 'bankofamerica\\.com',
        category: WebsiteCategory.CUSTOM,
        suggestions: ['Banking suggestion']
      });

      const context = engine.analyzeWebsite('https://bankofamerica.com');
      expect(context.securityLevel).toBe(SecurityLevel.RESTRICTED); // Should keep restrictive level
    });

    it('should include page content analysis when provided', () => {
      const pageContent = {
        url: 'https://example.com',
        title: 'Test Page',
        headings: ['H1', 'H2'],
        textContent: 'Page content',
        forms: [],
        links: [],
        metadata: {},
        extractedAt: new Date()
      };

      const context = engine.analyzeWebsite('https://example.com', pageContent);
      expect(context.extractedData.pageContent).toBeDefined();
      expect((context.extractedData.pageContent as any).title).toBe('Test Page');
      expect((context.extractedData.pageContent as any).headingCount).toBe(2);
    });
  });

  describe('getMatchingPatterns', () => {
    it('should return built-in patterns for recognized categories', () => {
      const context = engine.analyzeWebsite('https://facebook.com');
      const patterns = engine.getMatchingPatterns(context);
      
      expect(patterns.length).toBeGreaterThan(0);
      const builtInPattern = patterns.find(p => p.isBuiltIn);
      expect(builtInPattern).toBeDefined();
      expect(builtInPattern?.suggestions.length).toBeGreaterThan(0);
    });

    it('should include custom patterns', () => {
      const context = engine.analyzeWebsite('https://github.com');
      const patterns = engine.getMatchingPatterns(context);
      
      const customPattern = patterns.find(p => !p.isBuiltIn);
      expect(customPattern).toBeDefined();
      expect(customPattern?.suggestions[0].title).toBe('Custom GitHub suggestion');
    });

    it('should return empty array for unrecognized sites without custom patterns', () => {
      const context = engine.analyzeWebsite('https://unknown-site.com');
      const patterns = engine.getMatchingPatterns(context);
      
      // Should have no patterns since it's CUSTOM category with no built-in suggestions
      expect(patterns).toHaveLength(0);
    });
  });

  describe('custom pattern management', () => {
    it('should register new custom patterns', () => {
      const newPattern: CustomPattern = {
        id: 'new',
        name: 'New Pattern',
        urlPattern: 'example\\.com',
        category: WebsiteCategory.CUSTOM,
        suggestions: ['New suggestion']
      };

      engine.registerCustomPattern(newPattern);
      
      const context = engine.analyzeWebsite('https://example.com');
      expect(context.extractedData.customMatches).toContain('new');
    });

    it('should update custom patterns', () => {
      const newPatterns: CustomPattern[] = [
        {
          id: 'updated',
          name: 'Updated Pattern',
          urlPattern: 'updated\\.com',
          category: WebsiteCategory.CUSTOM,
          suggestions: ['Updated suggestion']
        }
      ];

      engine.updateCustomPatterns(newPatterns);
      
      const patterns = engine.getCustomPatterns();
      expect(patterns).toHaveLength(1);
      expect(patterns[0].id).toBe('updated');
    });

    it('should get all custom patterns', () => {
      const patterns = engine.getCustomPatterns();
      expect(patterns).toHaveLength(1);
      expect(patterns[0].id).toBe('custom1');
    });
  });

  describe('built-in suggestions by category', () => {
    it('should provide social media suggestions', () => {
      const context = engine.analyzeWebsite('https://twitter.com');
      const patterns = engine.getMatchingPatterns(context);
      
      const builtInPattern = patterns.find(p => p.isBuiltIn);
      expect(builtInPattern?.suggestions.some(s => s.title.includes('post'))).toBe(true);
      expect(builtInPattern?.suggestions.some(s => s.title.includes('sentiment'))).toBe(true);
      expect(builtInPattern?.suggestions.some(s => s.title.includes('hashtags'))).toBe(true);
    });

    it('should provide e-commerce suggestions', () => {
      const context = engine.analyzeWebsite('https://amazon.com');
      const patterns = engine.getMatchingPatterns(context);
      
      const builtInPattern = patterns.find(p => p.isBuiltIn);
      expect(builtInPattern?.suggestions.some(s => s.title.includes('Compare'))).toBe(true);
      expect(builtInPattern?.suggestions.some(s => s.title.includes('deals'))).toBe(true);
      expect(builtInPattern?.suggestions.some(s => s.title.includes('review'))).toBe(true);
    });

    it('should provide news content suggestions', () => {
      const context = engine.analyzeWebsite('https://cnn.com');
      const patterns = engine.getMatchingPatterns(context);
      
      const builtInPattern = patterns.find(p => p.isBuiltIn);
      expect(builtInPattern?.suggestions.some(s => s.title.includes('Summarize'))).toBe(true);
      expect(builtInPattern?.suggestions.some(s => s.title.includes('Fact-check'))).toBe(true);
      expect(builtInPattern?.suggestions.some(s => s.title.includes('discussion'))).toBe(true);
    });
  });
});