#!/bin/bash
# Deployment verification script for Agentic Chrome Extension

set -e

echo "🔍 Verifying Deployment Readiness..."
echo "===================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Checklist items
checklist_items=(
    "Extension builds without errors"
    "All required files present"
    "Manifest.json is valid"
    "Icons are available"
    "File sizes within limits"
    "Package creates successfully"
    "Store listing documentation ready"
    "Privacy policy available"
    "Installation instructions ready"
)

passed_checks=0
total_checks=${#checklist_items[@]}

echo "📋 Deployment Checklist:"
echo "========================"

# Check 1: Build status
if [ -d "dist" ] && [ -f "dist/manifest.json" ] && [ -f "dist/popup.js" ] && [ -f "dist/background.js" ] && [ -f "dist/content.js" ]; then
    echo -e "${GREEN}✅ ${checklist_items[0]}${NC}"
    ((passed_checks++))
else
    echo -e "${RED}❌ ${checklist_items[0]}${NC}"
fi

# Check 2: Required files
required_files=("dist/manifest.json" "dist/popup.js" "dist/background.js" "dist/content.js" "dist/icons/icon16.png" "dist/icons/icon48.png" "dist/icons/icon128.png")
all_files_present=true
for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        all_files_present=false
        break
    fi
done

if [ "$all_files_present" = true ]; then
    echo -e "${GREEN}✅ ${checklist_items[1]}${NC}"
    ((passed_checks++))
else
    echo -e "${RED}❌ ${checklist_items[1]}${NC}"
fi

# Check 3: Manifest validation
if [ -f "dist/manifest.json" ]; then
    manifest_valid=$(node -e "
    try {
        const manifest = require('./dist/manifest.json');
        if (manifest.manifest_version === 3 && manifest.name && manifest.version && manifest.description) {
            console.log('true');
        } else {
            console.log('false');
        }
    } catch (e) {
        console.log('false');
    }
    ")
    
    if [ "$manifest_valid" = "true" ]; then
        echo -e "${GREEN}✅ ${checklist_items[2]}${NC}"
        ((passed_checks++))
    else
        echo -e "${RED}❌ ${checklist_items[2]}${NC}"
    fi
else
    echo -e "${RED}❌ ${checklist_items[2]}${NC}"
fi

# Check 4: Icons
if [ -f "dist/icons/icon16.png" ] && [ -f "dist/icons/icon48.png" ] && [ -f "dist/icons/icon128.png" ]; then
    echo -e "${GREEN}✅ ${checklist_items[3]}${NC}"
    ((passed_checks++))
else
    echo -e "${RED}❌ ${checklist_items[3]}${NC}"
fi

# Check 5: File sizes
if [ -d "dist" ]; then
    total_size=$(find dist -type f -exec stat -f%z {} + 2>/dev/null | awk '{sum+=$1} END {print sum}' || find dist -type f -exec stat -c%s {} + 2>/dev/null | awk '{sum+=$1} END {print sum}')
    total_size_mb=$((total_size / 1024 / 1024))
    
    if [ $total_size_mb -lt 5 ]; then
        echo -e "${GREEN}✅ ${checklist_items[4]} (${total_size_mb}MB < 5MB limit)${NC}"
        ((passed_checks++))
    else
        echo -e "${RED}❌ ${checklist_items[4]} (${total_size_mb}MB exceeds 5MB limit)${NC}"
    fi
else
    echo -e "${RED}❌ ${checklist_items[4]}${NC}"
fi

# Check 6: Package
if [ -f "agentic-chrome-extension.zip" ]; then
    echo -e "${GREEN}✅ ${checklist_items[5]}${NC}"
    ((passed_checks++))
else
    echo -e "${RED}❌ ${checklist_items[5]}${NC}"
fi

# Check 7: Store listing documentation
if [ -f "docs/STORE_LISTING.md" ]; then
    echo -e "${GREEN}✅ ${checklist_items[6]}${NC}"
    ((passed_checks++))
else
    echo -e "${RED}❌ ${checklist_items[6]}${NC}"
fi

# Check 8: Privacy policy
if [ -f "docs/PRIVACY_POLICY.md" ]; then
    echo -e "${GREEN}✅ ${checklist_items[7]}${NC}"
    ((passed_checks++))
else
    echo -e "${RED}❌ ${checklist_items[7]}${NC}"
fi

# Check 9: Installation instructions
if [ -f "docs/INSTALLATION_TESTING.md" ] && [ -f "docs/DEPLOYMENT_CHECKLIST.md" ]; then
    echo -e "${GREEN}✅ ${checklist_items[8]}${NC}"
    ((passed_checks++))
else
    echo -e "${RED}❌ ${checklist_items[8]}${NC}"
fi

echo ""
echo "📊 Deployment Readiness Score: $passed_checks/$total_checks"

if [ $passed_checks -eq $total_checks ]; then
    echo -e "${GREEN}🎉 READY FOR DEPLOYMENT!${NC}"
    echo ""
    echo "🚀 Deployment Instructions:"
    echo "=========================="
    echo "1. Go to Chrome Web Store Developer Dashboard"
    echo "2. Click 'Add new item'"
    echo "3. Upload 'agentic-chrome-extension.zip'"
    echo "4. Fill in store listing using 'docs/STORE_LISTING.md'"
    echo "5. Upload promotional images from 'promotional/' directory"
    echo "6. Link privacy policy from 'docs/PRIVACY_POLICY.md'"
    echo "7. Submit for review"
    echo ""
    echo "📋 Required Information:"
    echo "- Extension name: Agentic Chrome Extension"
    echo "- Category: Productivity"
    echo "- Description: Available in docs/STORE_LISTING.md"
    echo "- Privacy policy: Available in docs/PRIVACY_POLICY.md"
    echo ""
    exit 0
else
    echo -e "${RED}❌ NOT READY FOR DEPLOYMENT${NC}"
    echo ""
    echo "🔧 Issues to resolve:"
    
    # Show specific issues
    if [ ! -d "dist" ]; then
        echo "- Run build process: npm run build"
    fi
    
    if [ ! -f "agentic-chrome-extension.zip" ]; then
        echo "- Create package: npm run package"
    fi
    
    if [ ! -f "docs/STORE_LISTING.md" ]; then
        echo "- Store listing documentation missing"
    fi
    
    if [ ! -f "docs/PRIVACY_POLICY.md" ]; then
        echo "- Privacy policy documentation missing"
    fi
    
    echo ""
    echo "Run './scripts/deploy-build.sh' to build the extension"
    exit 1
fi