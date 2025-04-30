# stagewise ✨

**Code with your eyes. Visually connect your localhost app to AI code agents.**

[![VS Code Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/YOUR_PUBLISHER_NAME.stagewise-vscode?style=flat-square&label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=YOUR_PUBLISHER_NAME.stagewise-vscode) [![Build Status](https://img.shields.io/github/actions/workflow/status/YOUR_ORG/stagewise/ci.yml?branch=main&style=flat-square)](https://github.com/YOUR_ORG/stagewise/actions) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT) [![GitHub Repo stars](https://img.shields.io/github/stars/YOUR_ORG/stagewise?style=flat-square)](https://github.com/YOUR_ORG/stagewise) ---

**[WATCH THE DEMO VIDEO (Coming Soon!)]** [![stagewise Demo Placeholder](https://via.placeholder.com/800x400.png?text=Awesome+stagewise+Demo+Coming+Soon!)](YOUR_DEMO_VIDEO_LINK_HERE) ---

## What is stagewise? 🤔

Tired of digging through code to find that *one* button you want to tweak? Wish you could just point at something in your running app and tell an AI like GitHub Copilot or Cursor to fix it?

**stagewise** makes this real. It's an open-source developer toolbar that bridges the gap between your visual localhost environment and your AI coding assistant in VS Code.

Select an element, describe the change in plain English ("make this text bold", "fix padding here"), and watch the AI implement it in your codebase, guided by rich context captured directly from the browser.

## How it Works 🤯

1.  **Inject:** Add the `stagewise` JS SDK to your frontend project. A sleek toolbar appears over your app on localhost.
2.  **Select & Command:** Click the stagewise selector, pick any UI element, and type your command (e.g., "change background to dark grey").
3.  **Context is King:** The toolbar grabs the command *plus* relevant details (HTML structure, CSS, component state) and beams it over.
4.  **VS Code Bridge:** This extension catches the info from the toolbar.
5.  **AI Magic:** The extension feeds the command and context to your configured AI agent (Cursor, Copilot, etc.).
6.  **Code Change:** The AI uses the context to understand *exactly* what you mean and generates the code change right in your IDE.

It even supports bidirectional communication using the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/), so the AI can ask the toolbar follow-up questions ("What's the parent element's ID?").

## Features 🔥

* **Visual Element Selection:** Target UI elements directly in your running app.
* **Natural Language Commands:** Talk to your code like you talk to a teammate.
* **Context-Aware AI:** Send rich browser context (DOM, styles, state) for more accurate AI suggestions.
* **IDE Integration:** Seamlessly connects to AI agents within VS Code.
* **Bidirectional Communication:** AI can query the browser via MCP.
* **Open Source:** Built by developers, for developers. Contribute and shape the future!

## Getting Started 🚀

1.  **Install Extension:** Get the **stagewise** extension from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=YOUR_PUBLISHER_NAME.stagewise-vscode). 2.  **Install SDK:** In your frontend project's terminal:
    ```bash
    npm install stagewise-sdk # Or yarn add / pnpm add (UPDATE if package name differs)
    ```
3.  **Inject Toolbar:** Add the stagewise toolbar to your app's entry point:
    ```javascript
    // Example for a React app (adjust for Vue, Angular, etc.)
    import React from 'react';
    import ReactDOM from 'react-dom/client';
    import App from './App';
    import { injectToolbar } from 'stagewise-sdk'; // (UPDATE if package name differs)

    // Inject stagewise toolbar (only in development)
    if (process.env.NODE_ENV === 'development') {
      injectToolbar({ /* Optional config */ });
    }

    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    ```
4.  **Code!** Run your app on localhost. Select elements, issue commands, and experience the magic! ✨

## Contributing 🤝

We're just getting started and love contributions! Check out our [CONTRIBUTING.md](https://github.com/YOUR_ORG/stagewise/blob/main/CONTRIBUTING.md) guide to get involved. Found a bug or have a feature idea? [Open an issue!](https://github.com/YOUR_ORG/stagewise/issues) ## Community & Support 💬

* [Join our Discord (Link Coming Soon!)](#) * [Follow us on Twitter (Link Coming Soon!)](#) ## License 📜

stagewise is open-source and licensed under the [MIT License](https://github.com/YOUR_ORG/stagewise/blob/main/LICENSE). ---

*Made with ❤️ by the stagewise team.*