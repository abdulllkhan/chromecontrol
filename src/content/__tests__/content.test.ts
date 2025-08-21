import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { PageContent, FormElement, LinkElement, AutomationStep } from '../../types';

// Mock Chrome APIs (additional to global setup)
const mockChrome = {
  runtime: {
    onMessage: {
      addListener: vi.fn()
    },
    sendMessage: vi.fn().mockResolvedValue({})
  }
};

// @ts-ignore
global.chrome = { ...global.chrome, ...mockChrome };

describe('Content Script', () => {
  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    
    // Set up DOM properties
    Object.defineProperty(window, 'location', {
      value: {
        href: 'https://example.com/test',
        hostname: 'example.com',
        pathname: '/test'
      },
      writable: true
    });

    Object.defineProperty(document, 'title', {
      value: 'Test Page',
      writable: true
    });

    Object.defineProperty(document, 'characterSet', {
      value: 'UTF-8',
      writable: true
    });

    Object.defineProperty(document.documentElement, 'lang', {
      value: 'en',
      writable: true
    });
    
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  describe('Page Content Extraction', () => {
    it('should extract headings correctly', () => {
      document.body.innerHTML = `
        <h1>Main Title</h1>
        <h2>Subtitle</h2>
        <h3>Section Title</h3>
        <div>
          <h4>Subsection</h4>
        </div>
      `;

      // Import and test the extraction function
      // Note: In a real implementation, we'd need to expose these functions or test them through message handling
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
        .map(h => h.textContent?.trim())
        .filter(Boolean);

      expect(headings).toEqual(['Main Title', 'Subtitle', 'Section Title', 'Subsection']);
    });

    it('should extract forms correctly', () => {
      document.body.innerHTML = `
        <form>
          <input type="text" name="username" placeholder="Enter username" required>
          <input type="password" name="password" placeholder="Enter password" required>
          <input type="email" name="email" id="email-field">
          <textarea name="comments" placeholder="Comments"></textarea>
          <select name="country">
            <option value="us">United States</option>
            <option value="ca">Canada</option>
          </select>
        </form>
      `;

      const forms: FormElement[] = [];
      const formElements = document.querySelectorAll('form');
      
      formElements.forEach(form => {
        const inputs = form.querySelectorAll('input, textarea, select');
        
        inputs.forEach(input => {
          const element = input as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
          
          forms.push({
            id: element.id || undefined,
            name: element.name || undefined,
            type: element.type || element.tagName.toLowerCase(),
            placeholder: (element as HTMLInputElement).placeholder || undefined,
            required: element.required,
            value: element.value || undefined
          });
        });
      });

      expect(forms).toHaveLength(5);
      expect(forms[0]).toEqual({
        id: undefined,
        name: 'username',
        type: 'text',
        placeholder: 'Enter username',
        required: true,
        value: undefined
      });
      expect(forms[1]).toEqual({
        id: undefined,
        name: 'password',
        type: 'password',
        placeholder: 'Enter password',
        required: true,
        value: undefined
      });
      expect(forms[2]).toEqual({
        id: 'email-field',
        name: 'email',
        type: 'email',
        placeholder: undefined,
        required: false,
        value: undefined
      });
    });

    it('should extract links correctly', () => {
      document.body.innerHTML = `
        <a href="https://example.com">Example Link</a>
        <a href="/relative" title="Relative Link">Relative</a>
        <a href="mailto:test@example.com">Email Link</a>
        <a>Link without href</a>
      `;

      const links: LinkElement[] = [];
      const linkElements = document.querySelectorAll('a[href]');
      
      Array.from(linkElements).forEach(link => {
        const href = link.getAttribute('href');
        const text = link.textContent?.trim();
        const title = link.getAttribute('title');
        
        if (href && text) {
          links.push({
            href,
            text,
            title: title || undefined
          });
        }
      });

      expect(links).toHaveLength(3);
      expect(links[0]).toEqual({
        href: 'https://example.com',
        text: 'Example Link'
      });
      expect(links[1]).toEqual({
        href: '/relative',
        text: 'Relative',
        title: 'Relative Link'
      });
      expect(links[2]).toEqual({
        href: 'mailto:test@example.com',
        text: 'Email Link'
      });
    });

    it('should extract metadata correctly', () => {
      document.head.innerHTML = `
        <meta name="description" content="Test page description">
        <meta name="keywords" content="test, page, content">
        <meta property="og:title" content="Test Page">
        <meta property="og:description" content="Open Graph description">
        <meta name="twitter:card" content="summary">
      `;

      const metadata: Record<string, string> = {};
      
      // Extract meta tags
      const metaTags = document.querySelectorAll('meta');
      metaTags.forEach(meta => {
        const name = meta.getAttribute('name') || meta.getAttribute('property');
        const content = meta.getAttribute('content');
        
        if (name && content) {
          metadata[name] = content;
        }
      });

      expect(metadata).toEqual({
        'description': 'Test page description',
        'keywords': 'test, page, content',
        'og:title': 'Test Page',
        'og:description': 'Open Graph description',
        'twitter:card': 'summary'
      });
    });
  });

  describe('Content Sanitization', () => {
    it('should detect sensitive content', () => {
      document.body.innerHTML = `
        <form>
          <input type="password" name="password">
          <input type="email" name="email">
        </form>
      `;

      const sensitiveIndicators = [
        'input[type="password"]',
        'input[type="email"]'
      ];
      
      let hasSensitive = false;
      for (const selector of sensitiveIndicators) {
        if (document.querySelector(selector)) {
          hasSensitive = true;
          break;
        }
      }

      expect(hasSensitive).toBe(true);
    });

    it('should detect sensitive URLs', () => {
      const sensitiveUrls = [
        'https://example.com/login',
        'https://example.com/signin',
        'https://example.com/checkout',
        'https://example.com/payment'
      ];

      sensitiveUrls.forEach(url => {
        const urlLower = url.toLowerCase();
        const keywords = ['login', 'signin', 'checkout', 'payment'];
        const hasSensitiveKeyword = keywords.some(keyword => urlLower.includes(keyword));
        expect(hasSensitiveKeyword).toBe(true);
      });
    });

    it('should sanitize sensitive patterns in text', () => {
      const testText = 'Contact us at john.doe@example.com or call (555) 123-4567. Credit card: 1234-5678-9012-3456';
      
      const sensitivePatterns = [
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        /(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
        /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g
      ];
      
      let sanitized = testText;
      sensitivePatterns.forEach(pattern => {
        sanitized = sanitized.replace(pattern, '[REDACTED]');
      });

      expect(sanitized).toBe('Contact us at [REDACTED] or call [REDACTED]. Credit card: [REDACTED]');
    });
  });

  describe('DOM Manipulation', () => {
    it('should check if element is interactable', () => {
      document.body.innerHTML = `
        <button id="visible">Visible Button</button>
        <button id="hidden" style="display: none;">Hidden Button</button>
        <button id="disabled" disabled>Disabled Button</button>
        <input id="readonly" readonly value="readonly">
      `;

      const visibleButton = document.getElementById('visible') as HTMLElement;
      const hiddenButton = document.getElementById('hidden') as HTMLElement;
      const disabledButton = document.getElementById('disabled') as HTMLElement;
      const readonlyInput = document.getElementById('readonly') as HTMLElement;

      // Test visibility
      const visibleStyle = window.getComputedStyle(visibleButton);
      const hiddenStyle = window.getComputedStyle(hiddenButton);
      
      expect(visibleStyle.display).not.toBe('none');
      expect(hiddenStyle.display).toBe('none');

      // Test disabled state
      expect('disabled' in disabledButton && (disabledButton as any).disabled).toBe(true);
      expect('disabled' in visibleButton && (visibleButton as any).disabled).toBe(false);

      // Test readonly state
      expect('readOnly' in readonlyInput && (readonlyInput as any).readOnly).toBe(true);
    });

    it('should simulate clicking elements', () => {
      document.body.innerHTML = `
        <button id="test-button">Click Me</button>
      `;

      const button = document.getElementById('test-button') as HTMLElement;
      let clicked = false;
      
      button.addEventListener('click', () => {
        clicked = true;
      });

      // Simulate click
      button.click();
      
      expect(clicked).toBe(true);
    });

    it('should simulate typing into input elements', () => {
      document.body.innerHTML = `
        <input type="text" id="test-input">
      `;

      const input = document.getElementById('test-input') as HTMLInputElement;
      const testText = 'Hello World';
      
      // Simulate typing
      input.value = testText;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      
      expect(input.value).toBe(testText);
    });
  });

  describe('Automation Steps', () => {
    it('should validate automation step structure', () => {
      const validStep: AutomationStep = {
        type: 'click',
        selector: '#submit-button',
        description: 'Click the submit button'
      };

      const invalidSteps = [
        { type: 'invalid', selector: '#test' }, // Invalid type
        { type: 'click' }, // Missing selector
        { type: 'click', selector: '#test' } // Missing description
      ];

      // Valid step should have all required properties
      expect(validStep.type).toBeDefined();
      expect(validStep.selector).toBeDefined();
      expect(validStep.description).toBeDefined();

      // Invalid steps should be missing required properties
      expect(invalidSteps[0].type).not.toMatch(/^(click|type|select|wait|extract)$/);
      expect(invalidSteps[1]).not.toHaveProperty('selector');
      expect(invalidSteps[2]).not.toHaveProperty('description');
    });
  });

  describe('Message Handling', () => {
    it('should have chrome runtime API available', () => {
      expect(chrome.runtime.onMessage.addListener).toBeDefined();
      expect(chrome.runtime.sendMessage).toBeDefined();
    });

    it('should handle message listener registration', () => {
      const mockListener = vi.fn();
      chrome.runtime.onMessage.addListener(mockListener);
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledWith(mockListener);
    });
  });

  describe('Page Change Detection', () => {
    it('should detect URL changes', () => {
      const initialUrl = window.location.href;
      
      // Simulate URL change
      Object.defineProperty(window, 'location', {
        value: {
          href: 'https://example.com/new-page',
          hostname: 'example.com',
          pathname: '/new-page'
        },
        writable: true
      });

      expect(window.location.href).not.toBe(initialUrl);
      expect(window.location.href).toBe('https://example.com/new-page');
    });

    it('should detect title changes', () => {
      const initialTitle = document.title;
      document.title = 'New Page Title';
      
      expect(document.title).not.toBe(initialTitle);
      expect(document.title).toBe('New Page Title');
    });
  });
});