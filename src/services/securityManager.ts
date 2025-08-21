/**
 * Security Manager Service
 * 
 * Handles security and privacy protection for the Chrome extension:
 * - Content sanitization for AI requests
 * - Sensitive data detection and filtering
 * - Security level detection for different website types
 * - Privacy warning system for secure sites
 */

import { 
  PageContent, 
  SecurityLevel, 
  WebsiteContext, 
  AIRequest,
  SecurityConstraints,
  FormElement 
} from '../types';

// ============================================================================
// INTERFACES
// ============================================================================

export interface SanitizedPageContent {
  url: string;
  title: string;
  headings: string[];
  textContent: string;
  forms: SanitizedFormElement[];
  links: SanitizedLinkElement[];
  metadata: Record<string, string>;
  extractedAt: Date;
  sanitizationLevel: SecurityLevel;
  removedSensitiveFields: string[];
}

export interface SanitizedFormElement {
  id?: string;
  name?: string;
  type: string;
  placeholder?: string;
  required: boolean;
  // Note: value is intentionally omitted for security
}

export interface SanitizedLinkElement {
  href: string;
  text: string;
  title?: string;
}

export interface SecurityWarning {
  level: 'info' | 'warning' | 'error';
  message: string;
  code: string;
  details?: string;
}

export interface DataSharingConsent {
  pageContent: boolean;
  formData: boolean;
  automation: boolean;
  aiProcessing: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Patterns for detecting sensitive data
const SENSITIVE_PATTERNS = {
  // Credit card numbers (basic pattern)
  creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/,
  
  // Social Security Numbers (US format)
  ssn: /\b\d{3}-?\d{2}-?\d{4}\b/,
  
  // Email addresses
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
  
  // Phone numbers (various formats)
  phone: /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/,
  
  // API keys and tokens (common patterns)
  apiKey: /\b(?:api[_-]?key|token|secret)[_-]?[:=]\s*['""]?[a-zA-Z0-9_-]{16,}['""]?\b/i,
  
  // Passwords (in forms or text)
  password: /\b(?:password|passwd|pwd)[_-]?[:=]\s*['""]?[^\s'"",]{6,}['""]?\b/i,
  
  // Bank account numbers (basic pattern)
  bankAccount: /\b\d{8,17}\b/,
  
  // IP addresses
  ipAddress: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/,
  
  // URLs with authentication
  authUrl: /https?:\/\/[^\/\s]*:[^@\/\s]*@[^\s]+/
};

// Sensitive form field types and names
const SENSITIVE_FORM_FIELDS = {
  types: ['password', 'email', 'tel', 'number'],
  names: [
    'password', 'passwd', 'pwd', 'pass',
    'email', 'mail', 'e-mail',
    'phone', 'tel', 'telephone', 'mobile',
    'ssn', 'social', 'security',
    'credit', 'card', 'cc', 'cvv', 'cvc',
    'account', 'routing', 'bank',
    'token', 'key', 'secret', 'api'
  ],
  patterns: [
    /password/i, /email/i, /phone/i, /ssn/i, /social/i,
    /credit/i, /card/i, /cvv/i, /cvc/i, /account/i,
    /routing/i, /bank/i, /token/i, /key/i, /secret/i
  ]
};

// Secure domains that require extra caution
const SECURE_DOMAINS = [
  // Banking
  'bank', 'banking', 'credit', 'loan', 'mortgage', 'finance', 'financial',
  
  // Healthcare
  'health', 'medical', 'hospital', 'clinic', 'doctor', 'patient',
  
  // Government
  'gov', 'government', 'irs', 'tax', 'social', 'security',
  
  // Legal
  'legal', 'law', 'attorney', 'lawyer', 'court',
  
  // Education (student records)
  'student', 'grade', 'transcript', 'education'
];

// ============================================================================
// SECURITY MANAGER CLASS
// ============================================================================

export class SecurityManager {
  private sensitiveDataCache = new Map<string, boolean>();
  private securityLevelCache = new Map<string, SecurityLevel>();

  /**
   * Sanitizes page content for AI requests by removing sensitive data
   */
  sanitizePageContent(
    content: PageContent, 
    securityLevel: SecurityLevel = SecurityLevel.CAUTIOUS
  ): SanitizedPageContent {
    const removedSensitiveFields: string[] = [];

    // Sanitize text content
    const sanitizedTextContent = this.sanitizeText(content.textContent, securityLevel);
    if (sanitizedTextContent !== content.textContent) {
      removedSensitiveFields.push('textContent');
    }

    // Sanitize headings
    const sanitizedHeadings = content.headings.map(heading => 
      this.sanitizeText(heading, securityLevel)
    );

    // Sanitize forms (remove sensitive fields and values)
    const sanitizedForms = this.sanitizeForms(content.forms, securityLevel);
    if (sanitizedForms.length < content.forms.length) {
      removedSensitiveFields.push('forms');
    }

    // Sanitize links (remove auth URLs)
    const sanitizedLinks = content.links
      .filter(link => !this.containsSensitiveData(link.href))
      .map(link => ({
        href: this.sanitizeText(link.href, securityLevel),
        text: this.sanitizeText(link.text, securityLevel),
        title: link.title ? this.sanitizeText(link.title, securityLevel) : undefined
      }));

    // Sanitize metadata
    const sanitizedMetadata: Record<string, string> = {};
    for (const [key, value] of Object.entries(content.metadata)) {
      if (!this.isSensitiveMetadataKey(key)) {
        sanitizedMetadata[key] = this.sanitizeText(value, securityLevel);
      } else {
        removedSensitiveFields.push(`metadata.${key}`);
      }
    }

    return {
      url: content.url,
      title: this.sanitizeText(content.title, securityLevel),
      headings: sanitizedHeadings,
      textContent: sanitizedTextContent,
      forms: sanitizedForms,
      links: sanitizedLinks,
      metadata: sanitizedMetadata,
      extractedAt: content.extractedAt,
      sanitizationLevel: securityLevel,
      removedSensitiveFields
    };
  }

  /**
   * Detects and filters sensitive data from text
   */
  private sanitizeText(text: string, securityLevel: SecurityLevel): string {
    if (!text || typeof text !== 'string') {
      return text;
    }

    let sanitized = text;

    // Apply different levels of sanitization based on security level
    switch (securityLevel) {
      case SecurityLevel.RESTRICTED:
        // Most aggressive sanitization
        sanitized = this.truncateText(sanitized, 500); // Limit text length first
        sanitized = this.applySensitivePatterns(sanitized, true);
        break;

      case SecurityLevel.CAUTIOUS:
        // Moderate sanitization
        sanitized = this.applySensitivePatterns(sanitized, false);
        sanitized = this.truncateText(sanitized, 2000);
        break;

      case SecurityLevel.PUBLIC:
        // Light sanitization - only remove obvious sensitive data
        sanitized = this.removeObviousSensitiveData(sanitized);
        sanitized = this.truncateText(sanitized, 5000);
        break;
    }

    return sanitized;
  }

  /**
   * Applies sensitive data patterns to remove or mask sensitive information
   */
  private applySensitivePatterns(text: string, aggressive: boolean): string {
    let sanitized = text;

    for (const [patternName, pattern] of Object.entries(SENSITIVE_PATTERNS)) {
      if (aggressive || this.isHighRiskPattern(patternName)) {
        // Create global version of pattern for replacement
        const globalPattern = new RegExp(pattern.source, pattern.flags + 'g');
        sanitized = sanitized.replace(globalPattern, this.getMaskForPattern(patternName));
      }
    }

    return sanitized;
  }

  /**
   * Removes obviously sensitive data (less aggressive)
   */
  private removeObviousSensitiveData(text: string): string {
    let sanitized = text;

    // Only remove high-risk patterns in public mode
    const highRiskPatterns = ['creditCard', 'ssn', 'password', 'apiKey', 'authUrl', 'email', 'phone'];
    
    for (const patternName of highRiskPatterns) {
      const pattern = SENSITIVE_PATTERNS[patternName as keyof typeof SENSITIVE_PATTERNS];
      if (pattern) {
        // Create global version of pattern for replacement
        const globalPattern = new RegExp(pattern.source, pattern.flags + 'g');
        sanitized = sanitized.replace(globalPattern, this.getMaskForPattern(patternName));
      }
    }

    return sanitized;
  }

  /**
   * Determines if a pattern is high risk
   */
  private isHighRiskPattern(patternName: string): boolean {
    const highRiskPatterns = ['creditCard', 'ssn', 'password', 'apiKey', 'bankAccount', 'authUrl', 'email', 'phone'];
    return highRiskPatterns.includes(patternName);
  }

  /**
   * Gets appropriate mask for different types of sensitive data
   */
  private getMaskForPattern(patternName: string): string {
    const masks: Record<string, string> = {
      creditCard: '[CREDIT_CARD_REDACTED]',
      ssn: '[SSN_REDACTED]',
      email: '[EMAIL_REDACTED]',
      phone: '[PHONE_REDACTED]',
      apiKey: '[API_KEY_REDACTED]',
      password: '[PASSWORD_REDACTED]',
      bankAccount: '[ACCOUNT_REDACTED]',
      ipAddress: '[IP_REDACTED]',
      authUrl: '[AUTH_URL_REDACTED]'
    };

    return masks[patternName] || '[SENSITIVE_DATA_REDACTED]';
  }

  /**
   * Truncates text to specified length
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }

    return text.substring(0, maxLength) + '... [TRUNCATED]';
  }

  /**
   * Sanitizes form elements by removing sensitive fields
   */
  private sanitizeForms(forms: FormElement[], securityLevel: SecurityLevel): SanitizedFormElement[] {
    return forms
      .filter(form => !this.isSensitiveFormField(form))
      .map(form => ({
        id: form.id,
        name: form.name,
        type: form.type,
        placeholder: form.placeholder ? this.sanitizeText(form.placeholder, securityLevel) : undefined,
        required: form.required
        // Note: value is intentionally omitted
      }));
  }

  /**
   * Checks if a form field contains sensitive data
   */
  private isSensitiveFormField(field: FormElement): boolean {
    // Check field type
    if (SENSITIVE_FORM_FIELDS.types.includes(field.type.toLowerCase())) {
      return true;
    }

    // Check field name
    const fieldName = (field.name || field.id || '').toLowerCase();
    if (SENSITIVE_FORM_FIELDS.names.some(name => fieldName.includes(name))) {
      return true;
    }

    // Check against patterns
    if (SENSITIVE_FORM_FIELDS.patterns.some(pattern => pattern.test(fieldName))) {
      return true;
    }

    // Check field value for sensitive patterns
    if (field.value && this.containsSensitiveData(field.value)) {
      return true;
    }

    return false;
  }

  /**
   * Checks if metadata key is sensitive
   */
  private isSensitiveMetadataKey(key: string): boolean {
    const sensitiveKeys = [
      'csrf', 'token', 'session', 'auth', 'key', 'secret',
      'password', 'user', 'login', 'account'
    ];

    const lowerKey = key.toLowerCase();
    return sensitiveKeys.some(sensitiveKey => lowerKey.includes(sensitiveKey));
  }

  /**
   * Detects if text contains sensitive data
   */
  containsSensitiveData(text: string): boolean {
    if (!text || typeof text !== 'string') {
      return false;
    }

    // Check cache first
    const cacheKey = this.hashString(text);
    if (this.sensitiveDataCache.has(cacheKey)) {
      return this.sensitiveDataCache.get(cacheKey)!;
    }

    // Check against all sensitive patterns
    for (const pattern of Object.values(SENSITIVE_PATTERNS)) {
      if (pattern.test(text)) {
        this.sensitiveDataCache.set(cacheKey, true);
        return true;
      }
    }

    this.sensitiveDataCache.set(cacheKey, false);
    return false;
  }

  /**
   * Determines security level for a website
   */
  validateWebsitePermissions(domain: string): SecurityLevel {
    // Check cache first
    if (this.securityLevelCache.has(domain)) {
      return this.securityLevelCache.get(domain)!;
    }

    const lowerDomain = domain.toLowerCase();
    let securityLevel = SecurityLevel.PUBLIC;

    // Check for secure domains
    if (this.isSecureDomain(lowerDomain)) {
      securityLevel = SecurityLevel.RESTRICTED;
    } else if (this.isCautiousDomain(lowerDomain)) {
      securityLevel = SecurityLevel.CAUTIOUS;
    }

    // Check for HTTPS requirement
    if (securityLevel === SecurityLevel.RESTRICTED && !this.isHttpsDomain(domain)) {
      // Downgrade if not HTTPS
      securityLevel = SecurityLevel.CAUTIOUS;
    }

    this.securityLevelCache.set(domain, securityLevel);
    return securityLevel;
  }

  /**
   * Checks if domain is considered secure/sensitive
   */
  private isSecureDomain(domain: string): boolean {
    return SECURE_DOMAINS.some(keyword => domain.includes(keyword));
  }

  /**
   * Checks if domain requires cautious handling
   */
  private isCautiousDomain(domain: string): boolean {
    // Social media platforms that handle personal data
    const socialMediaDomains = [
      'facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'linkedin.com',
      'tiktok.com', 'snapchat.com', 'reddit.com', 'discord.com', 'telegram.org'
    ];

    // Check for exact social media domain matches
    if (socialMediaDomains.some(socialDomain => domain.includes(socialDomain))) {
      return true;
    }

    // Domains that handle user accounts or personal data
    const cautiousKeywords = [
      'login', 'account', 'profile', 'dashboard', 'admin',
      'secure', 'private', 'member', 'user', 'my'
    ];

    return cautiousKeywords.some(keyword => domain.includes(keyword));
  }

  /**
   * Checks if domain uses HTTPS (simplified check)
   */
  private isHttpsDomain(domain: string): boolean {
    // In a real implementation, this would check the actual protocol
    // For now, assume most modern sites use HTTPS
    return true;
  }

  /**
   * Generates security warnings for different scenarios
   */
  generateSecurityWarnings(context: WebsiteContext, request: AIRequest): SecurityWarning[] {
    const warnings: SecurityWarning[] = [];

    // Check security level
    if (context.securityLevel === SecurityLevel.RESTRICTED) {
      warnings.push({
        level: 'error',
        message: 'This appears to be a secure website (banking, healthcare, government). AI processing is restricted.',
        code: 'RESTRICTED_SITE',
        details: 'Consider using manual methods for sensitive operations on this site.'
      });
    }

    // Check for sensitive data in request
    if (this.containsSensitiveData(request.prompt)) {
      warnings.push({
        level: 'warning',
        message: 'Your request may contain sensitive information.',
        code: 'SENSITIVE_DATA_DETECTED',
        details: 'Sensitive data will be filtered before sending to AI services.'
      });
    }

    // Check automation permissions
    if (request.taskType === 'automate_action' && context.securityLevel !== SecurityLevel.PUBLIC) {
      warnings.push({
        level: 'warning',
        message: 'Automation on this site may require additional permissions.',
        code: 'AUTOMATION_RESTRICTED',
        details: 'Please review automation steps carefully before proceeding.'
      });
    }

    // Check data sharing consent
    if (!request.constraints.allowSensitiveData && context.securityLevel === SecurityLevel.RESTRICTED) {
      warnings.push({
        level: 'info',
        message: 'Data sharing is disabled for this secure site.',
        code: 'DATA_SHARING_DISABLED',
        details: 'Only non-sensitive page elements will be processed.'
      });
    }

    return warnings;
  }

  /**
   * Checks data sharing consent for different types of data
   */
  checkDataSharingConsent(dataType: keyof DataSharingConsent, context: WebsiteContext): boolean {
    // Default consent levels based on security level
    const defaultConsent: Record<SecurityLevel, DataSharingConsent> = {
      [SecurityLevel.PUBLIC]: {
        pageContent: true,
        formData: false,
        automation: true,
        aiProcessing: true
      },
      [SecurityLevel.CAUTIOUS]: {
        pageContent: true,
        formData: false,
        automation: false,
        aiProcessing: true
      },
      [SecurityLevel.RESTRICTED]: {
        pageContent: false,
        formData: false,
        automation: false,
        aiProcessing: false
      }
    };

    return defaultConsent[context.securityLevel][dataType];
  }

  /**
   * Creates security constraints based on website context
   */
  createSecurityConstraints(context: WebsiteContext): SecurityConstraints {
    const baseConstraints: SecurityConstraints = {
      allowSensitiveData: false,
      maxContentLength: 10000,
      allowedDomains: [context.domain],
      restrictedSelectors: []
    };

    switch (context.securityLevel) {
      case SecurityLevel.RESTRICTED:
        return {
          ...baseConstraints,
          allowSensitiveData: false,
          maxContentLength: 1000,
          restrictedSelectors: [
            'input[type="password"]',
            'input[type="email"]',
            'input[type="tel"]',
            'input[name*="password"]',
            'input[name*="ssn"]',
            'input[name*="credit"]',
            'input[name*="card"]',
            '[data-sensitive]'
          ]
        };

      case SecurityLevel.CAUTIOUS:
        return {
          ...baseConstraints,
          maxContentLength: 5000,
          restrictedSelectors: [
            'input[type="password"]',
            'input[name*="password"]',
            'input[name*="ssn"]'
          ]
        };

      case SecurityLevel.PUBLIC:
      default:
        return baseConstraints;
    }
  }

  /**
   * Simple hash function for caching
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  /**
   * Clears internal caches
   */
  clearCache(): void {
    this.sensitiveDataCache.clear();
    this.securityLevelCache.clear();
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const securityManager = new SecurityManager();