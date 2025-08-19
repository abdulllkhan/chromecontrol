# Agentic Chrome Extension

An intelligent Chrome extension that provides contextual AI-powered suggestions based on website analysis.

## Features

- Automatic website detection and analysis
- Contextual AI-powered suggestions
- Custom task creation and management
- Automated web page interactions
- Privacy-focused design

## Quick Start

For a fast setup, see our [Quick Start Guide](docs/QUICK_START.md).

For detailed developer setup instructions, see [Developer Setup Guide](docs/DEVELOPER_SETUP.md).

### TL;DR
```bash
npm install && npm run build
```
Then load in Chrome: `chrome://extensions/` → Enable Developer mode → Load unpacked

## Documentation

- 📖 **[Documentation Hub](docs/README.md)** - Complete documentation index
- 🚀 **[Quick Start](docs/QUICK_START.md)** - Get running in 5 minutes  
- 🔧 **[Developer Setup](docs/DEVELOPER_SETUP.md)** - Detailed development guide

### Development

- **Development build with watch mode:**
  ```bash
  npm run dev
  ```

- **Production build:**
  ```bash
  npm run build
  ```

- **Type checking:**
  ```bash
  npm run type-check
  ```

- **Linting:**
  ```bash
  npm run lint
  ```

## Project Structure

```
├── src/
│   ├── background/          # Background service worker
│   ├── content/            # Content scripts
│   ├── popup/              # Popup UI components
│   ├── components/         # Shared React components
│   ├── types/              # TypeScript type definitions
│   └── utils/              # Utility functions
├── types/                  # Global type definitions
├── icons/                  # Extension icons
├── dist/                   # Built extension files
├── manifest.json           # Chrome extension manifest
└── popup.html             # Popup HTML template
```

## Architecture

The extension follows a modular architecture with:

- **Background Service Worker**: Handles AI requests, storage, and cross-tab communication
- **Content Scripts**: Analyze page content and execute DOM manipulations
- **Popup UI**: React-based interface for user interactions
- **Storage Layer**: Manages custom tasks, preferences, and cache

## Contributing

1. Follow the existing code style and TypeScript conventions
2. Add tests for new functionality
3. Update documentation as needed
4. Ensure all builds pass before submitting PRs

## License

[Add your license here]