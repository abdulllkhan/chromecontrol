/**
 * Website Pattern Recognition Engine
 * 
 * This service analyzes websites and matches them to appropriate categories and patterns.
 * It provides URL analysis, domain categorization, page content extraction, and custom pattern matching.
 */

import {
  WebsiteContext,
  WebsiteCategory,
  PageType,
  SecurityLevel,
  PageContent,
  Pattern,
  CustomPattern,
  ValidationUtils
} from '../types/index.js';
import { securityManager } from './securityManager.js';

// ============================================================================
// BUILT-IN WEBSITE PATTERNS
// ============================================================================

interface DomainPattern {
  domains: string[];
  category: WebsiteCategory;
  securityLevel: SecurityLevel;
  commonPageTypes: PageType[];
}

const BUILT_IN_PATTERNS: DomainPattern[] = [
  // Social Media
  {
    domains: ['facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'linkedin.com', 'tiktok.com', 'snapchat.com', 'reddit.com', 'discord.com', 'telegram.org'],
    category: WebsiteCategory.SOCIAL_MEDIA,
    securityLevel: SecurityLevel.CAUTIOUS,
    commonPageTypes: [PageType.PROFILE, PageType.HOME, PageType.OTHER]
  },
  
  // E-commerce
  {
    domains: ['amazon.com', 'ebay.com', 'shopify.com', 'etsy.com', 'walmart.com', 'target.com', 'bestbuy.com', 'alibaba.com', 'aliexpress.com'],
    category: WebsiteCategory.ECOMMERCE,
    securityLevel: SecurityLevel.CAUTIOUS,
    commonPageTypes: [PageType.PRODUCT, PageType.HOME, PageType.OTHER]
  },
  
  // Professional
  {
    domains: ['indeed.com', 'glassdoor.com', 'monster.com', 'careerbuilder.com', 'ziprecruiter.com', 'upwork.com', 'freelancer.com', 'fiverr.com'],
    category: WebsiteCategory.PROFESSIONAL,
    securityLevel: SecurityLevel.CAUTIOUS,
    commonPageTypes: [PageType.PROFILE, PageType.FORM, PageType.OTHER]
  },
  
  // News & Content
  {
    domains: ['cnn.com', 'bbc.com', 'reuters.com', 'nytimes.com', 'washingtonpost.com', 'theguardian.com', 'medium.com', 'substack.com', 'wordpress.com', 'blogger.com'],
    category: WebsiteCategory.NEWS_CONTENT,
    securityLevel: SecurityLevel.PUBLIC,
    commonPageTypes: [PageType.ARTICLE, PageType.HOME, PageType.OTHER]
  },
  
  // Productivity
  {
    domains: ['google.com', 'microsoft.com', 'notion.so', 'slack.com', 'trello.com', 'asana.com', 'monday.com', 'airtable.com', 'dropbox.com', 'drive.google.com'],
    category: WebsiteCategory.PRODUCTIVITY,
    securityLevel: SecurityLevel.CAUTIOUS,
    commonPageTypes: [PageType.FORM, PageType.HOME, PageType.OTHER]
  }
];

// Security-sensitive domains that should be treated with extra caution
const RESTRICTED_DOMAINS = [
  'bank', 'banking', 'paypal.com', 'stripe.com', 'healthcare', 'medical', 'hospital',
  'gov', 'irs.gov', 'social-security', 'medicare', 'medicaid'
];

// ============================================================================
// URL AND DOMAIN ANALYSIS
// ============================================================================

export class UrlAnalyzer {
  /**
   * Extracts domain from URL
   */
  static extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.toLowerCase().replace(/^www\./, '');
    } catch (error) {
      // Fallback for invalid URLs
      const match = url.match(/^(?:https?:\/\/)?(?:www\.)?([^\/]+)/);
      return match ? match[1].toLowerCase() : url.toLowerCase();
    }
  }

  /**
   * Extracts path segments from URL
   */
  static extractPathSegments(url: string): string[] {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.split('/').filter(segment => segment.length > 0);
    } catch (error) {
      return [];
    }
  }

  /**
   * Extracts query parameters from URL
   */
  static extractQueryParams(url: string): Record<string, string> {
    try {
      const urlObj = new URL(url);
      const params: Record<string, string> = {};
      urlObj.searchParams.forEach((value, key) => {
        params[key] = value;
      });
      return params;
    } catch (error) {
      return {};
    }
  }

  /**
   * Determines if URL indicates a specific page type
   */
  static detectPageType(url: string, pathSegments: string[]): PageType {
    const path = pathSegments.join('/').toLowerCase();
    
    // Product pages
    if (path.includes('product') || path.includes('item') || path.includes('p/') || 
        path.includes('/dp/') || path.includes('buy') || path.includes('shop')) {
      return PageType.PRODUCT;
    }
    
    // Article/blog pages
    if (path.includes('article') || path.includes('blog') || path.includes('post') || 
        path.includes('news') || path.includes('story')) {
      return PageType.ARTICLE;
    }
    
    // Profile pages
    if (path.includes('profile') || path.includes('user') || path.includes('account') || 
        path.includes('dashboard') || path.includes('@')) {
      return PageType.PROFILE;
    }
    
    // Form pages
    if (path.includes('form') || path.includes('contact') || path.includes('apply') || 
        path.includes('signup') || path.includes('register') || path.includes('login')) {
      return PageType.FORM;
    }
    
    // Home pages
    if (pathSegments.length === 0 || path === '' || path === 'home' || path === 'index') {
      return PageType.HOME;
    }
    
    return PageType.OTHER;
  }

  /**
   * Analyzes URL structure and extracts metadata
   */
  static analyzeUrl(url: string): {
    domain: string;
    pathSegments: string[];
    queryParams: Record<string, string>;
    pageType: PageType;
    isSecure: boolean;
  } {
    const domain = this.extractDomain(url);
    const pathSegments = this.extractPathSegments(url);
    const queryParams = this.extractQueryParams(url);
    const pageType = this.detectPageType(url, pathSegments);
    const isSecure = url.startsWith('https://');

    return {
      domain,
      pathSegments,
      queryParams,
      pageType,
      isSecure
    };
  }
}

