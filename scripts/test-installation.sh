#!/bin/bash
# Installation testing script for Agentic Chrome Extension

set -e  # Exit on any error

echo "🚀 Starting Agentic Chrome Extension Installation Tests..."
echo "=================================================="

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

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# 1. Clean and build extension
echo "📦 Building extension..."
npm run clean
npm run build
print_status $? "Extension build completed"

# 2. Verify required files exist
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

# 3. Verify icons directory
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

# 4. Validate manifest.json structure
echo "📋 Validating manifest structure..."
node -e "
const fs = require('fs');
const path = require('path');

try {
    const manifest = JSON.parse(fs.readFileSync('dist/manifest.json', 'utf8'));
    
    // Check required fields
    const required = ['manifest_version', 'name', 'version', 'description'];
    const missing = required.filter(field => !manifest[field]);
    
    if (missing.length > 0) {
        console.log('❌ Missing required manifest fields:', missing.join(', '));
        process.exit(1);
    }
    
    // Check manifest version
    if (manifest.manifest_version !== 3) {
        console.log('❌ Invalid manifest version. Expected 3, got:', manifest.manifest_version);
        process.exit(1);
    }
    
    // Check permissions
    if (!manifest.permissions || !Array.isArray(manifest.permissions)) {
        console.log('❌ Invalid or missing permissions array');
        process.exit(1);
    }
    
    // Check icons
    if (!manifest.icons || !manifest.icons['16'] || !manifest.icons['48'] || !manifest.icons['128']) {
        console.log('❌ Missing required icon sizes in manifest');
        process.exit(1);
    }
    
    console.log('✅ Manifest structure is valid');
    console.log('   Name:', manifest.name);
    console.log('   Version:', manifest.version);
    console.log('   Permissions:', manifest.permissions.length, 'permissions');
    
} catch (error) {
    console.log('❌ Manifest validation failed:', error.message);
    process.exit(1);
}
"
print_status $? "Manifest validation completed"

# 5. Check file sizes (ensure they're not empty)
echo "📏 Checking file sizes..."
for file in "${required_files[@]}"; do
    size=$(stat -f%z "dist/$file" 2>/dev/null || stat -c%s "dist/$file" 2>/dev/null)
    if [ "$size" -gt 0 ]; then
        echo -e "${GREEN}✅ $file: ${size} bytes${NC}"
    else
        echo -e "${RED}❌ $file is empty${NC}"
        exit 1
    fi
done

# 6. Test packaging
echo "📦 Testing extension packaging..."
npm run package
print_status $? "Extension packaging completed"

# 7. Verify zip contents
if [ -f "agentic-chrome-extension.zip" ]; then
    echo "📋 Verifying zip contents..."
    zip_contents=$(unzip -l agentic-chrome-extension.zip | grep -E '\.(js|json|html|png)$' | wc -l)
    if [ "$zip_contents" -gt 0 ]; then
        echo -e "${GREEN}✅ Zip contains $zip_contents files${NC}"
        
        # Show zip contents
        echo "📄 Zip contents:"
        unzip -l agentic-chrome-extension.zip | grep -E '\.(js|json|html|png)$' | awk '{print "   " $4}'
    else
        echo -e "${RED}❌ Zip appears to be empty or invalid${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ Package zip file not created${NC}"
    exit 1
fi

# 8. Run linting and type checking
echo "🔍 Running code quality checks..."
npm run lint
print_status $? "Linting completed"

npm run type-check
print_status $? "Type checking completed"

# 9. Run tests
echo "🧪 Running test suite..."
npm run test:run
print_status $? "Test suite completed"

# 10. Check for common Chrome extension issues
echo "🔍 Checking for common extension issues..."

# Check for eval() usage (not allowed in manifest v3)
if grep -r "eval(" dist/ --include="*.js" > /dev/null 2>&1; then
    echo -e "${RED}❌ Found eval() usage - not allowed in Manifest V3${NC}"
    exit 1
else
    echo -e "${GREEN}✅ No eval() usage found${NC}"
fi

# Check for inline scripts in HTML
if grep -r "javascript:" dist/ --include="*.html" > /dev/null 2>&1; then
    echo -e "${RED}❌ Found inline JavaScript - not allowed${NC}"
    exit 1
else
    echo -e "${GREEN}✅ No inline JavaScript found${NC}"
fi

# 11. Final summary
echo ""
echo "🎉 Installation Testing Summary"
echo "================================"
echo -e "${GREEN}✅ Build process: PASSED${NC}"
echo -e "${GREEN}✅ File structure: PASSED${NC}"
echo -e "${GREEN}✅ Manifest validation: PASSED${NC}"
echo -e "${GREEN}✅ Packaging: PASSED${NC}"
echo -e "${GREEN}✅ Code quality: PASSED${NC}"
echo -e "${GREEN}✅ Test suite: PASSED${NC}"
echo -e "${GREEN}✅ Extension compliance: PASSED${NC}"
echo ""
echo "🚀 Extension is ready for installation!"
echo ""
echo "Next steps:"
echo "1. Load unpacked extension from 'dist' directory in Chrome"
echo "2. Test core functionality manually"
echo "3. Submit to Chrome Web Store when ready"
echo ""
echo "Files created:"
echo "- dist/ (extension files)"
echo "- agentic-chrome-extension.zip (distribution package)"