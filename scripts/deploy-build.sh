#!/bin/bash
# Simplified deployment build script for Agentic Chrome Extension

set -e  # Exit on any error

echo "🚀 Building Agentic Chrome Extension for Deployment..."
echo "===================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# 1. Clean previous build
echo "🧹 Cleaning previous build..."
npm run clean
print_status $? "Clean completed"

# 2. Build extension for production
echo "🔨 Building extension for production..."
npm run build:prod
print_status $? "Production build completed"

# 3. Copy required assets
echo "📋 Copying assets..."
npm run copy-content
npm run copy-assets
print_status $? "Assets copied"

# 4. Verify required files exist
echo "🔍 Verifying build output..."
required_files=("manifest.json" "popup.js" "background.js" "content.js")
for file in "${required_files[@]}"; do
    if [ -f "dist/$file" ]; then
        echo -e "${GREEN}✅ Found: $file${NC}"
    else
        echo -e "${RED}❌ Missing: $file${NC}"
        exit 1
    fi
done

# 5. Verify icons
if [ -d "dist/icons" ]; then
    icon_files=("icon16.png" "icon48.png" "icon128.png")
    for icon in "${icon_files[@]}"; do
        if [ -f "dist/icons/$icon" ]; then
            echo -e "${GREEN}✅ Found: icons/$icon${NC}"
        else
            echo -e "${RED}❌ Missing: icons/$icon${NC}"
            exit 1
        fi
    done
else
    echo -e "${RED}❌ Missing: icons directory${NC}"
    exit 1
fi

# 6. Validate manifest
echo "📋 Validating manifest..."
node -e "
const fs = require('fs');
try {
    const manifest = JSON.parse(fs.readFileSync('dist/manifest.json', 'utf8'));
    
    // Check required fields
    const required = ['manifest_version', 'name', 'version', 'description'];
    const missing = required.filter(field => !manifest[field]);
    
    if (missing.length > 0) {
        console.log('❌ Missing required manifest fields:', missing.join(', '));
        process.exit(1);
    }
    
    if (manifest.manifest_version !== 3) {
        console.log('❌ Invalid manifest version. Expected 3, got:', manifest.manifest_version);
        process.exit(1);
    }
    
    console.log('✅ Manifest is valid');
    console.log('   Name:', manifest.name);
    console.log('   Version:', manifest.version);
    console.log('   Description:', manifest.description.substring(0, 50) + '...');
    
} catch (error) {
    console.log('❌ Manifest validation failed:', error.message);
    process.exit(1);
}
"
print_status $? "Manifest validation completed"

# 7. Check file sizes
echo "📏 Checking file sizes..."
total_size=0
for file in "${required_files[@]}"; do
    if [ -f "dist/$file" ]; then
        size=$(stat -f%z "dist/$file" 2>/dev/null || stat -c%s "dist/$file" 2>/dev/null)
        size_kb=$((size / 1024))
        total_size=$((total_size + size))
        echo -e "${GREEN}✅ $file: ${size_kb} KB${NC}"
    fi
done

total_size_kb=$((total_size / 1024))
echo -e "${GREEN}📦 Total extension size: ${total_size_kb} KB${NC}"

# Check Chrome Web Store size limit (5MB = 5120KB)
if [ $total_size_kb -gt 5120 ]; then
    echo -e "${RED}❌ Extension size exceeds Chrome Web Store limit (5MB)${NC}"
    exit 1
else
    echo -e "${GREEN}✅ Extension size is within Chrome Web Store limits${NC}"
fi

# 8. Create distribution package
echo "📦 Creating distribution package..."
npm run create-zip
print_status $? "Distribution package created"

# 9. Final verification
if [ -f "agentic-chrome-extension.zip" ]; then
    zip_size=$(stat -f%z "agentic-chrome-extension.zip" 2>/dev/null || stat -c%s "agentic-chrome-extension.zip" 2>/dev/null)
    zip_size_kb=$((zip_size / 1024))
    echo -e "${GREEN}✅ Package created: agentic-chrome-extension.zip (${zip_size_kb} KB)${NC}"
else
    echo -e "${RED}❌ Package creation failed${NC}"
    exit 1
fi

echo ""
echo "🎉 Deployment Build Complete!"
echo "============================="
echo -e "${GREEN}✅ Extension built successfully${NC}"
echo -e "${GREEN}✅ All required files present${NC}"
echo -e "${GREEN}✅ Manifest validated${NC}"
echo -e "${GREEN}✅ Size within limits${NC}"
echo -e "${GREEN}✅ Distribution package ready${NC}"
echo ""
echo "📦 Files ready for deployment:"
echo "   - dist/ (for developer installation)"
echo "   - agentic-chrome-extension.zip (for Chrome Web Store)"
echo ""
echo "🚀 Next steps:"
echo "   1. Test the extension by loading dist/ in Chrome developer mode"
echo "   2. Upload agentic-chrome-extension.zip to Chrome Web Store"
echo "   3. Complete store listing with promotional materials"
echo ""