// ============================================================================
// WEBSITE CATEGORIZATION
// ============================================================================

export class WebsiteCategorizer {
  /**
   * Categorizes website based on domain patterns
   */
  static categorizeByDomain(domain: string): {
    category: WebsiteCategory;
    securityLevel: SecurityLevel;
    confidence: number;
  } {
    // Check built-in patterns
    for (const pattern of BUILT_IN_PATTERNS) {
      for (const patternDomain of pattern.domains) {
        if (domain === patternDomain || domain.endsWith('.' + patternDomain)) {
          return {
            category: pattern.category,
            securityLevel: pattern.securityLevel,
            confidence: 0.9
          };
        }
      }
    }

    // Check for restricted domains
    const securityLevel = this.determineSecurityLevel(domain);
    
    // Fallback categorization based on domain keywords
    const category = this.categorizeByKeywords(domain);
    
    return {
      category,
      securityLevel,
      confidence: 0.3 // Lower confidence for keyword-based categorization
    };
  }

  /**
   * Determines security level based on domain characteristics
   */
  private static determineSecurityLevel(domain: string): SecurityLevel {
    const lowerDomain = domain.toLowerCase();
    
    // Check for restricted domains
    for (const restricted of RESTRICTED_DOMAINS) {
      if (lowerDomain.includes(restricted)) {
        return SecurityLevel.RESTRICTED;
      }
    }
    
    // Government domains
    if (lowerDomain.endsWith('.gov') || lowerDomain.endsWith('.mil')) {
      return SecurityLevel.RESTRICTED;
    }
    
    // Financial domains
    if (lowerDomain.includes('bank') || lowerDomain.includes('credit') || 
        lowerDomain.includes('loan') || lowerDomain.includes('finance')) {
      return SecurityLevel.RESTRICTED;
    }
    
    // Healthcare domains
    if (lowerDomain.includes('health') || lowerDomain.includes('medical') || 
        lowerDomain.includes('hospital') || lowerDomain.includes('clinic')) {
      return SecurityLevel.RESTRICTED;
    }
    
    return SecurityLevel.PUBLIC;
  }

