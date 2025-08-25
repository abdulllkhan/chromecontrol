# Extension Installation and Update Testing Guide

## Overview

This document provides comprehensive testing procedures for the Agentic Chrome Extension installation, update, and deployment processes.

## Pre-Installation Testing

### Build Verification
```bash
# Clean build test
npm run clean
npm run build

# Verify build output
ls -la dist/
# Should contain:
# - manifest.json
# - popup.js
# - background.js
# - content.js
# - icons/ directory
# - popup.html (if copied)
```

### Package Integrity Test
```bash
# Create distribution package
npm run package

# Verify zip contents
unzip -l agentic-chrome-extension.zip
# Should contain all required files with correct structure
```

## Installation Testing Procedures

### 1. Developer Mode Installation

#### Test Steps:
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" toggle
3. Click "Load unpacked"
4. Select the `dist` directory
5. Verify extension appears in extensions list

#### Expected Results:
- ✅ Extension loads without errors
- ✅ Extension icon appears in toolbar
- ✅ Extension name and version display correctly
- ✅ No console errors in extension pages
- ✅ All permissions are properly requested

#### Verification Commands:
```bash
# Check for common issues
npm run lint
npm run type-check
npm run test:run
```

### 2. Packed Extension Installation

#### Test Steps:
1. Create packed extension: Extensions → Pack extension
2. Select `dist` directory as root
3. Install the generated `.crx` file
4. Verify installation process

#### Expected Results:
- ✅ Extension packs without warnings
- ✅ Installation completes successfully
- ✅ All functionality works identically to unpacked version

### 3. Chrome Web Store Simulation

#### Test Steps:
1. Upload extension to Chrome Web Store Developer Dashboard (test mode)
2. Complete store listing with required information
3. Submit for review (private/unlisted initially)
4. Test installation from store

#### Required Information Checklist:
- ✅ Extension name and description
- ✅ All required icons (16x16, 48x48, 128x128)
- ✅ Screenshots and promotional images
- ✅ Privacy policy
- ✅ Detailed description
- ✅ Category and tags

## Update Testing Procedures

### 1. Version Update Test

#### Preparation:
```bash
# Update version in manifest.json and package.json
# Example: 1.0.0 → 1.0.1
```

#### Test Steps:
1. Install version 1.0.0 in developer mode
2. Verify extension functionality
3. Update files with version 1.0.1
4. Reload extension in `chrome://extensions/`
5. Verify update process

#### Expected Results:
- ✅ Extension updates without data loss
- ✅ User preferences and custom tasks persist
- ✅ New version number displays correctly
- ✅ All functionality continues to work

### 2. Migration Testing

#### Test Scenarios:
```javascript
// Test data migration between versions
// Simulate different upgrade paths:
// - 1.0.0 → 1.1.0 (minor update)
// - 1.0.0 → 2.0.0 (major update)
// - Fresh install vs. upgrade
```

#### Verification:
- ✅ Custom tasks migrate correctly
- ✅ User preferences are preserved
- ✅ Storage schema updates properly
- ✅ No data corruption occurs

## Automated Testing Scripts

### Installation Test Script
```bash
#!/bin/bash
# test-installation.sh

echo "Starting installation tests..."

# Build extension
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

# Verify required files
required_files=("manifest.json" "popup.js" "background.js" "content.js")
for file in "${required_files[@]}"; do
    if [ ! -f "dist/$file" ]; then
        echo "❌ Missing required file: $file"
        exit 1
    fi
done

# Verify manifest structure
node -e "
const manifest = require('./dist/manifest.json');
if (!manifest.manifest_version || !manifest.name || !manifest.version) {
    console.log('❌ Invalid manifest structure');
    process.exit(1);
}
console.log('✅ Manifest structure valid');
"

# Package extension
npm run package
if [ $? -ne 0 ]; then
    echo "❌ Packaging failed"
    exit 1
fi

echo "✅ All installation tests passed"
```

### Update Test Script
```bash
#!/bin/bash
# test-updates.sh

echo "Starting update tests..."

# Simulate version update
current_version=$(node -e "console.log(require('./package.json').version)")
echo "Current version: $current_version"

# Test version increment
npm version patch --no-git-tag-version
new_version=$(node -e "console.log(require('./package.json').version)")
echo "New version: $new_version"

# Update manifest version
node -e "
const fs = require('fs');
const manifest = require('./dist/manifest.json');
manifest.version = require('./package.json').version;
fs.writeFileSync('./dist/manifest.json', JSON.stringify(manifest, null, 2));
"

# Verify update
npm run build
echo "✅ Update test completed"

# Restore original version for testing
git checkout package.json 2>/dev/null || true
```

## Manual Testing Checklist

### Core Functionality Tests
- [ ] Extension popup opens correctly
- [ ] Website analysis works on different sites
- [ ] AI suggestions generate properly
- [ ] Custom task creation and management
- [ ] Copy-to-clipboard functionality
- [ ] Settings and preferences
- [ ] Error handling and recovery

### Cross-Browser Compatibility
- [ ] Chrome (latest stable)
- [ ] Chrome (previous version)
- [ ] Chromium-based browsers (Edge, Brave)

### Performance Tests
- [ ] Extension startup time < 2 seconds
- [ ] Memory usage remains reasonable
- [ ] No memory leaks during extended use
- [ ] CPU usage stays minimal when idle

### Security Tests
- [ ] Content Security Policy compliance
- [ ] No XSS vulnerabilities
- [ ] Secure data storage
- [ ] Proper permission handling
- [ ] Privacy policy compliance

## Troubleshooting Common Issues

### Installation Failures
```bash
# Check for common issues:
# 1. Manifest validation
npx web-ext lint --source-dir=dist

# 2. File permissions
chmod -R 644 dist/*
chmod 755 dist

# 3. Build artifacts
npm run clean && npm run build
```

### Update Failures
- Verify version numbers are properly incremented
- Check for breaking changes in manifest format
- Ensure data migration scripts are included
- Test with clean extension state

### Store Submission Issues
- Validate all required metadata is complete
- Ensure privacy policy is accessible
- Verify all images meet size requirements
- Check for policy violations

## Deployment Checklist

### Pre-Deployment
- [ ] All tests pass (unit, integration, e2e)
- [ ] Manual testing completed
- [ ] Performance benchmarks met
- [ ] Security audit completed
- [ ] Documentation updated
- [ ] Version numbers incremented

### Store Submission
- [ ] Extension package created
- [ ] Store listing information complete
- [ ] Privacy policy published
- [ ] Screenshots and promotional images uploaded
- [ ] Pricing and distribution settings configured

### Post-Deployment
- [ ] Monitor for installation issues
- [ ] Track user feedback and reviews
- [ ] Monitor error reports
- [ ] Plan for next version updates

## Continuous Integration

### GitHub Actions Workflow
```yaml
# .github/workflows/test-deployment.yml
name: Test Extension Deployment

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test-installation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run validate
      - run: npm run build
      - run: npm run package
      - name: Test installation
        run: ./scripts/test-installation.sh
```

This comprehensive testing approach ensures reliable installation and update processes for the Agentic Chrome Extension.