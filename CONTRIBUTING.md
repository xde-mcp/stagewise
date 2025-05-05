# Contributing to Stagewise

Welcome! This document provides an in-depth overview of the structure and architecture of the Stagewise project. Understanding this layout will help you quickly find your way around the codebase and identify where to contribute.

---

## Project Structure & Architecture

Stagewise is organized as a **monorepo** using [pnpm workspaces](https://pnpm.io/workspaces) and [turborepo](https://turbo.build/). The repository is divided into several key areas:

### 1. Applications (`apps/`)

* **website/**

  * The main web application, serving as the landing page and documentation site.
  * Contains all website-specific code, including routes, components, and documentation pages.
* **vscode-extension/**

  * The official VSCode (and Cursor) extension.
  * Integrates the Stagewise toolbar with code editors, enabling communication between the browser and your local AI agent.
  * Contains extension source code, packaging scripts, and related assets.

### 2. Packages (`packages/`)

* **toolbar/**

  * The core browser toolbar package.
  * Provides the UI and logic for DOM element selection, prompt sending, and plugin support.
  * Contains React components, hooks, utilities, and configuration for the toolbar.
* **ui/**

  * Shared React component library.
  * Houses reusable UI elements (buttons, dialogs, forms, charts, etc.) used across apps and packages.
* **srpc/**

  * Handles typed RPC (remote procedure call) communication between the toolbar, extension, and other services.
* **websocket-client-sdk/**

  * SDK for WebSocket client communication, used for real-time features.
* **extension-toolbar-srpc-contract/** & **extension-websocket-contract/**

  * Define contracts and interfaces for communication between the extension, toolbar, and WebSocket services.
* **typescript-config/**

  * Shared TypeScript configuration files for consistent type-checking and build settings across the monorepo.

### 3. Examples (`examples/`)

* Contains example integrations for popular frameworks:

  * **next-example/** (Next.js)
  * **svelte-kit-example/** (SvelteKit)
  * **nuxt-example/** (Nuxt)
* These serve as reference implementations for integrating the Stagewise toolbar into different frontend stacks.

### 4. Playgrounds (`playgrounds/`)

* Experimental or sandbox environments for development and testing.
* Useful for trying out new features or debugging in isolation.

### 5. Root-level Configuration & Tooling

* **pnpm-workspace.yaml**: Declares workspace packages for pnpm.
* **turbo.json**: Turborepo configuration for task running and caching.
* **biome.jsonc**, **lefthook.yml**, **commitlint.config.js**: Linting, formatting, and commit hook configuration.
* **README.md**: Project overview and high-level documentation.

---

## How the Parts Interact

* The **toolbar** (browser package) is injected into frontend apps and provides the UI for selecting DOM elements and sending prompts.
* The **VSCode extension** receives data from the toolbar and communicates with your local AI agent (e.g., Cursor IDE).
* **Contracts** in `packages/extension-toolbar-srpc-contract` and `packages/extension-websocket-contract` ensure type-safe communication between the extension, toolbar, and any backend services.
* The **UI library** is shared across the website, toolbar, and potentially other packages for a consistent look and feel.
* **Examples** and **playgrounds** help demonstrate and test integrations in various environments.

This structure is designed for modularity, reusability, and ease of contribution. Each package and app is self-contained, with clear responsibilities and minimal coupling.

---

## Local Development

To set up the repo:

```bash
pnpm install
pnpm dev  # runs the website and playgrounds
```

Useful commands:

* `pnpm dev` — start all dev servers
* `pnpm build` — build all packages
* `pnpm lint` — run linters and type checks
* `pnpm test` — run tests across packages

---

## Contribution Guidelines

* Follow our code style (enforced by Biome, Lefthook, and Commitlint).
* Write clear and descriptive commit messages.
* Open a GitHub issue or draft PR before making large changes.
* Add tests if you’re adding new functionality (or explain why not).
* Prefer small, scoped pull requests over large ones.

---

## Need Help?

* 💬 Join our [Discord](https://discord.gg/tRRyHJnv) to ask questions and get support.
* 🐛 Found a bug? Open a [GitHub Issue](https://github.com/stagewise-io/stagewise/issues).
* 💡 Have a feature idea? Let’s discuss it in [GitHub Discussions](#).