  /**
   * Categorizes website based on domain keywords
   */
  private static categorizeByKeywords(domain: string): WebsiteCategory {
    const lowerDomain = domain.toLowerCase();
    
    // Social media keywords
    if (lowerDomain.includes('social') || lowerDomain.includes('chat') || 
        lowerDomain.includes('community') || lowerDomain.includes('forum')) {
      return WebsiteCategory.SOCIAL_MEDIA;
    }
    
    // E-commerce keywords
    if (lowerDomain.includes('shop') || lowerDomain.includes('store') || 
        lowerDomain.includes('buy') || lowerDomain.includes('sell') || 
        lowerDomain.includes('market') || lowerDomain.includes('commerce')) {
      return WebsiteCategory.ECOMMERCE;
    }
    
    // Professional keywords
    if (lowerDomain.includes('job') || lowerDomain.includes('career') || 
        lowerDomain.includes('work') || lowerDomain.includes('hire') || 
        lowerDomain.includes('recruit')) {
      return WebsiteCategory.PROFESSIONAL;
    }
    
    // News/content keywords
    if (lowerDomain.includes('news') || lowerDomain.includes('blog') || 
        lowerDomain.includes('article') || lowerDomain.includes('media') || 
        lowerDomain.includes('press') || lowerDomain.includes('journal')) {
      return WebsiteCategory.NEWS_CONTENT;
    }
    
    // Productivity keywords
    if (lowerDomain.includes('tool') || lowerDomain.includes('app') || 
        lowerDomain.includes('productivity') || lowerDomain.includes('manage') || 
        lowerDomain.includes('organize')) {
      return WebsiteCategory.PRODUCTIVITY;
    }
    
    return WebsiteCategory.CUSTOM;
  }
}

// ============================================================================
// PAGE CONTENT EXTRACTION
// ============================================================================

export class ContentExtractor {
  /**
   * Extracts structured content from page HTML
   */
  static extractPageContent(document: Document, url: string): PageContent {
    const extractedAt = new Date();
    
    return {
      url,
      title: this.extractTitle(document),
      headings: this.extractHeadings(document),
      textContent: this.extractTextContent(document),
      forms: this.extractForms(document),
      links: this.extractLinks(document),
      metadata: this.extractMetadata(document),
      extractedAt
    };
  }

  /**
   * Extracts page title
   */
  private static extractTitle(document: Document): string {
    const titleElement = document.querySelector('title');
    return titleElement?.textContent?.trim() || '';
  }

  /**
   * Extracts headings (h1-h6)
   */
  private static extractHeadings(document: Document): string[] {
    const headings: string[] = [];
    const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    
    headingElements.forEach(heading => {
      const text = heading.textContent?.trim();
      if (text && text.length > 0) {
        headings.push(text);
      }
    });
    
    return headings;
  }

  /**
   * Extracts main text content
   */
  private static extractTextContent(document: Document): string {
    // Remove script and style elements
    const scripts = document.querySelectorAll('script, style, nav, header, footer');
    scripts.forEach(element => element.remove());
    
    // Get main content areas
    const contentSelectors = [
      'main',
      'article',
      '[role="main"]',
      '.content',
      '.main-content',
      '#content',
      '#main'
    ];
    
    let mainContent = '';
    for (const selector of contentSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        mainContent = element.textContent?.trim() || '';
        break;
      }
    }
    
    // Fallback to body content if no main content found
    if (!mainContent) {
      mainContent = document.body?.textContent?.trim() || '';
    }
    
