# ChromeControl Extension - Developer Setup Guide

This guide will walk you through setting up the ChromeControl extension in Chrome's developer mode for testing and development.

## Prerequisites

- Google Chrome browser (latest version recommended)
- Node.js (v16 or higher)
- npm or yarn package manager

## Step 1: Clone and Build the Extension

1. **Clone the repository** (if not already done):
   ```bash
   git clone <repository-url>
   cd chromecontrol
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the extension**:
   ```bash
   npm run build
   ```
   
   This creates the `dist/` folder with the compiled extension files.

## Step 2: Load Extension in Chrome Developer Mode

### Enable Developer Mode

1. **Open Chrome Extensions page**:
   - Type `chrome://extensions/` in the address bar and press Enter
   - OR click the three dots menu → More tools → Extensions

2. **Enable Developer Mode**:
   - Look for the "Developer mode" toggle in the top-right corner
   - Click to enable it (it should turn blue/on)

### Load the Extension

3. **Load unpacked extension**:
   - Click the "Load unpacked" button that appears after enabling developer mode
   - Navigate to your project directory (the root folder containing `manifest.json`)
   - Select the folder and click "Select Folder" or "Open"

4. **Verify installation**:
   - The extension should appear in your extensions list as "ChromeControl"
   - You should see the extension icon in your Chrome toolbar
   - If there are any errors, they'll be displayed in red text

## Step 3: Test the Extension

### Basic Functionality Test

1. **Click the extension icon** in the Chrome toolbar
2. **Verify popup opens** with "ChromeControl" heading
3. **Check browser console** for any JavaScript errors:
   - Right-click on any webpage → Inspect → Console tab
   - Look for ChromeControl-related messages

### Background Script Testing

1. **Go to Extensions page** (`chrome://extensions/`)
2. **Find ChromeControl** in the list
3. **Click "service worker"** link to open background script console
4. **Check for initialization messages**

## Step 4: Development Workflow

### Making Changes

1. **Edit source files** in the `src/` directory
2. **Rebuild the extension**:
   ```bash
   npm run build
   ```
3. **Reload the extension**:
   - Go to `chrome://extensions/`
   - Find ChromeControl
   - Click the refresh/reload icon (circular arrow)

### Development Mode with Auto-rebuild

For faster development, use watch mode:
```bash
npm run dev
```
This automatically rebuilds when you make changes to source files.

## Troubleshooting

### Common Issues

**Extension won't load:**
- Check that all icon files exist in `icons/` directory
- Verify `manifest.json` syntax is valid
- Ensure `dist/` folder exists and contains built files

**Popup doesn't open:**
- Check browser console for JavaScript errors
- Verify `popup.html` exists in root directory
- Check that `dist/popup.js` was built correctly

**Content script not working:**
- Check the Extensions page for any error messages
- Verify permissions in `manifest.json`
- Test on different websites (some sites block extensions)

**Build errors:**
- Run `npm run type-check` to check TypeScript errors
- Run `npm run lint` to check code quality issues
- Ensure all dependencies are installed with `npm install`

### Debugging Tips

1. **Use Chrome DevTools**:
   - Right-click extension popup → Inspect
   - Check Console, Network, and Elements tabs

2. **Check Extension Console**:
   - Go to `chrome://extensions/`
   - Click "service worker" for background script debugging

3. **View Extension Storage**:
   - Open DevTools → Application tab → Storage → Extension Storage

## File Structure Reference

```
chromecontrol/
├── manifest.json          # Extension configuration
├── popup.html            # Popup HTML template
├── dist/                 # Built extension files
│   ├── background.js     # Background service worker
│   ├── content.js        # Content script
│   └── popup.js          # Popup React app
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── src/                  # Source code
    ├── background/
    ├── content/
    ├── popup/
    └── components/
```

## Next Steps

Once the extension is loaded successfully:
1. Test all basic functionality
2. Check that content scripts load on web pages
3. Verify popup UI displays correctly
4. Begin implementing additional features from the task list

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review Chrome extension development documentation
3. Check browser console for error messages
4. Verify all build steps completed successfully