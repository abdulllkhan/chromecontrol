# ChromeControl - AI-Powered Chrome Sidebar Extension

An intelligent Chrome extension that provides contextual AI assistance through a persistent sidebar interface, offering smart suggestions and automation based on real-time webpage analysis.

## Overview

ChromeControl is a Chrome extension that runs as an always-active sidebar panel, providing continuous AI-powered assistance while you browse. Unlike traditional popup extensions, the sidebar remains accessible throughout your browsing session, offering contextual help, task automation, and intelligent suggestions based on the current webpage content.

## Key Features

### Core Capabilities
- **Persistent Sidebar Interface**: Always-active side panel that doesn't close when you switch tabs
- **Real-time Page Analysis**: Automatic detection and categorization of websites
- **Contextual AI Suggestions**: Smart recommendations based on current page content
- **Custom Task Management**: Create, save, and execute personalized AI tasks
- **Intelligent Text Extraction**: Advanced content parsing that preserves structure
- **Template Variable System**: Dynamic prompts with `{{domain}}`, `{{pageTitle}}`, `{{selectedText}}` variables

### AI Integration
- **Multi-Provider Support**: OpenAI (GPT-5, GPT-4.1, o4-mini) and Claude integration
- **Custom Prompt Templates**: Define your own AI task templates with variable injection
- **Smart Context Building**: MCP (Model Context Protocol) compliant context management
- **Prompt Debugging Tools**: Preview and validate prompts before execution

### Privacy & Security
- **Privacy-First Design**: Local processing with opt-in data sharing
- **Sensitive Data Protection**: Automatic detection and filtering of sensitive information
- **Domain-Based Security Levels**: Different handling for public, cautious, and restricted sites
- **No Encryption Storage**: Transparent data storage per user preference

## Quick Start

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/chromecontrol.git
   cd chromecontrol
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the extension:**
   ```bash
   npm run build
   ```

4. **Load in Chrome:**
   - Open `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `dist` folder

5. **Activate the sidebar:**
   - Click the ChromeControl extension icon in your toolbar
   - The sidebar will open and remain active

### Development

```bash
# Development build with hot reload
npm run dev

# Production build
npm run build

# Type checking
npm run type-check

# Linting
npm run lint

# Run tests
npm test
```

## Project Structure

```
chromecontrol/
├── src/
│   ├── background/         # Background service worker
│   ├── content/           # Content scripts for page interaction
│   ├── sidebar/           # Sidebar UI (React components)
│   ├── components/        # Shared React components
│   ├── services/          # Core services (AI, MCP, Storage, etc.)
│   │   ├── aiService.ts       # OpenAI integration
│   │   ├── claudeService.ts   # Claude AI integration
│   │   ├── mcpService.ts      # MCP context management
│   │   ├── taskManager.ts     # Task execution engine
│   │   ├── promptManager.ts   # Template variable injection
│   │   └── storage.ts         # Chrome storage layer
│   ├── types/             # TypeScript definitions
│   └── utils/             # Utility functions
├── dist/                  # Built extension files
├── docs/                  # Documentation
├── icons/                 # Extension icons
└── manifest.json          # Chrome extension manifest v3
```

## Architecture

### Component Overview

1. **Sidebar Panel**: Persistent React-based UI that remains active across tabs
2. **Background Service Worker**: Handles AI requests, storage, and message routing
3. **Content Scripts**: Analyze and interact with webpage content
4. **MCP Service**: Builds structured context following Model Context Protocol
5. **Task Manager**: Executes custom tasks with template variable injection
6. **Prompt Manager**: Processes custom prompts with variable substitution

### Data Flow

```
User Action → Sidebar → Background Worker → Content Script
                ↓             ↓                    ↓
           Task Manager → AI Service → Page Analysis
                ↓             ↓                    ↓
           MCP Context → Response → DOM Interaction
```

## Configuration

### AI Provider Setup

1. Open the sidebar and click on Settings
2. Navigate to AI Configuration
3. Choose your provider (OpenAI or Claude)
4. Enter your API key
5. Select your preferred model
6. Test the connection

### Custom Task Creation

1. Click "Add Task" in the sidebar
2. Define your task with:
   - Name and description
   - Website patterns (domains where it applies)
   - Prompt template with variables
   - Output format preference
3. Save and the task will appear for matching websites

## Advanced Features

### Template Variables

Use these variables in your custom task prompts:
- `{{domain}}` - Current website domain
- `{{pageTitle}}` - Page title
- `{{selectedText}}` - User-selected text
- `{{pageContent}}` - Extracted page content
- `{{url}}` - Full page URL

### MCP Integration

ChromeControl implements Model Context Protocol for structured AI context:
- Resources: Page content, user preferences, website context
- Tools: Text extraction, page analysis, task execution
- Prompts: System and custom prompt templates
- Metadata: Session tracking and capabilities

## Documentation

- [Quick Start Guide](docs/QUICK_START.md) - Get running in 5 minutes
- [Developer Setup](docs/DEVELOPER_SETUP.md) - Detailed development guide
- [API Documentation](docs/API_DOCS.md) - Service and component APIs
- [MCP Implementation](docs/MCP_IMPLEMENTATION_ISSUES.md) - Known issues and fixes

## Current Status

**Version**: 1.0.0
**Stage**: Active Development

### Recent Updates
- ✅ Migrated from popup to persistent sidebar architecture
- ✅ Implemented MCP context management system
- ✅ Added custom task prompt template system
- ✅ Integrated Claude AI alongside OpenAI
- ✅ Created PromptManager for template variable injection

### In Progress
- 🔧 Building intelligent text extraction engine
- 🔧 Enhancing content script for better text extraction
- 🔧 Adding prompt debugging and validation tools

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Follow the existing code style and TypeScript conventions
4. Add tests for new functionality
5. Update documentation as needed
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Check existing documentation in the `docs/` folder
- Review the [troubleshooting guide](docs/TROUBLESHOOTING.md)

## Acknowledgments

- Built with Chrome Extension Manifest V3
- Powered by OpenAI and Anthropic Claude
- Implements Model Context Protocol (MCP) standards
- React and TypeScript for robust UI development

---

**Note**: This extension requires an API key from either OpenAI or Anthropic to function. AI features will not work without proper configuration.