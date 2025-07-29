# Stagewise CLI Architecture

## Overview
The Stagewise CLI is a Node.js application that provides a local development server with proxy capabilities, authentication, and plugin support.

## Directory Structure

```
src/
├── auth/                    # Authentication and OAuth handling
│   ├── oauth.ts            # OAuth flow implementation
│   └── token-manager.ts    # Token storage and management
├── config/                  # Configuration management
│   ├── argparse.ts         # Command-line argument parsing
│   ├── config-file.ts      # Configuration file handling
│   ├── index.ts            # Main configuration resolver
│   └── types.ts            # Configuration type definitions
├── dependency-parser/       # Project dependency discovery
│   ├── index.ts            # Main dependency parser
│   ├── types.ts            # Dependency type definitions
│   └── utils.ts            # Parser utility functions
├── server/                  # HTTP/WebSocket server implementation
│   ├── agent-loader.ts     # Agent initialization and management
│   ├── error-page.ts       # Error page generation
│   ├── index.ts            # Express server setup
│   ├── plugin-loader.ts    # Plugin discovery and loading
│   └── proxy.ts            # HTTP proxy middleware
├── utils/                   # Utility functions
│   ├── banner.ts           # CLI banner display
│   ├── logger.ts           # Logging utilities
│   └── user-input.ts       # User input handling
└── index.ts                # Application entry point
```

## Testing Structure

### Standards
- **Test Framework**: Vitest (consistent across all tests)
- **Test File Pattern**: `*.test.ts`
- **Test Location**: `__tests__` directories within feature folders
- **Test Organization**: Each module should have corresponding tests in its `__tests__` directory

### Current Structure
```
src/
├── auth/
│   ├── __tests__/
│   │   └── token-manager.test.ts
│   ├── oauth.ts
│   └── token-manager.ts
├── config/
│   ├── __tests__/
│   │   └── config-file.test.ts
│   ├── argparse.ts
│   ├── config-file.ts
│   └── index.ts
├── dependency-parser/
│   ├── __tests__/
│   │   ├── index.test.ts
│   │   └── utils.test.ts
│   ├── index.ts
│   ├── types.ts
│   └── utils.ts
├── server/
│   ├── __tests__/
│   │   └── error-page.test.ts
│   ├── agent-loader.ts
│   ├── error-page.ts
│   ├── index.ts
│   ├── plugin-loader.ts
│   └── proxy.ts
├── utils/
│   ├── __tests__/
│   │   ├── banner.test.ts
│   │   └── logger.test.ts
│   ├── banner.ts
│   ├── logger.ts
│   └── user-input.ts
└── index.ts
```

### Testing Guidelines
1. **Unit Tests**: Focus on testing individual functions and classes in isolation
2. **Mocking**: Use Vitest's `vi.mock()` for external dependencies
3. **Coverage**: Aim for high test coverage but prioritize critical business logic
4. **Test Naming**: Use descriptive test names that explain what is being tested
5. **Test Structure**: Follow the Arrange-Act-Assert pattern

## Core Components

### 1. Entry Point (`index.ts`)
- Initializes the application
- Handles command execution (auth commands)
- Sets up the HTTP server
- Manages graceful shutdown

### 2. Authentication (`auth/`)
- **OAuth Manager**: Handles OAuth2 flow with PKCE
- **Token Manager**: Secure storage using system keychain
- Supports login, logout, and status commands

### 3. Configuration (`config/`)
- **Config Resolver**: Merges configuration from multiple sources
- Sources (in priority order):
  1. Command-line arguments
  2. Environment variables
  3. Configuration file (stagewise.config.json)
  4. Default values
- Handles authentication flow initialization

### 4. Server (`server/`)
- **Express Server**: Main HTTP server
- **Agent Loader**: Initializes Stagewise agent for code assistance
- **Proxy**: Proxies requests to the user's application
- **Plugin Loader**: Discovers and loads UI plugins
- **WebSocket Support**: Handles WebSocket connections for agent

### 5. Dependency Parser (`dependency-parser/`)
- Discovers project dependencies from package.json files
- Supports monorepo structures
- Provides dependency information for plugins

### 6. Utilities (`utils/`)
- **Logger**: Winston-based logging with different levels
- **Banner**: ASCII art banner display
- **User Input**: Terminal input handling

## Key Features

### Graceful Shutdown
- Handles SIGINT and SIGTERM signals
- Closes WebSocket connections
- Shuts down agent properly
- Forces exit after 5-second timeout

### Plugin System
- Loads plugins from npm packages
- Checks plugin compatibility with project dependencies
- Serves plugin files via Express static middleware
- Generates dynamic import maps for plugins

### Development Proxy
- Proxies non-toolbar requests to user's application
- Handles WebSocket upgrades
- Preserves headers and cookies
- Shows error page when proxied app is unavailable

## Build and Distribution
- Uses ESBuild for bundling
- Bundles most dependencies except native modules
- Extracts third-party licenses
- Copies static assets (toolbar, plugins)