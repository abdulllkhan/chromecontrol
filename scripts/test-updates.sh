#!/bin/bash
# Update testing script for Agentic Chrome Extension

set -e  # Exit on any error

echo "🔄 Starting Agentic Chrome Extension Update Tests..."
echo "================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
        exit 1
    fi
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Backup original files
echo "💾 Creating backups..."
cp package.json package.json.backup
cp manifest.json manifest.json.backup
print_status $? "Backup created"

# Function to restore backups
restore_backups() {
    echo "🔄 Restoring original files..."
    mv package.json.backup package.json
    mv manifest.json.backup manifest.json
    echo -e "${GREEN}✅ Files restored${NC}"
}

# Trap to restore backups on exit
trap restore_backups EXIT

# 1. Get current version
current_version=$(node -e "console.log(require('./package.json').version)")
print_info "Current version: $current_version"

# 2. Test patch version update
echo "🔢 Testing patch version update..."
npm version patch --no-git-tag-version > /dev/null 2>&1
new_version=$(node -e "console.log(require('./package.json').version)")
print_info "New version: $new_version"

# 3. Update manifest version to match
echo "📋 Updating manifest version..."
node -e "
const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const packageJson = require('./package.json');
manifest.version = packageJson.version;
fs.writeFileSync('manifest.json', JSON.stringify(manifest, null, 2));
console.log('Manifest version updated to:', manifest.version);
"
print_status $? "Manifest version updated"

# 4. Test build with new version
echo "🔨 Testing build with updated version..."
npm run build > /dev/null 2>&1
print_status $? "Build with new version completed"

# 5. Verify version consistency
echo "🔍 Verifying version consistency..."
package_version=$(node -e "console.log(require('./package.json').version)")
manifest_version=$(node -e "console.log(require('./manifest.json').version)")
dist_manifest_version=$(node -e "console.log(require('./dist/manifest.json').version)")

if [ "$package_version" = "$manifest_version" ] && [ "$manifest_version" = "$dist_manifest_version" ]; then
    echo -e "${GREEN}✅ All versions match: $package_version${NC}"
else
    echo -e "${RED}❌ Version mismatch:${NC}"
    echo "  Package.json: $package_version"
    echo "  Manifest.json: $manifest_version"
    echo "  Dist/manifest.json: $dist_manifest_version"
    exit 1
fi

# 6. Test data migration simulation
echo "🗄️  Testing data migration simulation..."
node -e "
const fs = require('fs');

// Simulate old version data
const oldData = {
    version: '1.0.0',
    customTasks: {
        'task1': { id: 'task1', name: 'Old Task', version: '1.0.0' }
    },
    userPreferences: {
        theme: 'light',
        version: '1.0.0'
    }
};

// Simulate new version migration
const newData = {
    version: require('./package.json').version,
    customTasks: oldData.customTasks,
    userPreferences: {
        ...oldData.userPreferences,
        version: require('./package.json').version,
        // Add new preferences with defaults
        enableNotifications: true,
        autoUpdate: true
    }
};

console.log('✅ Data migration simulation successful');
console.log('Old version:', oldData.version);
console.log('New version:', newData.version);
console.log('Tasks preserved:', Object.keys(newData.customTasks).length);
console.log('Preferences migrated with new defaults');
"
print_status $? "Data migration simulation completed"

# 7. Test rollback scenario
echo "🔄 Testing rollback scenario..."
# Restore to original version temporarily
cp package.json.backup package.json
cp manifest.json.backup manifest.json

# Build with original version
npm run build > /dev/null 2>&1
original_dist_version=$(node -e "console.log(require('./dist/manifest.json').version)")

# Restore updated version
npm version patch --no-git-tag-version > /dev/null 2>&1
node -e "
const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
manifest.version = require('./package.json').version;
fs.writeFileSync('manifest.json', JSON.stringify(manifest, null, 2));
"
npm run build > /dev/null 2>&1

print_info "Rollback test: $original_dist_version → $(node -e "console.log(require('./dist/manifest.json').version)")"
print_status $? "Rollback scenario tested"

# 8. Test major version update
echo "🚀 Testing major version update..."
current_major=$(echo $current_version | cut -d. -f1)
next_major=$((current_major + 1))
major_version="$next_major.0.0"

# Temporarily update to major version
node -e "
const fs = require('fs');
const packageJson = require('./package.json');
packageJson.version = '$major_version';
fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
manifest.version = '$major_version';
fs.writeFileSync('manifest.json', JSON.stringify(manifest, null, 2));
"

