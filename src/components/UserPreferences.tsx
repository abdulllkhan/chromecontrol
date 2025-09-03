import React, { useState, useEffect } from 'react';
import {
  UserPreferences,
  WebsiteCategory,
  SecurityLevel,
  CustomPattern,
  PrivacySettings
} from '../types';
import { ChromeStorageService } from '../services/storage';

// ============================================================================
// INTERFACES
// ============================================================================

interface UserPreferencesProps {
  onClose: () => void;
}

interface WebsitePatternFormProps {
  pattern?: CustomPattern;
  onSave: (pattern: Omit<CustomPattern, 'id'>) => void;
  onCancel: () => void;
}

interface PrivacySettingsProps {
  settings: PrivacySettings;
  onChange: (settings: PrivacySettings) => void;
}

interface AutomationPermissionsProps {
  permissions: Record<string, boolean>;
  onChange: (permissions: Record<string, boolean>) => void;
}

interface CategoryPreferencesProps {
  enabledCategories: WebsiteCategory[];
  onChange: (categories: WebsiteCategory[]) => void;
}

// ============================================================================
// COMPONENTS
// ============================================================================

const WebsitePatternForm: React.FC<WebsitePatternFormProps> = ({
  pattern,
  onSave,
  onCancel
}) => {
  const [formData, setFormData] = useState({
    name: pattern?.name || '',
    urlPattern: pattern?.urlPattern || '',
    category: pattern?.category || WebsiteCategory.CUSTOM,
    suggestions: pattern?.suggestions?.join(', ') || ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Pattern name is required';
    }

    if (!formData.urlPattern.trim()) {
      newErrors.urlPattern = 'URL pattern is required';
    } else {
      try {
        new RegExp(formData.urlPattern);
      } catch (error) {
        newErrors.urlPattern = 'Invalid regex pattern';
      }
    }

    if (!formData.suggestions.trim()) {
      newErrors.suggestions = 'At least one suggestion is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const patternData: Omit<CustomPattern, 'id'> = {
      name: formData.name.trim(),
      urlPattern: formData.urlPattern.trim(),
      category: formData.category,
      suggestions: formData.suggestions.split(',').map(s => s.trim()).filter(Boolean)
    };

    onSave(patternData);
  };

  return (
    <div className="pattern-form">
      <div className="pattern-form-header">
        <h4>{pattern ? 'Edit Pattern' : 'Add Website Pattern'}</h4>
        <button className="btn btn-secondary btn-small" onClick={onCancel}>
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} className="pattern-form-content">
        <div className="form-group">
          <label htmlFor="pattern-name">Pattern Name *</label>
          <input
            id="pattern-name"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className={errors.name ? 'error' : ''}
            placeholder="e.g., GitHub Repositories"
          />
          {errors.name && <span className="error-text">{errors.name}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="pattern-url">URL Pattern *</label>
          <input
            id="pattern-url"
            type="text"
            value={formData.urlPattern}
            onChange={(e) => setFormData({ ...formData, urlPattern: e.target.value })}
            className={errors.urlPattern ? 'error' : ''}
            placeholder="e.g., github\.com\/.*\/.*"
          />
          {errors.urlPattern && <span className="error-text">{errors.urlPattern}</span>}
          <small>Use regex pattern to match URLs</small>
        </div>

        <div className="form-group">
          <label htmlFor="pattern-category">Category</label>
          <select
            id="pattern-category"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value as WebsiteCategory })}
          >
            {Object.values(WebsiteCategory).map(category => (
              <option key={category} value={category}>
                {category.replace('_', ' ').toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="pattern-suggestions">Suggestions *</label>
          <textarea
            id="pattern-suggestions"
            value={formData.suggestions}
            onChange={(e) => setFormData({ ...formData, suggestions: e.target.value })}
            className={errors.suggestions ? 'error' : ''}
            placeholder="Generate README, Analyze code quality, Create pull request template"
            rows={3}
          />
          {errors.suggestions && <span className="error-text">{errors.suggestions}</span>}
          <small>Comma-separated list of suggestion titles</small>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            {pattern ? 'Update Pattern' : 'Add Pattern'}
          </button>
        </div>
      </form>
    </div>
  );
};

const PrivacySettingsComponent: React.FC<PrivacySettingsProps> = ({
  settings,
  onChange
}) => {
  const [excludedDomain, setExcludedDomain] = useState('');

  const handleToggle = (key: keyof Omit<PrivacySettings, 'excludedDomains'>) => {
    onChange({
      ...settings,
      [key]: !settings[key]
    });
  };

  const handleSecurityLevelChange = (level: SecurityLevel) => {
    onChange({
      ...settings,
      securityLevel: level
    });
  };

  const addExcludedDomain = () => {
    if (excludedDomain.trim() && !settings.excludedDomains.includes(excludedDomain.trim())) {
      onChange({
        ...settings,
        excludedDomains: [...settings.excludedDomains, excludedDomain.trim()]
      });
      setExcludedDomain('');
    }
  };

  const removeExcludedDomain = (domain: string) => {
    onChange({
      ...settings,
      excludedDomains: settings.excludedDomains.filter(d => d !== domain)
    });
  };

  return (
    <div className="privacy-settings">
      <h4>Privacy & Security Settings</h4>

      <div className="settings-group">
        <h5>Data Sharing</h5>
        
        <label className="setting-item">
          <input
            type="checkbox"
            checked={settings.sharePageContent}
            onChange={() => handleToggle('sharePageContent')}
          />
          <div className="setting-content">
            <span className="setting-title">Share Page Content</span>
            <small>Allow sending page content to AI services for analysis</small>
          </div>
        </label>

        <label className="setting-item">
          <input
            type="checkbox"
            checked={settings.shareFormData}
            onChange={() => handleToggle('shareFormData')}
          />
          <div className="setting-content">
            <span className="setting-title">Share Form Data</span>
            <small>Allow sending form field data to AI services (not recommended)</small>
          </div>
        </label>

        <label className="setting-item">
          <input
            type="checkbox"
            checked={settings.allowAutomation}
            onChange={() => handleToggle('allowAutomation')}
          />
          <div className="setting-content">
            <span className="setting-title">Allow Automation</span>
            <small>Enable automated actions on web pages</small>
          </div>
        </label>
      </div>

      <div className="settings-group">
        <h5>Security Level</h5>
        <div className="security-levels">
          {Object.values(SecurityLevel).map(level => (
            <label key={level} className="security-level-option">
              <input
                type="radio"
                name="securityLevel"
                value={level}
                checked={settings.securityLevel === level}
                onChange={() => handleSecurityLevelChange(level)}
              />
              <div className="security-level-content">
                <span className="security-level-title">
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </span>
                <small>
                  {level === SecurityLevel.PUBLIC && 'Standard security for public websites'}
                  {level === SecurityLevel.CAUTIOUS && 'Enhanced security with content filtering'}
                  {level === SecurityLevel.RESTRICTED && 'Maximum security, minimal data sharing'}
                </small>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="settings-group">
        <h5>Excluded Domains</h5>
        <p className="setting-description">
          Domains where the extension will not provide suggestions or analyze content
        </p>
        
        <div className="excluded-domains-input">
          <input
            type="text"
            value={excludedDomain}
            onChange={(e) => setExcludedDomain(e.target.value)}
            placeholder="example.com"
            onKeyPress={(e) => e.key === 'Enter' && addExcludedDomain()}
          />
          <button
            type="button"
            className="btn btn-primary btn-small"
            onClick={addExcludedDomain}
            disabled={!excludedDomain.trim()}
          >
            Add
          </button>
        </div>

        {settings.excludedDomains.length > 0 && (
          <div className="excluded-domains-list">
            {settings.excludedDomains.map(domain => (
              <div key={domain} className="excluded-domain-item">
                <span>{domain}</span>
                <button
                  className="btn btn-danger btn-small"
                  onClick={() => removeExcludedDomain(domain)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const AutomationPermissionsComponent: React.FC<AutomationPermissionsProps> = ({
  permissions,
  onChange
}) => {
  const [newDomain, setNewDomain] = useState('');

  const commonDomains = [
    'github.com',
    'linkedin.com',
    'twitter.com',
    'facebook.com',
    'reddit.com',
    'stackoverflow.com',
    'amazon.com',
    'google.com'
  ];

  const addPermission = (domain: string, allowed: boolean) => {
    onChange({
      ...permissions,
      [domain]: allowed
    });
  };

  const removePermission = (domain: string) => {
    const newPermissions = { ...permissions };
    delete newPermissions[domain];
    onChange(newPermissions);
  };

  const addCustomDomain = () => {
    if (newDomain.trim() && !permissions.hasOwnProperty(newDomain.trim())) {
      addPermission(newDomain.trim(), true);
      setNewDomain('');
    }
  };

  return (
    <div className="automation-permissions">
      <h4>Automation Permissions</h4>
      <p className="setting-description">
        Control which websites can use automation features
      </p>

      <div className="settings-group">
        <h5>Quick Setup</h5>
        <div className="common-domains">
          {commonDomains.map(domain => (
            <div key={domain} className="domain-permission-item">
              <span className="domain-name">{domain}</span>
              <div className="permission-controls">
                <button
                  className={`btn btn-small ${permissions[domain] === true ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => addPermission(domain, true)}
                >
                  Allow
                </button>
                <button
                  className={`btn btn-small ${permissions[domain] === false ? 'btn-danger' : 'btn-secondary'}`}
                  onClick={() => addPermission(domain, false)}
                >
                  Block
                </button>
                {permissions.hasOwnProperty(domain) && (
                  <button
                    className="btn btn-small btn-secondary"
                    onClick={() => removePermission(domain)}
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="settings-group">
        <h5>Custom Domains</h5>
        <div className="custom-domain-input">
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="example.com"
            onKeyPress={(e) => e.key === 'Enter' && addCustomDomain()}
          />
          <button
            type="button"
            className="btn btn-primary btn-small"
            onClick={addCustomDomain}
            disabled={!newDomain.trim()}
          >
            Add Domain
          </button>
        </div>
      </div>

      {Object.keys(permissions).length > 0 && (
        <div className="settings-group">
          <h5>Current Permissions</h5>
          <div className="permissions-list">
            {Object.entries(permissions).map(([domain, allowed]) => (
              <div key={domain} className="permission-item">
                <span className="domain-name">{domain}</span>
                <span className={`permission-status ${allowed ? 'allowed' : 'blocked'}`}>
                  {allowed ? '✅ Allowed' : '❌ Blocked'}
                </span>
                <button
                  className="btn btn-secondary btn-small"
                  onClick={() => removePermission(domain)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const CategoryPreferencesComponent: React.FC<CategoryPreferencesProps> = ({
  enabledCategories,
  onChange
}) => {
  const handleCategoryToggle = (category: WebsiteCategory) => {
    const newCategories = enabledCategories.includes(category)
      ? enabledCategories.filter(c => c !== category)
      : [...enabledCategories, category];
    onChange(newCategories);
  };

  const categoryDescriptions = {
    [WebsiteCategory.SOCIAL_MEDIA]: 'Social media platforms like Twitter, Facebook, LinkedIn',
    [WebsiteCategory.ECOMMERCE]: 'Online shopping sites like Amazon, eBay, Shopify stores',
    [WebsiteCategory.PROFESSIONAL]: 'Professional platforms like LinkedIn, job boards, company sites',
    [WebsiteCategory.NEWS_CONTENT]: 'News websites, blogs, and content platforms',
    [WebsiteCategory.PRODUCTIVITY]: 'Productivity tools, project management, and work applications',
    [WebsiteCategory.CUSTOM]: 'Custom website patterns you define'
  };

  const categoryIcons = {
    [WebsiteCategory.SOCIAL_MEDIA]: '📱',
    [WebsiteCategory.ECOMMERCE]: '🛒',
    [WebsiteCategory.PROFESSIONAL]: '💼',
    [WebsiteCategory.NEWS_CONTENT]: '📰',
    [WebsiteCategory.PRODUCTIVITY]: '⚡',
    [WebsiteCategory.CUSTOM]: '🔧'
  };

  return (
    <div className="category-preferences">
      <h4>Suggestion Categories</h4>
      <p className="setting-description">
        Choose which types of websites should show AI suggestions
      </p>

      <div className="category-list">
        {Object.values(WebsiteCategory).map(category => (
          <label key={category} className="category-item">
            <input
              type="checkbox"
              checked={enabledCategories.includes(category)}
              onChange={() => handleCategoryToggle(category)}
            />
            <div className="category-content">
              <div className="category-header">
                <span className="category-icon">{categoryIcons[category]}</span>
                <span className="category-title">
                  {category.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              <small className="category-description">
                {categoryDescriptions[category]}
              </small>
            </div>
          </label>
        ))}
      </div>

      <div className="category-actions">
        <button
          className="btn btn-secondary"
          onClick={() => onChange([])}
        >
          Disable All
        </button>
        <button
          className="btn btn-primary"
          onClick={() => onChange(Object.values(WebsiteCategory))}
        >
          Enable All
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const UserPreferencesComponent: React.FC<UserPreferencesProps> = ({ onClose }) => {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'categories' | 'patterns' | 'privacy' | 'automation' | 'general'>('categories');
  const [showPatternForm, setShowPatternForm] = useState(false);
  const [editingPattern, setEditingPattern] = useState<CustomPattern | undefined>();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const storageService = new ChromeStorageService();

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setIsLoading(true);
      await storageService.initialize();
      const prefs = await storageService.getUserPreferences();
      
      if (prefs) {
        setPreferences(prefs);
      } else {
        // Initialize with defaults
        const defaultPrefs: UserPreferences = {
          enabledCategories: Object.values(WebsiteCategory),
          customPatterns: [],
          privacySettings: {
            sharePageContent: true,
            shareFormData: false,
            allowAutomation: true,
            securityLevel: SecurityLevel.CAUTIOUS,
            excludedDomains: []
          },
          automationPermissions: {},
          aiProvider: 'openai',
          theme: 'auto'
        };
        setPreferences(defaultPrefs);
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
      setError('Failed to load preferences');
    } finally {
      setIsLoading(false);
    }
  };

  const savePreferences = async () => {
    if (!preferences) return;

    try {
      setIsSaving(true);
      await storageService.updateUserPreferences(preferences);
      setHasUnsavedChanges(false);
      console.log('Preferences saved successfully');
    } catch (error) {
      console.error('Failed to save preferences:', error);
      setError('Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const updatePreferences = (updates: Partial<UserPreferences>) => {
    if (!preferences) return;
    
    setPreferences({ ...preferences, ...updates });
    setHasUnsavedChanges(true);
  };

  const handlePatternSave = (patternData: Omit<CustomPattern, 'id'>) => {
    if (!preferences) return;

    const newPattern: CustomPattern = {
      ...patternData,
      id: editingPattern?.id || `pattern_${Date.now()}`
    };

    const updatedPatterns = editingPattern
      ? preferences.customPatterns.map(p => p.id === editingPattern.id ? newPattern : p)
      : [...preferences.customPatterns, newPattern];

    updatePreferences({ customPatterns: updatedPatterns });
    setShowPatternForm(false);
    setEditingPattern(undefined);
  };

  const handlePatternDelete = (patternId: string) => {
    if (!preferences) return;

    const updatedPatterns = preferences.customPatterns.filter(p => p.id !== patternId);
    updatePreferences({ customPatterns: updatedPatterns });
  };

  const handlePatternEdit = (pattern: CustomPattern) => {
    setEditingPattern(pattern);
    setShowPatternForm(true);
  };

  if (isLoading) {
    return (
      <div className="user-preferences loading">
        <div className="preferences-header">
          <h2>Settings</h2>
          <button className="btn btn-secondary" onClick={onClose}>✕</button>
        </div>
        <div className="loading-content">
          <div className="spinner"></div>
          <p>Loading preferences...</p>
        </div>
      </div>
    );
  }

  if (error || !preferences) {
    return (
      <div className="user-preferences error">
        <div className="preferences-header">
          <h2>Settings</h2>
          <button className="btn btn-secondary" onClick={onClose}>✕</button>
        </div>
        <div className="error-content">
          <p>Error: {error || 'Failed to load preferences'}</p>
          <button className="btn btn-primary" onClick={loadPreferences}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="user-preferences">
      <div className="preferences-header">
        <h2>Settings</h2>
        <div className="preferences-actions">
          {hasUnsavedChanges && (
            <button
              className="btn btn-primary"
              onClick={savePreferences}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>
            ✕
          </button>
        </div>
      </div>

      <div className="preferences-content">
        <div className="preferences-tabs">
          <button
            className={`tab ${activeTab === 'categories' ? 'active' : ''}`}
            onClick={() => setActiveTab('categories')}
          >
            📂 Categories
          </button>
          <button
            className={`tab ${activeTab === 'patterns' ? 'active' : ''}`}
            onClick={() => setActiveTab('patterns')}
          >
            🔗 Website Patterns
          </button>
          <button
            className={`tab ${activeTab === 'privacy' ? 'active' : ''}`}
            onClick={() => setActiveTab('privacy')}
          >
            🔒 Privacy & Security
          </button>
          <button
            className={`tab ${activeTab === 'automation' ? 'active' : ''}`}
            onClick={() => setActiveTab('automation')}
          >
            🤖 Automation
          </button>
          <button
            className={`tab ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            ⚙️ General
          </button>
        </div>

        <div className="preferences-panel">
          {activeTab === 'categories' && (
            <CategoryPreferencesComponent
              enabledCategories={preferences.enabledCategories}
              onChange={(categories) => updatePreferences({ enabledCategories: categories })}
            />
          )}

          {activeTab === 'patterns' && (
            <div className="website-patterns">
              <div className="patterns-header">
                <h4>Custom Website Patterns</h4>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setEditingPattern(undefined);
                    setShowPatternForm(true);
                  }}
                >
                  + Add Pattern
                </button>
              </div>

              {showPatternForm && (
                <WebsitePatternForm
                  pattern={editingPattern}
                  onSave={handlePatternSave}
                  onCancel={() => {
                    setShowPatternForm(false);
                    setEditingPattern(undefined);
                  }}
                />
              )}

              <div className="patterns-list">
                {preferences.customPatterns.length === 0 ? (
                  <div className="empty-state">
                    <p>No custom patterns defined. Add patterns to customize suggestions for specific websites.</p>
                  </div>
                ) : (
                  preferences.customPatterns.map(pattern => (
                    <div key={pattern.id} className="pattern-item">
                      <div className="pattern-info">
                        <h5>{pattern.name}</h5>
                        <p className="pattern-url">{pattern.urlPattern}</p>
                        <div className="pattern-meta">
                          <span className="pattern-category">{pattern.category}</span>
                          <span className="pattern-suggestions">
                            {pattern.suggestions.length} suggestion{pattern.suggestions.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <div className="pattern-actions">
                        <button
                          className="btn btn-secondary btn-small"
                          onClick={() => handlePatternEdit(pattern)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-danger btn-small"
                          onClick={() => handlePatternDelete(pattern.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <PrivacySettingsComponent
              settings={preferences.privacySettings}
              onChange={(settings) => updatePreferences({ privacySettings: settings })}
            />
          )}

          {activeTab === 'automation' && (
            <AutomationPermissionsComponent
              permissions={preferences.automationPermissions}
              onChange={(permissions) => updatePreferences({ automationPermissions: permissions })}
            />
          )}

          {activeTab === 'general' && (
            <div className="general-settings">
              <h4>General Settings</h4>

              <div className="settings-group">
                <h5>AI Provider</h5>
                <select
                  value={preferences.aiProvider}
                  onChange={(e) => updatePreferences({ aiProvider: e.target.value })}
                  className="setting-select"
                >
                  <option value="openai">OpenAI</option>
                  <option value="claude">Claude</option>
                  <option value="local">Local Model</option>
                </select>
                <small>Choose your preferred AI service provider</small>
              </div>

              <div className="settings-group">
                <h5>AI Model</h5>
                {preferences.aiProvider === 'openai' ? (
                  <select
                    className="setting-select"
                    defaultValue="gpt-5"
                  >
                    <option value="gpt-5">GPT-5 (Latest)</option>
                    <option value="gpt-4.1">GPT-4.1 (Enhanced)</option>
                    <option value="o4-mini">o4 Mini (Fast & Efficient)</option>
                    <option value="gpt-4o">GPT-4o (Legacy)</option>
                    <option value="gpt-4o-mini">GPT-4o Mini (Legacy)</option>
                    <option value="gpt-4">GPT-4 (Legacy)</option>
                    <option value="gpt-4-turbo">GPT-4 Turbo (Legacy)</option>
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Legacy)</option>
                  </select>
                ) : preferences.aiProvider === 'claude' ? (
                  <select
                    className="setting-select"
                    defaultValue="claude-3-5-sonnet-20241022"
                  >
                    <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet (Latest)</option>
                    <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku (Fast)</option>
                    <option value="claude-3-opus-20240229">Claude 3 Opus (Most Capable)</option>
                    <option value="claude-3-sonnet-20240229">Claude 3 Sonnet (Balanced)</option>
                    <option value="claude-3-haiku-20240307">Claude 3 Haiku (Fast)</option>
                  </select>
                ) : (
                  <select className="setting-select" disabled>
                    <option>Select AI Provider First</option>
                  </select>
                )}
                <small>Select the AI model to use for suggestions and analysis</small>
              </div>

              <div className="settings-group">
                <h5>Theme</h5>
                <div className="theme-options">
                  {(['light', 'dark', 'auto'] as const).map(theme => (
                    <label key={theme} className="theme-option">
                      <input
                        type="radio"
                        name="theme"
                        value={theme}
                        checked={preferences.theme === theme}
                        onChange={() => updatePreferences({ theme })}
                      />
                      <span>{theme.charAt(0).toUpperCase() + theme.slice(1)}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="settings-group">
                <h5>Feature Toggles</h5>
                <label className="setting-item">
                  <input
                    type="checkbox"
                    checked={preferences.enabledCategories.length > 0}
                    onChange={(e) => updatePreferences({
                      enabledCategories: e.target.checked ? Object.values(WebsiteCategory) : []
                    })}
                  />
                  <div className="setting-content">
                    <span className="setting-title">Enable Extension</span>
                    <small>Master toggle for all extension functionality</small>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {hasUnsavedChanges && (
        <div className="preferences-footer">
          <div className="unsaved-changes-notice">
            <span>⚠️ You have unsaved changes</span>
            <button
              className="btn btn-primary"
              onClick={savePreferences}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserPreferencesComponent;