# stagewise ✨

### Eyesight for your local AI-Agent.

[![VS Code Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/YOUR_PUBLISHER_NAME.stagewise-vscode?style=flat-square&label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=YOUR_PUBLISHER_NAME.stagewise-vscode) [![Build Status](https://img.shields.io/github/actions/workflow/status/YOUR_ORG/stagewise/ci.yml?branch=main&style=flat-square)](https://github.com/YOUR_ORG/stagewise/actions) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT) [![GitHub Repo stars](https://img.shields.io/github/stars/YOUR_ORG/stagewise?style=flat-square)](https://github.com/YOUR_ORG/stagewise) ---

**[WATCH THE DEMO VIDEO (Coming Soon!)]** [![stagewise Demo Placeholder](https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4)](YOUR_DEMO_VIDEO_LINK_HERE) ---

## What is stagewise? 🤔

The stagewise toolbar SDK [(@stagewise/toolbar)]() injects a toolbar into your localhost and bridges change-requests directly into your IDE's coding agent. 

👆🏽 💬 *Make this button green!!!* ...  🧙🏽 🪄 🟢

## Quickstart 📖

### 1. 🧩 **Install the vs-code extension** 

Install the extension here: https://google.com

<div style="padding: 5px; border: 1px solid rgba(252, 198, 0, 0.8); background-color: rgba(252, 198, 0, 0.1); border-radius: 10px;">
The extension will auto-install the <b>stagewise MCP server</b>.
Click <i>enable</i> to let your agent call MCP-tools in the toolbar.
</div>

### 2. 👨🏽‍💻 **Install and inject the toolbar**

Install [@stagewise/toolbar]():
```bash
pnpm i -D @stagewise/toolbar
```

Inject the toolbar into your app dev-mode:
```tsx
'use client';
import { initToolbar, type ToolbarConfig } from '@stagewise/toolbar';
import { useEffect, useRef } from 'react';

export default function ToolbarWrapper({ config }: { config: ToolbarConfig }) {
  const isLoaded = useRef(false);
  useEffect(() => {
    if (isLoaded.current) return;
    isLoaded.current = true;
    initToolbar(config);
  }, []);
  return null;
}
```

## Features 🔥

* 👆🏽 **Visual Element Selection:** Target UI elements directly in your running app.
* 💬 **Natural Language Commands:** Talk to your code like you talk to a teammate.
* 🤖 **Context for your agent:** Automatically send rich browser context (DOM, styles, state) for more accurate AI suggestions.
* 👨🏽‍💻 **Local IDE Integration:** Seamlessly connects to AI agents within VS Code.
* ⬅️➡️ **Bidirectional Communication:** The agent can query the toolbar via [MCP](https://modelcontextprotocol.io/).
* 📖 **Open Source:** Built by developers, for developers. Contribute and shape the future!

## Agent support 🤖

| **Agent** | **Supported** |
| --- | --- |
| Cursor | ✅ |
| Copilot | ❌ |
| Windsurf | ❌ |
| Cline | ❌ |
| BLACKBOXAI | ❌ |
| Console Ninja | ❌ |
| Continue.dev | ❌ |
| Amazon Q | ❌ |
| Cody | ❌ |
| Qodo | ❌ |

## Advanced guides 🧪

### Register custom MCP tools

## Contributing 🤝

We're just getting started and love contributions! Check out our [CONTRIBUTING.md](https://github.com/YOUR_ORG/stagewise/blob/main/CONTRIBUTING.md) guide to get involved. Found a bug or have a feature idea? [Open an issue!](https://github.com/YOUR_ORG/stagewise/issues) 

## Community & Support 💬

* Join our [Discord](#) 
* Leave a star on the [GitHub repo]()

## License 📜

<!-- stagewise is open-source and licensed under the [MIT License](https://github.com/YOUR_ORG/stagewise/blob/main/LICENSE). --- -->
UNLICENSED, the license is under development.

*Made with ❤️ by the stagewise team.*