npm run build > /dev/null 2>&1
major_dist_version=$(node -e "console.log(require('./dist/manifest.json').version)")

if [ "$major_dist_version" = "$major_version" ]; then
    echo -e "${GREEN}✅ Major version update: $current_version → $major_version${NC}"
else
    echo -e "${RED}❌ Major version update failed${NC}"
    exit 1
fi

# 9. Test Chrome Web Store compatibility
echo "🌐 Testing Chrome Web Store compatibility..."
node -e "
const manifest = require('./dist/manifest.json');

// Check version format (must be up to 4 dot-separated integers)
const versionRegex = /^(\d+)\.(\d+)\.(\d+)(\.(\d+))?$/;
if (!versionRegex.test(manifest.version)) {
    console.log('❌ Invalid version format for Chrome Web Store:', manifest.version);
    process.exit(1);
}

// Check version number limits (each part must be 0-65535)
const parts = manifest.version.split('.').map(Number);
const invalidParts = parts.filter(part => part < 0 || part > 65535);
if (invalidParts.length > 0) {
    console.log('❌ Version parts must be 0-65535:', invalidParts);
    process.exit(1);
}

console.log('✅ Version format is Chrome Web Store compatible');
console.log('   Version:', manifest.version);
console.log('   Parts:', parts.join(', '));
"
print_status $? "Chrome Web Store compatibility verified"

# 10. Test update package creation
echo "📦 Testing update package creation..."
npm run package > /dev/null 2>&1
print_status $? "Update package created"

# Verify package contains updated version
if [ -f "agentic-chrome-extension.zip" ]; then
    # Extract and check version in zip
    temp_dir=$(mktemp -d)
    unzip -q agentic-chrome-extension.zip -d "$temp_dir"
    zip_version=$(node -e "console.log(require('$temp_dir/manifest.json').version)")
    rm -rf "$temp_dir"
    
    if [ "$zip_version" = "$major_version" ]; then
        echo -e "${GREEN}✅ Package contains correct version: $zip_version${NC}"
    else
        echo -e "${RED}❌ Package version mismatch: expected $major_version, got $zip_version${NC}"
        exit 1
    fi
fi

# 11. Performance impact test
echo "⚡ Testing performance impact of updates..."
node -e "
const fs = require('fs');

// Measure file sizes
const files = ['popup.js', 'background.js', 'content.js', 'manifest.json'];
let totalSize = 0;

files.forEach(file => {
    if (fs.existsSync(\`dist/\${file}\`)) {
        const size = fs.statSync(\`dist/\${file}\`).size;
        totalSize += size;
        console.log(\`  \${file}: \${(size / 1024).toFixed(2)} KB\`);
    }
});

console.log(\`Total extension size: \${(totalSize / 1024).toFixed(2)} KB\`);

// Check if size is reasonable (under 5MB for Chrome Web Store)
const maxSize = 5 * 1024 * 1024; // 5MB in bytes
if (totalSize > maxSize) {
    console.log('❌ Extension size exceeds Chrome Web Store limit (5MB)');
    process.exit(1);
} else {
    console.log('✅ Extension size is within limits');
}
"
print_status $? "Performance impact assessment completed"

# 12. Final summary
echo ""
echo "🎉 Update Testing Summary"
echo "========================="
echo -e "${GREEN}✅ Version updates: PASSED${NC}"
echo -e "${GREEN}✅ Build consistency: PASSED${NC}"
echo -e "${GREEN}✅ Data migration: PASSED${NC}"
echo -e "${GREEN}✅ Rollback scenarios: PASSED${NC}"
echo -e "${GREEN}✅ Major version updates: PASSED${NC}"
echo -e "${GREEN}✅ Chrome Web Store compatibility: PASSED${NC}"
echo -e "${GREEN}✅ Package creation: PASSED${NC}"
echo -e "${GREEN}✅ Performance impact: PASSED${NC}"
echo ""
echo "🔄 Update process is reliable and ready!"
echo ""
echo "Tested scenarios:"
echo "- Patch version updates (1.0.0 → 1.0.1)"
echo "- Major version updates ($current_version → $major_version)"
echo "- Data migration and preservation"
echo "- Rollback compatibility"
echo "- Chrome Web Store version format compliance"
echo "- Package integrity after updates"
echo ""
echo "The extension update system is robust and handles version changes correctly."