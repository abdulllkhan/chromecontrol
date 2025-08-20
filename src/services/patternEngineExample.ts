/**
 * Example usage of the Website Pattern Recognition Engine
 * 
 * This file demonstrates how to use the pattern engine to analyze websites
 * and get contextual suggestions.
 */

import { PatternEngine, ContentExtractor } from './patternEngine.js';
import { WebsiteCategory, CustomPattern } from '../types/index.js';

// ============================================================================
// EXAMPLE USAGE
// ============================================================================

/**
 * Example: Basic website analysis
 */
export function exampleBasicAnalysis() {
  const engine = new PatternEngine();
  
  // Analyze different types of websites
  const websites = [
    'https://facebook.com/profile/john',
    'https://amazon.com/product/B123456',
    'https://linkedin.com/in/jane-doe',
    'https://cnn.com/article/breaking-news',
    'https://github.com/user/repo'
  ];
  
  console.log('=== Basic Website Analysis ===');
  websites.forEach(url => {
    const context = engine.analyzeWebsite(url);
    console.log(`\nURL: ${url}`);
    console.log(`Domain: ${context.domain}`);
    console.log(`Category: ${context.category}`);
    console.log(`Page Type: ${context.pageType}`);
    console.log(`Security Level: ${context.securityLevel}`);
    
    // Get matching patterns and suggestions
    const patterns = engine.getMatchingPatterns(context);
    if (patterns.length > 0) {
      console.log('Available suggestions:');
      patterns.forEach(pattern => {
        pattern.suggestions.forEach(suggestion => {
          console.log(`  - ${suggestion.title}: ${suggestion.description}`);
        });
      });
    }
  });
}

/**
 * Example: Custom pattern usage
 */
export function exampleCustomPatterns() {
  // Create custom patterns
  const customPatterns: CustomPattern[] = [
    {
      id: 'github-pattern',
      name: 'GitHub Development',
      urlPattern: 'github\\.com',
      category: WebsiteCategory.PRODUCTIVITY,
      suggestions: [
        'Review pull request',
        'Create issue template',
        'Generate commit message',
        'Analyze code quality'
      ]
    },
    {
      id: 'stackoverflow-pattern',
      name: 'Stack Overflow Help',
      urlPattern: 'stackoverflow\\.com',
      category: WebsiteCategory.PRODUCTIVITY,
      suggestions: [
        'Explain error message',
        'Suggest solution approach',
        'Find similar questions',
        'Generate code example'
      ]
    },
    {
      id: 'local-dev-pattern',
      name: 'Local Development',
      urlPattern: 'localhost:\\d+',
      category: WebsiteCategory.CUSTOM,
      suggestions: [
        'Debug application',
        'Test API endpoints',
        'Generate test data',
        'Analyze performance'
      ]
    }
  ];
  
  const engine = new PatternEngine(customPatterns);
  
  console.log('\n=== Custom Pattern Analysis ===');
  const testUrls = [
    'https://github.com/microsoft/vscode',
    'https://stackoverflow.com/questions/12345',
    'http://localhost:3000/dashboard'
  ];
  
  testUrls.forEach(url => {
    const context = engine.analyzeWebsite(url);
    const patterns = engine.getMatchingPatterns(context);
    
    console.log(`\nURL: ${url}`);
    console.log(`Category: ${context.category}`);
    console.log(`Custom matches: ${context.extractedData.customMatches}`);
    
    if (patterns.length > 0) {
      console.log('Custom suggestions:');
      patterns.forEach(pattern => {
        if (!pattern.isBuiltIn) {
          console.log(`  Pattern: ${pattern.name}`);
          pattern.suggestions.forEach(suggestion => {
            console.log(`    - ${suggestion.title}`);
          });
        }
      });
    }
  });
}

/**
 * Example: Content extraction (would be used with actual DOM)
 */
