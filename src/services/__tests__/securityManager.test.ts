/**
 * Tests for SecurityManager service
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SecurityManager } from '../securityManager';
import { 
  PageContent, 
  SecurityLevel, 
  WebsiteContext, 
  AIRequest,
  TaskType,
  OutputFormat,
  WebsiteCategory,
  PageType,
  FormElement
} from '../../types';

describe('SecurityManager', () => {
  let securityManager: SecurityManager;

  beforeEach(() => {
    securityManager = new SecurityManager();
  });

  describe('sanitizePageContent', () => {
    const mockPageContent: PageContent = {
      url: 'https://example.com',
      title: 'Test Page',
      headings: ['Welcome', 'Contact us at support@example.com'],
      textContent: 'Call us at 555-123-4567 or email support@example.com. Credit card: 4532-1234-5678-9012. ' + 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(20),
      forms: [
        {
          id: 'login-form',
          name: 'login',
          type: 'text',
          placeholder: 'Enter username',
          required: true,
          value: 'testuser'
        },
        {
          id: 'password-field',
          name: 'password',
          type: 'password',
          placeholder: 'Enter password',
          required: true,
          value: 'secret123'
        }
      ],
      links: [
        {
          href: 'https://example.com/contact',
          text: 'Contact Us'
        },
        {
          href: 'https://user:pass@secure.example.com/api',
          text: 'API Access'
        }
      ],
      metadata: {
        'description': 'A test page',
        'csrf-token': 'abc123xyz',
        'author': 'Test Author'
      },
      extractedAt: new Date()
    };

    it('should sanitize content at PUBLIC security level', () => {
      const sanitized = securityManager.sanitizePageContent(mockPageContent, SecurityLevel.PUBLIC);

      expect(sanitized.textContent).toContain('[CREDIT_CARD_REDACTED]');
      expect(sanitized.textContent).not.toContain('4532-1234-5678-9012');
      expect(sanitized.headings[1]).toContain('[EMAIL_REDACTED]');
      expect(sanitized.forms).toHaveLength(1); // Password field should be removed
      expect(sanitized.links).toHaveLength(1); // Auth URL should be removed
      expect(sanitized.metadata).not.toHaveProperty('csrf-token');
      expect(sanitized.removedSensitiveFields).toContain('forms');
    });

    it('should sanitize content at CAUTIOUS security level', () => {
      const sanitized = securityManager.sanitizePageContent(mockPageContent, SecurityLevel.CAUTIOUS);

      expect(sanitized.textContent).toContain('[CREDIT_CARD_REDACTED]');
      expect(sanitized.textContent).toContain('[PHONE_REDACTED]');
      expect(sanitized.textContent).toContain('[EMAIL_REDACTED]');
      expect(sanitized.forms).toHaveLength(1);
      expect(sanitized.sanitizationLevel).toBe(SecurityLevel.CAUTIOUS);
    });

    it('should sanitize content at RESTRICTED security level', () => {
      const sanitized = securityManager.sanitizePageContent(mockPageContent, SecurityLevel.RESTRICTED);

      expect(sanitized.textContent).toContain('[CREDIT_CARD_REDACTED]');
      expect(sanitized.textContent).toContain('[PHONE_REDACTED]');
      expect(sanitized.textContent).toContain('[EMAIL_REDACTED]');
      // Check that content was truncated (should contain truncation marker)
      expect(sanitized.textContent).toContain('[TRUNCATED]');
      expect(sanitized.forms).toHaveLength(1);
    });

    it('should handle empty or invalid content gracefully', () => {
      const emptyContent: PageContent = {
        url: '',
        title: '',
        headings: [],
        textContent: '',
        forms: [],
        links: [],
        metadata: {},
        extractedAt: new Date()
      };

      const sanitized = securityManager.sanitizePageContent(emptyContent);
      expect(sanitized.removedSensitiveFields).toHaveLength(0);
    });
  });

  describe('containsSensitiveData', () => {
    it('should detect credit card numbers', () => {
      expect(securityManager.containsSensitiveData('4532-1234-5678-9012')).toBe(true);
      expect(securityManager.containsSensitiveData('4532 1234 5678 9012')).toBe(true);
      expect(securityManager.containsSensitiveData('4532123456789012')).toBe(true);
    });

    it('should detect SSN numbers', () => {
      expect(securityManager.containsSensitiveData('123-45-6789')).toBe(true);
      expect(securityManager.containsSensitiveData('123456789')).toBe(true);
    });

    it('should detect email addresses', () => {
      expect(securityManager.containsSensitiveData('user@example.com')).toBe(true);
      expect(securityManager.containsSensitiveData('test.email+tag@domain.co.uk')).toBe(true);
    });

    it('should detect phone numbers', () => {
      expect(securityManager.containsSensitiveData('555-123-4567')).toBe(true);
      expect(securityManager.containsSensitiveData('(555) 123-4567')).toBe(true);
      expect(securityManager.containsSensitiveData('+1-555-123-4567')).toBe(true);
    });

    it('should detect API keys and tokens', () => {
      expect(securityManager.containsSensitiveData('api_key=abc123def456ghi789')).toBe(true);
      expect(securityManager.containsSensitiveData('token: "xyz789abc123def456"')).toBe(true);
    });

    it('should detect passwords', () => {
      expect(securityManager.containsSensitiveData('password=secret123')).toBe(true);
      expect(securityManager.containsSensitiveData('pwd: "mypassword"')).toBe(true);
    });

    it('should detect authentication URLs', () => {
      expect(securityManager.containsSensitiveData('https://user:pass@api.example.com')).toBe(true);
    });

    it('should not flag normal text', () => {
      expect(securityManager.containsSensitiveData('This is normal text')).toBe(false);
      expect(securityManager.containsSensitiveData('Contact us for more information')).toBe(false);
    });

    it('should handle empty or null input', () => {
      expect(securityManager.containsSensitiveData('')).toBe(false);
      expect(securityManager.containsSensitiveData(null as any)).toBe(false);
      expect(securityManager.containsSensitiveData(undefined as any)).toBe(false);
    });
  });

  describe('validateWebsitePermissions', () => {
    it('should return RESTRICTED for banking domains', () => {
      expect(securityManager.validateWebsitePermissions('mybank.com')).toBe(SecurityLevel.RESTRICTED);
      expect(securityManager.validateWebsitePermissions('creditunion.org')).toBe(SecurityLevel.RESTRICTED);
      expect(securityManager.validateWebsitePermissions('financial-services.com')).toBe(SecurityLevel.RESTRICTED);
    });

    it('should return RESTRICTED for healthcare domains', () => {
      expect(securityManager.validateWebsitePermissions('hospital.com')).toBe(SecurityLevel.RESTRICTED);
      expect(securityManager.validateWebsitePermissions('medical-center.org')).toBe(SecurityLevel.RESTRICTED);
      expect(securityManager.validateWebsitePermissions('patient-portal.com')).toBe(SecurityLevel.RESTRICTED);
    });

    it('should return RESTRICTED for government domains', () => {
      expect(securityManager.validateWebsitePermissions('irs.gov')).toBe(SecurityLevel.RESTRICTED);
      expect(securityManager.validateWebsitePermissions('social-security.gov')).toBe(SecurityLevel.RESTRICTED);
    });

    it('should return CAUTIOUS for user account domains', () => {
      expect(securityManager.validateWebsitePermissions('login.example.com')).toBe(SecurityLevel.CAUTIOUS);
      expect(securityManager.validateWebsitePermissions('account.service.com')).toBe(SecurityLevel.CAUTIOUS);
      expect(securityManager.validateWebsitePermissions('my-dashboard.com')).toBe(SecurityLevel.CAUTIOUS);
    });

    it('should return PUBLIC for general domains', () => {
      expect(securityManager.validateWebsitePermissions('example.com')).toBe(SecurityLevel.PUBLIC);
      expect(securityManager.validateWebsitePermissions('news.com')).toBe(SecurityLevel.PUBLIC);
      expect(securityManager.validateWebsitePermissions('blog.example.org')).toBe(SecurityLevel.PUBLIC);
    });

    it('should cache results for performance', () => {
      const domain = 'test-cache.com';
      const result1 = securityManager.validateWebsitePermissions(domain);
      const result2 = securityManager.validateWebsitePermissions(domain);
      
      expect(result1).toBe(result2);
      expect(result1).toBe(SecurityLevel.PUBLIC);
    });
  });

  describe('generateSecurityWarnings', () => {
    const mockContext: WebsiteContext = {
      domain: 'bank.com',
      category: WebsiteCategory.PROFESSIONAL,
      pageType: PageType.FORM,
      extractedData: {},
      securityLevel: SecurityLevel.RESTRICTED,
      timestamp: new Date()
    };

    const mockRequest: AIRequest = {
      prompt: 'Help me fill out this form',
      context: mockContext,
      taskType: TaskType.GENERATE_TEXT,
      outputFormat: OutputFormat.PLAIN_TEXT,
      constraints: {
        allowSensitiveData: false,
        maxContentLength: 1000,
        allowedDomains: ['bank.com'],
        restrictedSelectors: []
      },
      timestamp: new Date()
    };

    it('should generate warnings for restricted sites', () => {
      const warnings = securityManager.generateSecurityWarnings(mockContext, mockRequest);
      
      const restrictedWarning = warnings.find(w => w.code === 'RESTRICTED_SITE');
      expect(restrictedWarning).toBeDefined();
      expect(restrictedWarning?.level).toBe('error');
    });

    it('should generate warnings for sensitive data in requests', () => {
      const sensitiveRequest = {
        ...mockRequest,
        prompt: 'My SSN is 123-45-6789'
      };

      const warnings = securityManager.generateSecurityWarnings(mockContext, sensitiveRequest);
      
      const sensitiveWarning = warnings.find(w => w.code === 'SENSITIVE_DATA_DETECTED');
      expect(sensitiveWarning).toBeDefined();
      expect(sensitiveWarning?.level).toBe('warning');
    });

    it('should generate warnings for automation on restricted sites', () => {
      const automationRequest = {
        ...mockRequest,
        taskType: TaskType.AUTOMATE_ACTION as TaskType
      };

      const warnings = securityManager.generateSecurityWarnings(mockContext, automationRequest);
      
      const automationWarning = warnings.find(w => w.code === 'AUTOMATION_RESTRICTED');
      expect(automationWarning).toBeDefined();
      expect(automationWarning?.level).toBe('warning');
    });

    it('should generate info about disabled data sharing', () => {
      const warnings = securityManager.generateSecurityWarnings(mockContext, mockRequest);
      
      const dataSharingWarning = warnings.find(w => w.code === 'DATA_SHARING_DISABLED');
      expect(dataSharingWarning).toBeDefined();
      expect(dataSharingWarning?.level).toBe('info');
    });

    it('should return empty array for safe contexts', () => {
      const safeContext = {
        ...mockContext,
        securityLevel: SecurityLevel.PUBLIC,
        domain: 'example.com'
      };

      const safeRequest = {
        ...mockRequest,
        prompt: 'Help me write a blog post',
        context: safeContext
      };

      const warnings = securityManager.generateSecurityWarnings(safeContext, safeRequest);
      expect(warnings).toHaveLength(0);
    });
  });

  describe('checkDataSharingConsent', () => {
    it('should allow data sharing for PUBLIC sites', () => {
      const publicContext: WebsiteContext = {
        domain: 'example.com',
        category: WebsiteCategory.NEWS_CONTENT,
        pageType: PageType.ARTICLE,
        extractedData: {},
        securityLevel: SecurityLevel.PUBLIC,
        timestamp: new Date()
      };

      expect(securityManager.checkDataSharingConsent('pageContent', publicContext)).toBe(true);
      expect(securityManager.checkDataSharingConsent('aiProcessing', publicContext)).toBe(true);
      expect(securityManager.checkDataSharingConsent('automation', publicContext)).toBe(true);
      expect(securityManager.checkDataSharingConsent('formData', publicContext)).toBe(false);
    });

    it('should restrict data sharing for CAUTIOUS sites', () => {
      const cautiousContext: WebsiteContext = {
        domain: 'account.example.com',
        category: WebsiteCategory.PROFESSIONAL,
        pageType: PageType.PROFILE,
        extractedData: {},
        securityLevel: SecurityLevel.CAUTIOUS,
        timestamp: new Date()
      };

      expect(securityManager.checkDataSharingConsent('pageContent', cautiousContext)).toBe(true);
      expect(securityManager.checkDataSharingConsent('aiProcessing', cautiousContext)).toBe(true);
      expect(securityManager.checkDataSharingConsent('automation', cautiousContext)).toBe(false);
      expect(securityManager.checkDataSharingConsent('formData', cautiousContext)).toBe(false);
    });

    it('should block data sharing for RESTRICTED sites', () => {
      const restrictedContext: WebsiteContext = {
        domain: 'bank.com',
        category: WebsiteCategory.PROFESSIONAL,
        pageType: PageType.FORM,
        extractedData: {},
        securityLevel: SecurityLevel.RESTRICTED,
        timestamp: new Date()
      };

      expect(securityManager.checkDataSharingConsent('pageContent', restrictedContext)).toBe(false);
      expect(securityManager.checkDataSharingConsent('aiProcessing', restrictedContext)).toBe(false);
      expect(securityManager.checkDataSharingConsent('automation', restrictedContext)).toBe(false);
      expect(securityManager.checkDataSharingConsent('formData', restrictedContext)).toBe(false);
    });
  });

  describe('createSecurityConstraints', () => {
    it('should create strict constraints for RESTRICTED sites', () => {
      const restrictedContext: WebsiteContext = {
        domain: 'bank.com',
        category: WebsiteCategory.PROFESSIONAL,
        pageType: PageType.FORM,
        extractedData: {},
        securityLevel: SecurityLevel.RESTRICTED,
        timestamp: new Date()
      };

      const constraints = securityManager.createSecurityConstraints(restrictedContext);

      expect(constraints.allowSensitiveData).toBe(false);
      expect(constraints.maxContentLength).toBe(1000);
      expect(constraints.restrictedSelectors).toContain('input[type="password"]');
      expect(constraints.restrictedSelectors).toContain('input[name*="credit"]');
    });

    it('should create moderate constraints for CAUTIOUS sites', () => {
      const cautiousContext: WebsiteContext = {
        domain: 'account.example.com',
        category: WebsiteCategory.PROFESSIONAL,
        pageType: PageType.PROFILE,
        extractedData: {},
        securityLevel: SecurityLevel.CAUTIOUS,
        timestamp: new Date()
      };

      const constraints = securityManager.createSecurityConstraints(cautiousContext);

      expect(constraints.allowSensitiveData).toBe(false);
      expect(constraints.maxContentLength).toBe(5000);
      expect(constraints.restrictedSelectors).toContain('input[type="password"]');
      expect(constraints.restrictedSelectors).not.toContain('input[name*="credit"]');
    });

    it('should create minimal constraints for PUBLIC sites', () => {
      const publicContext: WebsiteContext = {
        domain: 'example.com',
        category: WebsiteCategory.NEWS_CONTENT,
        pageType: PageType.ARTICLE,
        extractedData: {},
        securityLevel: SecurityLevel.PUBLIC,
        timestamp: new Date()
      };

      const constraints = securityManager.createSecurityConstraints(publicContext);

      expect(constraints.allowSensitiveData).toBe(false);
      expect(constraints.maxContentLength).toBe(10000);
      expect(constraints.restrictedSelectors).toHaveLength(0);
    });
  });

  describe('clearCache', () => {
    it('should clear internal caches', () => {
      // Populate caches
      securityManager.containsSensitiveData('test@example.com');
      securityManager.validateWebsitePermissions('example.com');

      // Clear caches
      securityManager.clearCache();

      // This test mainly ensures the method doesn't throw
      expect(() => securityManager.clearCache()).not.toThrow();
    });
  });

  describe('form field sensitivity detection', () => {
    it('should detect sensitive form fields by type', () => {
      const passwordField: FormElement = {
        type: 'password',
        required: true
      };

      const emailField: FormElement = {
        type: 'email',
        required: false
      };

      const textField: FormElement = {
        type: 'text',
        required: false
      };

      const content: PageContent = {
        url: 'https://example.com',
        title: 'Test',
        headings: [],
        textContent: '',
        forms: [passwordField, emailField, textField],
        links: [],
        metadata: {},
        extractedAt: new Date()
      };

      const sanitized = securityManager.sanitizePageContent(content);
      
      // Only the text field should remain
      expect(sanitized.forms).toHaveLength(1);
      expect(sanitized.forms[0].type).toBe('text');
    });

    it('should detect sensitive form fields by name', () => {
      const creditCardField: FormElement = {
        name: 'credit-card-number',
        type: 'text',
        required: true
      };

      const normalField: FormElement = {
        name: 'username',
        type: 'text',
        required: false
      };

      const content: PageContent = {
        url: 'https://example.com',
        title: 'Test',
        headings: [],
        textContent: '',
        forms: [creditCardField, normalField],
        links: [],
        metadata: {},
        extractedAt: new Date()
      };

      const sanitized = securityManager.sanitizePageContent(content);
      
      // Only the username field should remain
      expect(sanitized.forms).toHaveLength(1);
      expect(sanitized.forms[0].name).toBe('username');
    });
  });
});