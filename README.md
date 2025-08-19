# Agentic Chrome Extension

An intelligent Chrome extension that provides contextual AI-powered suggestions based on website analysis.

## Features

- Automatic website detection and analysis
- Contextual AI-powered suggestions
- Custom task creation and management
- Automated web page interactions
- Privacy-focused design

## Development Setup

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Chrome browser for testing

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the project directory

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