export function exampleContentExtraction() {
  console.log('\n=== Content Extraction Example ===');
  console.log('Note: This would typically be used with actual DOM content');
  console.log('The ContentExtractor.extractPageContent() method would be called');
  console.log('from a content script with access to the page DOM.');
  
  // Example of what extracted content might look like
  const mockPageContent = {
    url: 'https://example.com/article',
    title: 'How to Build Chrome Extensions',
    headings: [
      'Introduction to Chrome Extensions',
      'Setting up the Development Environment',
      'Creating Your First Extension',
      'Advanced Features'
    ],
    textContent: 'Chrome extensions are powerful tools that can enhance browser functionality...',
    forms: [
      {
        id: 'newsletter-signup',
        name: 'email',
        type: 'email',
        placeholder: 'Enter your email',
        required: true
      }
    ],
    links: [
      {
        href: 'https://developer.chrome.com/docs/extensions/',
        text: 'Chrome Extension Documentation',
        title: 'Official Chrome Extension Docs'
      }
    ],
    metadata: {
      'description': 'Learn how to build Chrome extensions from scratch',
      'og:title': 'Chrome Extension Development Guide',
      'author': 'John Developer'
    },
    extractedAt: new Date()
  };
  
  const engine = new PatternEngine();
  const context = engine.analyzeWebsite(mockPageContent.url, mockPageContent);
  
  console.log(`\nAnalyzed content for: ${mockPageContent.title}`);
  console.log(`Content length: ${mockPageContent.textContent.length} characters`);
  console.log(`Headings found: ${mockPageContent.headings.length}`);
  console.log(`Forms found: ${mockPageContent.forms.length}`);
  console.log(`Links found: ${mockPageContent.links.length}`);
  console.log(`Metadata fields: ${Object.keys(mockPageContent.metadata).length}`);
  
  // Show how page content affects analysis
  const pageContentData = context.extractedData.pageContent as any;
  if (pageContentData) {
    console.log('\nPage content analysis:');
    console.log(`  Title: ${pageContentData.title}`);
    console.log(`  Heading count: ${pageContentData.headingCount}`);
    console.log(`  Form count: ${pageContentData.formCount}`);
    console.log(`  Link count: ${pageContentData.linkCount}`);
    console.log(`  Content length: ${pageContentData.contentLength}`);
    console.log(`  Has metadata: ${pageContentData.hasMetadata}`);
  }
}

/**
 * Example: Pattern management
 */
export function examplePatternManagement() {
  const engine = new PatternEngine();
  
  console.log('\n=== Pattern Management Example ===');
  
  // Add a new custom pattern
  const newPattern: CustomPattern = {
    id: 'jira-pattern',
    name: 'JIRA Project Management',
    urlPattern: '.*\\.atlassian\\.net',
    category: WebsiteCategory.PRODUCTIVITY,
    suggestions: [
      'Create user story',
      'Estimate story points',
      'Generate sprint report',
      'Track bug status'
    ]
  };
  
  engine.registerCustomPattern(newPattern);
  console.log('Added JIRA pattern');
  
  // Test the new pattern
  const jiraUrl = 'https://mycompany.atlassian.net/browse/PROJ-123';
  const context = engine.analyzeWebsite(jiraUrl);
  const patterns = engine.getMatchingPatterns(context);
  
  console.log(`\nTesting JIRA URL: ${jiraUrl}`);
  console.log(`Custom matches: ${context.extractedData.customMatches}`);
  
  const customPattern = patterns.find(p => !p.isBuiltIn);
  if (customPattern) {
    console.log(`Found custom pattern: ${customPattern.name}`);
    console.log('Suggestions:');
    customPattern.suggestions.forEach(suggestion => {
      console.log(`  - ${suggestion.title}`);
    });
  }
  
  // Show all custom patterns
  const allCustomPatterns = engine.getCustomPatterns();
  console.log(`\nTotal custom patterns: ${allCustomPatterns.length}`);
  allCustomPatterns.forEach(pattern => {
    console.log(`  - ${pattern.name} (${pattern.urlPattern})`);
  });
}

/**
 * Run all examples
 */
export function runAllExamples() {
  console.log('🚀 Website Pattern Recognition Engine Examples\n');
  
  try {
    exampleBasicAnalysis();
    exampleCustomPatterns();
    exampleContentExtraction();
    examplePatternManagement();
    
    console.log('\n✅ All examples completed successfully!');
  } catch (error) {
    console.error('❌ Error running examples:', error);
  }
}

// Run examples if this file is executed directly
if (typeof window === 'undefined' && typeof process !== 'undefined') {
  // Node.js environment (for testing)
  runAllExamples();
}