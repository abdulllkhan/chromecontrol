import React, { useState, useEffect } from 'react';
import {
  UserPreferences,
  WebsiteCategory,
  SecurityLevel,
  CustomPattern,
  PrivacySettings,
  AIConfiguration,
  MCPServerConfig
} from '../types';
import { ChromeStorageService } from '../services/storage';
import { mcpServerManager, MCPServerStatus } from '../services/mcpServerManager';

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


  const categoryIcons = {
    [WebsiteCategory.SOCIAL_MEDIA]: 'Social',
    [WebsiteCategory.ECOMMERCE]: 'Shop',
    [WebsiteCategory.PROFESSIONAL]: 'Work',
    [WebsiteCategory.NEWS_CONTENT]: 'News',
    [WebsiteCategory.PRODUCTIVITY]: 'Productivity',
    [WebsiteCategory.CUSTOM]: 'Custom'
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
              </div>
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
// COMPONENT: AI Configuration Management
// ============================================================================

interface AIConfigurationManagerProps {
  configurations: AIConfiguration[];
  activeConfigId: string | null;
  onSave: (config: AIConfiguration) => void;
  onDelete: (configId: string) => void;
  onSetActive: (configId: string) => void;
}

const AIConfigurationManager: React.FC<AIConfigurationManagerProps> = ({
  configurations,
  activeConfigId,
  onSave,
  onDelete,
  onSetActive
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState<AIConfiguration | null>(null);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    provider: 'openai' as 'openai' | 'claude' | 'local',
    apiKey: '',
    model: 'gpt-5',
    maxTokens: 8000,
    temperature: 0.7,
    baseUrl: 'https://api.openai.com/v1',
    isActive: false,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const handleAdd = () => {
    setEditingConfig(null);
    setFormData({
      id: `config_${Date.now()}`,
      name: '',
      provider: 'openai',
      apiKey: '',
      model: 'gpt-5',
      maxTokens: 8000,
      temperature: 0.7,
      baseUrl: 'https://api.openai.com/v1',
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    setShowForm(true);
  };

  const handleEdit = (config: AIConfiguration) => {
    setEditingConfig(config);
    setFormData({
      id: config.id,
      name: config.name,
      provider: config.provider,
      apiKey: '', // Never display existing API key for security
      model: config.model || 'gpt-5',
      maxTokens: config.maxTokens || 8000,
      temperature: config.temperature || 0.7,
      baseUrl: config.baseUrl || 'https://api.openai.com/v1',
      isActive: config.isActive,
      createdAt: config.createdAt,
      updatedAt: new Date()
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    // When editing, preserve existing API key if user left it empty (for security)
    const configToSave = {
      ...formData,
      apiKey: formData.apiKey.trim() || (editingConfig?.apiKey || '')
    };

    // Only proceed if we have an API key (either new or existing)
    if (!configToSave.apiKey) return;

    onSave(configToSave as AIConfiguration);
    setShowForm(false);
    setEditingConfig(null);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingConfig(null);
  };

  const getModelOptions = (provider: string) => {
    switch (provider) {
      case 'openai':
        return (
          <>
            <option value="gpt-5">GPT-5 (Latest)</option>
            <option value="gpt-5-mini">GPT-5 Mini (Fast)</option>
            <option value="gpt-4o">GPT-4o (Optimized)</option>
            <option value="gpt-4o-mini">GPT-4o Mini (Fast)</option>
          </>
        );
      case 'claude':
        return (
          <>
            <option value="claude-opus-4-1-20250805">Claude Opus 4.1 (Latest & Most Powerful)</option>
            <option value="claude-sonnet-4-20250514">Claude Sonnet 4 (Best Balance)</option>
            <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku (Fast & Economical)</option>
            <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet (Legacy)</option>
            <option value="claude-3-5-sonnet-20240620">Claude 3.5 Sonnet (Legacy)</option>
          </>
        );
      default:
        return <option value="">Enter custom model</option>;
    }
  };

  if (showForm) {
    return (
      <div className="ai-config-form">
        <div className="form-header">
          <h4>{editingConfig ? 'Edit Configuration' : 'Add AI Configuration'}</h4>
          <button className="btn btn-secondary btn-small" onClick={handleCancel}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="form-content">
          <div className="form-group">
            <label htmlFor="config-name">Configuration Name *</label>
            <input
              id="config-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Production OpenAI"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="config-provider">Provider</label>
            <select
              id="config-provider"
              value={formData.provider}
              onChange={(e) => setFormData({
                ...formData,
                provider: e.target.value as 'openai' | 'claude' | 'local',
                model: e.target.value === 'openai' ? 'gpt-5' :
                       e.target.value === 'claude' ? 'claude-sonnet-4-20250514' : ''
              })}
            >
              <option value="openai">OpenAI</option>
              <option value="claude">Claude</option>
              <option value="local">Local Model</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="config-apikey">API Key *</label>
            <input
              id="config-apikey"
              type="password"
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              placeholder={editingConfig ? "Leave empty to keep existing key" : "sk-..."}
              required={!editingConfig}
            />
          </div>

          <div className="form-group">
            <label htmlFor="config-model">Model</label>
            {formData.provider === 'local' ? (
              <input
                id="config-model"
                type="text"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                placeholder="Local model path or identifier"
              />
            ) : (
              <select
                id="config-model"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              >
                {getModelOptions(formData.provider)}
              </select>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="config-maxtokens">
              Max Tokens: {formData.maxTokens}
            </label>
            <input
              id="config-maxtokens"
              type="range"
              min="100"
              max="16000"
              step="100"
              value={formData.maxTokens}
              onChange={(e) => setFormData({ ...formData, maxTokens: parseInt(e.target.value) })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="config-temperature">
              Temperature: {formData.temperature}
            </label>
            <input
              id="config-temperature"
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={formData.temperature}
              onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
            />
            <small>Higher values make output more creative but less focused</small>
          </div>

          <div className="form-group">
            <label htmlFor="config-baseurl">API Endpoint</label>
            <input
              id="config-baseurl"
              type="url"
              value={formData.baseUrl}
              onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
              placeholder="https://api.openai.com/v1"
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={handleCancel}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editingConfig ? 'Update Configuration' : 'Add Configuration'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="ai-configurations">
      <h4>AI Configurations</h4>

      <div className="config-add-section">
        <button className="btn btn-primary" onClick={handleAdd}>
          + Add Configuration
        </button>
      </div>

      {configurations.length === 0 ? (
        <div className="empty-state">
          <p>No AI configurations yet. Add one to get started!</p>
        </div>
      ) : (
        <div className="config-list">
          {configurations.map(config => (
            <div key={config.id} className={`config-item ${config.id === activeConfigId ? 'active' : ''}`}>
              <div className="config-info">
                <h5>{config.name}</h5>
                <div className="config-meta">
                  <span className="config-badge provider">{config.provider}</span>
                  <span className="config-badge model">{config.model}</span>
                  {config.id === activeConfigId && (
                    <span className="config-badge active">✓ Active</span>
                  )}
                </div>
              </div>

              <div className="config-actions">
                {config.id !== activeConfigId && (
                  <button
                    className="btn btn-primary btn-small"
                    onClick={() => onSetActive(config.id)}
                  >
                    Activate
                  </button>
                )}
                <button
                  className="btn btn-secondary btn-small"
                  onClick={() => handleEdit(config)}
                >
                  Edit
                </button>
                <button
                  className="btn btn-danger btn-small"
                  onClick={() => {
                    if (confirm(`Delete configuration "${config.name}"?`)) {
                      onDelete(config.id);
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// COMPONENT: MCP Server Configuration Management
// ============================================================================

interface MCPServerManagerProps {
  servers: MCPServerConfig[];
  onSave: (server: MCPServerConfig) => void;
  onDelete: (serverName: string) => void;
  onToggleEnabled: (serverName: string, enabled: boolean) => void;
}

const MCPServerManager: React.FC<MCPServerManagerProps> = ({
  servers,
  onSave,
  onDelete,
  onToggleEnabled
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingServer, setEditingServer] = useState<MCPServerConfig | null>(null);
  const [serverStatuses, setServerStatuses] = useState<Record<string, MCPServerStatus>>({});
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    apiKey: '',
    timeout: 5000,
    retryAttempts: 3,
    enabled: true,
    capabilities: [] as string[]
  });

  // Load server statuses on mount
  useEffect(() => {
    loadServerStatuses();
    
    // Set up periodic status updates
    const interval = setInterval(loadServerStatuses, 10000); // Every 10 seconds
    return () => clearInterval(interval);
  }, [servers]);

  const loadServerStatuses = async () => {
    try {
      const connections = mcpServerManager.getAllConnections();
      const statuses: Record<string, MCPServerStatus> = {};
      
      for (const connection of connections) {
        statuses[connection.config.name] = connection.status;
      }
      
      setServerStatuses(statuses);
    } catch (error) {
      console.error('Failed to load server statuses:', error);
    }
  };

  const handleAdd = () => {
    setEditingServer(null);
    setFormData({
      name: '',
      url: '',
      apiKey: '',
      timeout: 5000,
      retryAttempts: 3,
      enabled: true,
      capabilities: ['tools', 'resources']
    });
    setShowForm(true);
  };

  const handleEdit = (server: MCPServerConfig) => {
    setEditingServer(server);
    setFormData({
      name: server.name,
      url: server.url,
      apiKey: '', // Never display existing API key for security
      timeout: server.timeout || 5000,
      retryAttempts: server.retryAttempts || 3,
      enabled: server.enabled,
      capabilities: [...server.capabilities]
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.url) return;

    // When editing, preserve existing API key if user left it empty (for security)
    const serverToSave: MCPServerConfig = {
      name: formData.name,
      url: formData.url,
      apiKey: formData.apiKey.trim() || (editingServer?.apiKey || ''),
      timeout: formData.timeout,
      retryAttempts: formData.retryAttempts,
      enabled: formData.enabled,
      capabilities: formData.capabilities
    };

    onSave(serverToSave);
    setShowForm(false);
    setEditingServer(null);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingServer(null);
  };

  const handleCapabilityToggle = (capability: string) => {
    const newCapabilities = formData.capabilities.includes(capability)
      ? formData.capabilities.filter(c => c !== capability)
      : [...formData.capabilities, capability];
    
    setFormData({ ...formData, capabilities: newCapabilities });
  };

  const handleTestConnection = async (server: MCPServerConfig) => {
    try {
      // Add temporary connection for testing
      await mcpServerManager.addServerConnection(server);
      await mcpServerManager.connectToServer(server.name);
      
      // Update status
      await loadServerStatuses();
      
      alert(`Successfully connected to ${server.name}`);
    } catch (error) {
      alert(`Failed to connect to ${server.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const getStatusColor = (status: MCPServerStatus) => {
    switch (status) {
      case MCPServerStatus.CONNECTED:
        return '#22c55e'; // green
      case MCPServerStatus.CONNECTING:
        return '#f59e0b'; // yellow
      case MCPServerStatus.ERROR:
        return '#ef4444'; // red
      default:
        return '#6b7280'; // gray
    }
  };

  const getStatusText = (status: MCPServerStatus) => {
    switch (status) {
      case MCPServerStatus.CONNECTED:
        return '✓ Connected';
      case MCPServerStatus.CONNECTING:
        return '⏳ Connecting';
      case MCPServerStatus.ERROR:
        return '❌ Error';
      default:
        return '⚪ Disconnected';
    }
  };

  if (showForm) {
    return (
      <div className="mcp-server-form">
        <div className="form-header">
          <h4>{editingServer ? 'Edit MCP Server' : 'Add MCP Server'}</h4>
          <button className="btn btn-secondary btn-small" onClick={handleCancel}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="form-content">
          <div className="form-group">
            <label htmlFor="server-name">Server Name *</label>
            <input
              id="server-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Local MCP Server"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="server-url">Server URL *</label>
            <input
              id="server-url"
              type="url"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              placeholder="http://localhost:3000"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="server-apikey">API Key</label>
            <input
              id="server-apikey"
              type="password"
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              placeholder={editingServer ? "Leave empty to keep existing key" : "Optional authentication key"}
            />
          </div>

          <div className="form-group">
            <label htmlFor="server-timeout">
              Connection Timeout: {formData.timeout}ms
            </label>
            <input
              id="server-timeout"
              type="range"
              min="1000"
              max="30000"
              step="1000"
              value={formData.timeout}
              onChange={(e) => setFormData({ ...formData, timeout: parseInt(e.target.value) })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="server-retries">
              Retry Attempts: {formData.retryAttempts}
            </label>
            <input
              id="server-retries"
              type="range"
              min="0"
              max="10"
              step="1"
              value={formData.retryAttempts}
              onChange={(e) => setFormData({ ...formData, retryAttempts: parseInt(e.target.value) })}
            />
          </div>

          <div className="form-group">
            <label>Capabilities</label>
            <div className="capability-checkboxes">
              {['tools', 'resources', 'prompts', 'streaming'].map(capability => (
                <label key={capability} className="capability-item">
                  <input
                    type="checkbox"
                    checked={formData.capabilities.includes(capability)}
                    onChange={() => handleCapabilityToggle(capability)}
                  />
                  <span>{capability.charAt(0).toUpperCase() + capability.slice(1)}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="setting-item">
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              />
              <span>Enable this server</span>
            </label>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={handleCancel}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editingServer ? 'Update Server' : 'Add Server'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="mcp-servers">
      <h4>MCP Server Connections</h4>
      <p className="setting-description">
        Configure external MCP (Model Context Protocol) servers to enhance AI capabilities with additional tools and resources.
      </p>

      <div className="server-add-section">
        <button className="btn btn-primary" onClick={handleAdd}>
          + Add MCP Server
        </button>
      </div>

      {servers.length === 0 ? (
        <div className="empty-state">
          <p>No MCP servers configured. Add one to extend AI capabilities!</p>
        </div>
      ) : (
        <div className="server-list">
          {servers.map(server => (
            <div key={server.name} className={`server-item ${server.enabled ? 'enabled' : 'disabled'}`}>
              <div className="server-info">
                <h5>{server.name}</h5>
                <div className="server-meta">
                  <span className="server-url">{server.url}</span>
                  <div className="server-status" style={{ color: getStatusColor(serverStatuses[server.name] || MCPServerStatus.DISCONNECTED) }}>
                    {getStatusText(serverStatuses[server.name] || MCPServerStatus.DISCONNECTED)}
                  </div>
                </div>
                <div className="server-capabilities">
                  {server.capabilities.map(cap => (
                    <span key={cap} className="capability-badge">{cap}</span>
                  ))}
                </div>
              </div>

              <div className="server-actions">
                <label className="server-toggle">
                  <input
                    type="checkbox"
                    checked={server.enabled}
                    onChange={(e) => onToggleEnabled(server.name, e.target.checked)}
                  />
                  <span>Enabled</span>
                </label>
                
                <button
                  className="btn btn-secondary btn-small"
                  onClick={() => handleTestConnection(server)}
                  disabled={!server.enabled}
                >
                  Test
                </button>
                
                <button
                  className="btn btn-secondary btn-small"
                  onClick={() => handleEdit(server)}
                >
                  Edit
                </button>
                
                <button
                  className="btn btn-danger btn-small"
                  onClick={() => {
                    if (confirm(`Delete MCP server "${server.name}"?`)) {
                      onDelete(server.name);
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mcp-info">
        <h5>About MCP Servers</h5>
        <p>
          MCP (Model Context Protocol) servers provide additional tools and resources that can be used by AI models.
          Common examples include file system access, database connections, API integrations, and specialized processing tools.
        </p>
        <ul>
          <li><strong>Tools:</strong> Executable functions that AI can call</li>
          <li><strong>Resources:</strong> Data sources and content repositories</li>
          <li><strong>Prompts:</strong> Reusable prompt templates</li>
          <li><strong>Streaming:</strong> Real-time data processing capabilities</li>
        </ul>
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
  const [activeTab, setActiveTab] = useState<'categories' | 'patterns' | 'privacy' | 'automation' | 'ai' | 'mcp' | 'general'>('categories');
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
          theme: 'auto',
          mcpServers: []
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

  const handleAIConfigSave = (config: AIConfiguration) => {
    if (!preferences) return;

    const existingConfigs = preferences.aiConfigurations || [];
    const existingIndex = existingConfigs.findIndex(c => c.id === config.id);

    let updatedConfigs: AIConfiguration[];
    if (existingIndex >= 0) {
      updatedConfigs = [...existingConfigs];
      updatedConfigs[existingIndex] = config;
    } else {
      updatedConfigs = [...existingConfigs, config];
    }

    // If this is the first config or it's set as active, make it the active one
    const activeConfigId = config.isActive || !preferences.activeAIConfigId
      ? config.id
      : preferences.activeAIConfigId;

    updatePreferences({
      aiConfigurations: updatedConfigs,
      activeAIConfigId: activeConfigId
    });
  };

  const handleAIConfigDelete = (configId: string) => {
    if (!preferences) return;

    const existingConfigs = preferences.aiConfigurations || [];
    const updatedConfigs = existingConfigs.filter(c => c.id !== configId);

    // If deleting the active config, activate another one
    let newActiveId = preferences.activeAIConfigId;
    if (newActiveId === configId) {
      newActiveId = updatedConfigs.length > 0 ? updatedConfigs[0].id : undefined;
    }

    updatePreferences({
      aiConfigurations: updatedConfigs,
      activeAIConfigId: newActiveId
    });
  };

  const handleAIConfigSetActive = (configId: string) => {
    if (!preferences) return;

    updatePreferences({
      activeAIConfigId: configId
    });
  };

  const handleMCPServerSave = async (server: MCPServerConfig) => {
    if (!preferences) return;

    try {
      const existingServers = preferences.mcpServers || [];
      const existingIndex = existingServers.findIndex(s => s.name === server.name);

      let updatedServers: MCPServerConfig[];
      if (existingIndex >= 0) {
        updatedServers = [...existingServers];
        updatedServers[existingIndex] = server;
      } else {
        updatedServers = [...existingServers, server];
      }

      updatePreferences({ mcpServers: updatedServers });

      // Update the MCP server manager
      if (server.enabled) {
        await mcpServerManager.addServerConnection(server);
      }
    } catch (error) {
      console.error('Failed to save MCP server:', error);
      setError('Failed to save MCP server configuration');
    }
  };

  const handleMCPServerDelete = async (serverName: string) => {
    if (!preferences) return;

    try {
      const updatedServers = (preferences.mcpServers || []).filter(s => s.name !== serverName);
      updatePreferences({ mcpServers: updatedServers });

      // Remove from MCP server manager
      await mcpServerManager.removeServerConnection(serverName);
    } catch (error) {
      console.error('Failed to delete MCP server:', error);
      setError('Failed to delete MCP server');
    }
  };

  const handleMCPServerToggle = async (serverName: string, enabled: boolean) => {
    if (!preferences) return;

    try {
      const updatedServers = (preferences.mcpServers || []).map(server =>
        server.name === serverName ? { ...server, enabled } : server
      );
      updatePreferences({ mcpServers: updatedServers });

      // Update MCP server manager
      if (enabled) {
        const server = updatedServers.find(s => s.name === serverName);
        if (server) {
          await mcpServerManager.addServerConnection(server);
        }
      } else {
        await mcpServerManager.removeServerConnection(serverName);
      }
    } catch (error) {
      console.error('Failed to toggle MCP server:', error);
      setError('Failed to update MCP server status');
    }
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
            Categories
          </button>
          <button
            className={`tab ${activeTab === 'patterns' ? 'active' : ''}`}
            onClick={() => setActiveTab('patterns')}
          >
            Website Patterns
          </button>
          <button
            className={`tab ${activeTab === 'privacy' ? 'active' : ''}`}
            onClick={() => setActiveTab('privacy')}
          >
            Privacy & Security
          </button>
          <button
            className={`tab ${activeTab === 'automation' ? 'active' : ''}`}
            onClick={() => setActiveTab('automation')}
          >
            Automation
          </button>
          <button
            className={`tab ${activeTab === 'ai' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai')}
          >
            AI
          </button>
          <button
            className={`tab ${activeTab === 'mcp' ? 'active' : ''}`}
            onClick={() => setActiveTab('mcp')}
          >
            MCP Servers
          </button>
          <button
            className={`tab ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            General
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

          {activeTab === 'ai' && (
            <AIConfigurationManager
              configurations={preferences.aiConfigurations || []}
              activeConfigId={preferences.activeAIConfigId || null}
              onSave={handleAIConfigSave}
              onDelete={handleAIConfigDelete}
              onSetActive={handleAIConfigSetActive}
            />
          )}

          {activeTab === 'mcp' && (
            <MCPServerManager
              servers={preferences.mcpServers || []}
              onSave={handleMCPServerSave}
              onDelete={handleMCPServerDelete}
              onToggleEnabled={handleMCPServerToggle}
            />
          )}

          {activeTab === 'general' && (
            <div className="general-settings">
              <h4>General Settings</h4>


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
            <span>Warning: You have unsaved changes</span>
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