    // Limit content length and clean up
    return mainContent
      .replace(/\s+/g, ' ')
      .slice(0, 5000)
      .trim();
  }

  /**
   * Extracts form elements
   */
  private static extractForms(document: Document): any[] {
    const forms: any[] = [];
    const formElements = document.querySelectorAll('input, textarea, select');
    
    formElements.forEach(element => {
      const input = element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      
      // Skip hidden and password fields for security
      if (input.type === 'hidden' || input.type === 'password') {
        return;
      }
      
      forms.push({
        id: input.id || undefined,
        name: input.name || undefined,
        type: input.type || input.tagName.toLowerCase(),
        placeholder: (input as HTMLInputElement).placeholder || undefined,
        required: input.required,
        value: input.value || undefined
      });
    });
    
    return forms.slice(0, 20); // Limit number of forms
  }

  /**
   * Extracts links
   */
  private static extractLinks(document: Document): any[] {
    const links: any[] = [];
    const linkElements = document.querySelectorAll('a[href]');
    
    linkElements.forEach(link => {
      const href = link.getAttribute('href');
      const text = link.textContent?.trim();
      const title = link.getAttribute('title');
      
      if (href && text && text.length > 0) {
        links.push({
          href,
          text,
          title: title || undefined
        });
      }
    });
    
    return links.slice(0, 50); // Limit number of links
  }

  /**
   * Extracts metadata from meta tags
   */
  private static extractMetadata(document: Document): Record<string, string> {
    const metadata: Record<string, string> = {};
    const metaTags = document.querySelectorAll('meta');
    
    metaTags.forEach(meta => {
      const name = meta.getAttribute('name') || meta.getAttribute('property');
      const content = meta.getAttribute('content');
      
      if (name && content) {
        metadata[name] = content;
      }
    });
    
    return metadata;
  }
}

// ============================================================================
// CUSTOM PATTERN MATCHING
// ============================================================================

export class CustomPatternMatcher {
  private customPatterns: CustomPattern[] = [];

  constructor(customPatterns: CustomPattern[] = []) {
    this.customPatterns = customPatterns;
  }

  /**
   * Adds a custom pattern
   */
  addPattern(pattern: CustomPattern): void {
    // Validate the pattern
    ValidationUtils.validateUrlPattern(pattern.urlPattern);
    this.customPatterns.push(pattern);
  }

  /**
   * Removes a custom pattern
   */
  removePattern(patternId: string): boolean {
    const index = this.customPatterns.findIndex(p => p.id === patternId);
    if (index !== -1) {
      this.customPatterns.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Updates a custom pattern
   */
  updatePattern(patternId: string, updates: Partial<CustomPattern>): boolean {
    const index = this.customPatterns.findIndex(p => p.id === patternId);
    if (index !== -1) {
      if (updates.urlPattern) {
        ValidationUtils.validateUrlPattern(updates.urlPattern);
      }
      this.customPatterns[index] = { ...this.customPatterns[index], ...updates };
      return true;
    }
    return false;
  }

  /**
   * Finds matching custom patterns for a URL
   */
  findMatchingPatterns(url: string): CustomPattern[] {
    const matches: CustomPattern[] = [];
    
    for (const pattern of this.customPatterns) {
      try {
        const regex = new RegExp(pattern.urlPattern, 'i');
        if (regex.test(url)) {
          matches.push(pattern);
        }
      } catch (error) {
        console.warn(`Invalid regex pattern: ${pattern.urlPattern}`, error);
      }
    }
    
    return matches;
  }

  /**
   * Gets all custom patterns
   */
  getAllPatterns(): CustomPattern[] {
    return [...this.customPatterns];
  }
}

// ============================================================================
// MAIN PATTERN ENGINE
// ============================================================================

export class PatternEngine {
  private customPatternMatcher: CustomPatternMatcher;

  constructor(customPatterns: CustomPattern[] = []) {
    this.customPatternMatcher = new CustomPatternMatcher(customPatterns);
  }

  /**
   * Analyzes a website and returns comprehensive context
   */
  analyzeWebsite(url: string, pageContent?: PageContent): WebsiteContext {
    // Analyze URL structure
    const urlAnalysis = UrlAnalyzer.analyzeUrl(url);
    
    // Categorize website
    const categorization = WebsiteCategorizer.categorizeByDomain(urlAnalysis.domain);
    
    // Use SecurityManager for more comprehensive security level detection
    const securityLevel = securityManager.validateWebsitePermissions(urlAnalysis.domain);
    
    // Check for custom pattern matches
    const customMatches = this.customPatternMatcher.findMatchingPatterns(url);
    
    // Use custom category if available and has higher confidence
    let finalCategory = categorization.category;
    let finalSecurityLevel = securityLevel; // Use SecurityManager's assessment
    
    if (customMatches.length > 0) {
      // Use the first custom match (could be enhanced with priority system)
      finalCategory = customMatches[0].category;
      // Keep the more restrictive security level between SecurityManager and built-in patterns
      if (securityLevel === SecurityLevel.RESTRICTED || categorization.securityLevel === SecurityLevel.RESTRICTED) {
        finalSecurityLevel = SecurityLevel.RESTRICTED;
      }
    }

    // Extract additional data from page content if available
    const extractedData: Record<string, unknown> = {
      urlAnalysis,
      customMatches: customMatches.map(m => m.id),
      confidence: categorization.confidence
    };

    if (pageContent) {
      extractedData.pageContent = {
        title: pageContent.title,
        headingCount: pageContent.headings.length,
        formCount: pageContent.forms.length,
        linkCount: pageContent.links.length,
        contentLength: pageContent.textContent.length,
        hasMetadata: Object.keys(pageContent.metadata).length > 0
      };
    }

    return {
      domain: urlAnalysis.domain,
      category: finalCategory,
      pageType: urlAnalysis.pageType,
      extractedData,
      securityLevel: finalSecurityLevel,
      timestamp: new Date()
    };
  }

  /**
   * Gets matching patterns for a website context
   */
  getMatchingPatterns(context: WebsiteContext): Pattern[] {
    const patterns: Pattern[] = [];
    
    // Add built-in patterns based on category
    const builtInPattern = this.createBuiltInPattern(context);
    if (builtInPattern) {
      patterns.push(builtInPattern);
    }
    
    // Add custom patterns
    const customMatches = this.customPatternMatcher.findMatchingPatterns(
      `https://${context.domain}`
    );
    
    customMatches.forEach(customPattern => {
      patterns.push({
        id: customPattern.id,
        name: customPattern.name,
        urlRegex: customPattern.urlPattern,
        category: customPattern.category,
        suggestions: customPattern.suggestions.map(suggestion => ({
          id: `custom-${customPattern.id}-${suggestion}`,
          title: suggestion,
          description: `Custom suggestion for ${customPattern.name}`,
          category: customPattern.category,
          isCustom: true,
          estimatedTime: 30,
          requiresPermission: false
        })),
        isBuiltIn: false
      });
    });
    
    return patterns;
  }

  /**
   * Creates a built-in pattern based on website category
   */
  private createBuiltInPattern(context: WebsiteContext): Pattern | null {
    const suggestions = this.getBuiltInSuggestions(context.category, context.pageType);
    
    if (suggestions.length === 0) {
      return null;
    }
    
    return {
      id: `builtin-${context.category}`,
      name: `${context.category} suggestions`,
      urlRegex: `.*${context.domain}.*`,
      category: context.category,
      suggestions,
      isBuiltIn: true
    };
  }

  /**
   * Gets built-in suggestions based on category and page type
   */
  private getBuiltInSuggestions(category: WebsiteCategory, pageType: PageType): any[] {
    const suggestions: any[] = [];
    
    switch (category) {
      case WebsiteCategory.SOCIAL_MEDIA:
        suggestions.push(
          {
            id: 'social-generate-post',
            title: 'Generate engaging post',
            description: 'Create a compelling social media post',
            category: 'content',
            isCustom: false,
            estimatedTime: 30,
            requiresPermission: false
          },
          {
            id: 'social-analyze-sentiment',
            title: 'Analyze sentiment',
            description: 'Analyze the sentiment of posts or comments',
            category: 'analysis',
            isCustom: false,
            estimatedTime: 15,
            requiresPermission: false
          },
          {
            id: 'social-suggest-hashtags',
            title: 'Suggest hashtags',
            description: 'Generate relevant hashtags for your content',
            category: 'content',
            isCustom: false,
            estimatedTime: 10,
            requiresPermission: false
          }
        );
        break;
        
      case WebsiteCategory.ECOMMERCE:
        suggestions.push(
          {
            id: 'ecom-compare-products',
            title: 'Compare products',
            description: 'Compare features and prices of products',
            category: 'analysis',
            isCustom: false,
            estimatedTime: 45,
            requiresPermission: false
          },
          {
            id: 'ecom-find-deals',
            title: 'Find better deals',
            description: 'Search for better prices elsewhere',
            category: 'research',
            isCustom: false,
            estimatedTime: 60,
            requiresPermission: false
          },
          {
            id: 'ecom-review-summary',
            title: 'Generate review summary',
            description: 'Summarize customer reviews',
            category: 'analysis',
            isCustom: false,
            estimatedTime: 30,
            requiresPermission: false
          }
        );
        break;
        
      case WebsiteCategory.PROFESSIONAL:
        suggestions.push(
          {
            id: 'prof-optimize-profile',
            title: 'Optimize profile',
            description: 'Improve your professional profile',
            category: 'optimization',
            isCustom: false,
            estimatedTime: 60,
            requiresPermission: false
          },
          {
            id: 'prof-cover-letter',
            title: 'Generate cover letter',
            description: 'Create a tailored cover letter',
            category: 'content',
            isCustom: false,
            estimatedTime: 45,
            requiresPermission: false
          },
          {
            id: 'prof-analyze-job',
            title: 'Analyze job posting',
            description: 'Break down job requirements and match skills',
            category: 'analysis',
            isCustom: false,
            estimatedTime: 30,
            requiresPermission: false
          }
        );
        break;
        
      case WebsiteCategory.NEWS_CONTENT:
        suggestions.push(
          {
            id: 'news-summarize',
            title: 'Summarize article',
            description: 'Create a concise summary of the article',
            category: 'content',
            isCustom: false,
            estimatedTime: 20,
            requiresPermission: false
          },
          {
            id: 'news-fact-check',
            title: 'Fact-check claims',
            description: 'Verify claims made in the article',
            category: 'analysis',
            isCustom: false,
            estimatedTime: 90,
            requiresPermission: false
          },
          {
            id: 'news-discussion-points',
            title: 'Generate discussion points',
            description: 'Create talking points for discussion',
            category: 'content',
            isCustom: false,
            estimatedTime: 25,
            requiresPermission: false
          }
        );
        break;
        
      case WebsiteCategory.PRODUCTIVITY:
        suggestions.push(
          {
            id: 'prod-automate-task',
            title: 'Automate repetitive task',
            description: 'Create automation for common actions',
            category: 'automation',
            isCustom: false,
            estimatedTime: 120,
            requiresPermission: true
          },
          {
            id: 'prod-organize-content',
            title: 'Organize content',
            description: 'Structure and categorize information',
            category: 'organization',
            isCustom: false,
            estimatedTime: 30,
            requiresPermission: false
          },
          {
            id: 'prod-generate-template',
            title: 'Generate template',
            description: 'Create reusable templates',
            category: 'content',
            isCustom: false,
            estimatedTime: 40,
            requiresPermission: false
          }
        );
        break;
    }
    
    return suggestions;
  }

  /**
   * Registers a custom pattern
   */
  registerCustomPattern(pattern: CustomPattern): void {
    this.customPatternMatcher.addPattern(pattern);
  }

  /**
   * Updates custom patterns
   */
  updateCustomPatterns(patterns: CustomPattern[]): void {
    this.customPatternMatcher = new CustomPatternMatcher(patterns);
  }

  /**
   * Gets all custom patterns
   */
  getCustomPatterns(): CustomPattern[] {
    return this.customPatternMatcher.getAllPatterns();
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// All classes are already exported above with their definitions
// No need for additional export statements