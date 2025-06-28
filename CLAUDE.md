# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development
- `pnpm install` - Install all dependencies across the monorepo
- `pnpm dev` - Start all development servers concurrently
- `pnpm dev:apps` - Start development for apps only (website, vscode-extension)
- `pnpm dev:toolbar` - Start development for toolbar packages only
- `pnpm dev:plugins` - Start development for plugins only
- `pnpm dev:examples` - Start development for examples only

### Building
- `pnpm build` - Build all packages and apps
- `pnpm build:apps` - Build apps only
- `pnpm build:packages` - Build packages only
- `pnpm build:toolbar` - Build toolbar packages only
- `pnpm build:plugins` - Build plugins only

### Code Quality
- `pnpm check` - Run Biome linting and formatting checks
- `pnpm check:fix` - Run Biome checks and auto-fix issues
- `pnpm typecheck` - Run TypeScript type checking across all packages
- `pnpm test` - Run tests across all packages

### Website Development
- `cd apps/website && pnpm dev` - Start website development server on port 3000
- `cd apps/website && pnpm build` - Build the website for production

### VS Code Extension Development
- `cd apps/vscode-extension && pnpm build` - Build the VS Code extension

### Workspace Management
- `pnpm clean` - Remove all node_modules
- `pnpm clean:workspaces` - Clean build artifacts via Turbo
- `pnpm changeset` - Create a changeset for versioning (required for published packages)

## Repository Architecture

### Monorepo Structure
This is a **monorepo** managed with **pnpm workspaces** and **Turborepo**. The workspace configuration is defined in `pnpm-workspace.yaml`.

### Key Directories

#### Applications (`apps/`)
- **`apps/website/`** - Next.js website serving as landing page and documentation
- **`apps/vscode-extension/`** - VS Code extension that integrates the toolbar with code editors

#### Core Packages (`packages/`)
- **`packages/ui/`** - Shared React component library
- **`packages/srpc/`** - Typed RPC communication between toolbar and extension
- **`packages/websocket-client-sdk/`** - WebSocket client SDK for real-time features
- **`packages/extension-toolbar-srpc-contract/`** - Communication contracts between extension and toolbar
- **`packages/extension-websocket-contract/`** - WebSocket communication contracts
- **`packages/typescript-config/`** - Shared TypeScript configurations

#### Toolbar Framework Packages (`toolbar/`)
- **`toolbar/core/`** - Core toolbar functionality (`@stagewise/toolbar`)
- **`toolbar/next/`** - Next.js-specific toolbar integration (`@stagewise/toolbar-next`)
- **`toolbar/react/`** - React-specific toolbar integration (`@stagewise/toolbar-react`)
- **`toolbar/vue/`** - Vue.js-specific toolbar integration (`@stagewise/toolbar-vue`)

#### Plugins (`plugins/`)
- **`plugins/react/`** - React plugin for the toolbar
- **`plugins/vue/`** - Vue plugin for the toolbar
- **`plugins/angular/`** - Angular plugin for the toolbar
- **`plugins/template/`** - Template for creating new plugins

#### Examples (`examples/`)
Framework-specific integration examples:
- `next-example/`, `react-example/`, `vue-example/`, `angular-example/`, `nuxt-example/`, `svelte-kit-example/`, `solid-example/`

### Toolbar Plugin System
Plugins extend toolbar functionality by implementing the `ToolbarPlugin` interface defined in `toolbar/core/src/plugin.ts`. Key plugin lifecycle hooks:
- `onLoad` - Called when plugin loads
- `onPromptingStart` - Called when user starts typing a prompt
- `onPromptSend` - Called when user sends a prompt
- `onContextElementSelect` - Called when user selects DOM elements
- `toolbarAction` - Defines toolbar button actions

## Development Conventions

### Package Manager
**Always use `pnpm`** for package management. Commands:
- `pnpm add <package> -w` - Add to workspace root
- `pnpm add <package> --filter <package-name>` - Add to specific package
- `pnpm --filter <package-name> run <script>` - Run script in specific package

### Component Naming
Use **kebab-case** for component naming.

### Commit Message Format
Commits use **Conventional Commits** with **required scopes**:
- `feat(scope): description` - New features
- `fix(scope): description` - Bug fixes
- `docs(scope): description` - Documentation changes
- `deps(scope): description` - Dependency updates

**Required scopes:**
- `root` - Root directory files
- `cursor-rules` - Changes in `.cursor/rules/`
- `toolbar` - Changes in `toolbar/*`
- `docs` - Documentation changes
- `deps` - Dependency updates
- Use package/app name for changes in `apps/*`, `packages/*`, `plugins/*`

### Changesets
**Required for all published package changes**:
```bash
pnpm changeset  # Create changeset for version bumps
pnpm changeset --empty  # Empty changeset for docs-only changes
```

## Code Quality Tools

### Biome Configuration
- Linting and formatting via `biome.jsonc`
- JavaScript style: Single quotes, trailing commas, semicolons
- Line width: 80 characters
- Specific rules for React, TypeScript, and accessibility

### Pre-commit Hooks
Managed by **Lefthook** (`lefthook.yml`):
- Automatic Biome formatting and linting on staged files
- Commitlint validation for commit message format

### TypeScript
Shared configurations in `packages/typescript-config/`

## Key Integration Points

### Toolbar ↔ Extension Communication
- Uses sRPC contracts defined in `packages/extension-toolbar-srpc-contract/`
- WebSocket communication for real-time features
- Extension registers MCP (Model Context Protocol) server for AI agent integration

### Framework Integration
- Framework-specific toolbar packages (`@stagewise/toolbar-[framework]`) wrap core functionality
- Core toolbar logic lives in `toolbar/core/`
- Examples demonstrate integration patterns for each supported framework

### Plugin Development
- Implement `ToolbarPlugin` interface from `toolbar/core/src/plugin.ts`
- Use `plugins/template/` as starting point for new plugins
- MCP support allows plugins to expose capabilities to AI agents

## Common Issues

### VS Code Extension
If toolbar doesn't connect to extension:
- Ensure only one VS Code/Cursor window is open
- Use command `stagewise.setupToolbar` for AI-assisted setup
- Check extension is installed and activated

### Development Setup
- Run `pnpm install` from repository root
- Use `pnpm dev` to start all development servers
- Individual packages can be developed with `pnpm --filter <package> dev`