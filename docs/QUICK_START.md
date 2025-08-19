# ChromeControl - Quick Start Guide

Get ChromeControl up and running in Chrome developer mode in under 5 minutes.

## TL;DR - Fast Setup

```bash
# 1. Install dependencies
npm install

# 2. Build the extension
npm run build

# 3. Load in Chrome
# - Open chrome://extensions/
# - Enable "Developer mode"
# - Click "Load unpacked"
# - Select this project folder
```

## Detailed Steps

### 1. Prerequisites Check
- ✅ Chrome browser installed
- ✅ Node.js v16+ installed
- ✅ Project files downloaded/cloned

### 2. Build the Extension
```bash
npm install
npm run build
```

### 3. Load in Chrome
1. Open Chrome and go to `chrome://extensions/`
2. Toggle "Developer mode" ON (top-right corner)
3. Click "Load unpacked" button
4. Navigate to and select your project folder
5. Click "Select Folder"

### 4. Verify Installation
- ✅ Extension appears in extensions list as "ChromeControl"
- ✅ Extension icon visible in Chrome toolbar
- ✅ Clicking icon opens popup with "ChromeControl" heading
- ✅ No error messages in extensions page

## What's Next?

- **Test the extension**: Click the icon, check popup functionality
- **Start developing**: Use `npm run dev` for auto-rebuild during development
- **Read full docs**: Check [DEVELOPER_SETUP.md](DEVELOPER_SETUP.md) for detailed information

## Troubleshooting

**Extension won't load?**
- Check that `dist/` folder exists after running `npm run build`
- Verify all icon files are present in `icons/` directory

**Build failing?**
- Run `npm run type-check` to check for TypeScript errors
- Ensure Node.js version is 16 or higher

**Need help?** See the full [Developer Setup Guide](DEVELOPER_SETUP.md) for detailed troubleshooting.