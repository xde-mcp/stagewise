import * as vscode from 'vscode';

export function createGettingStartedPanel(
  context: vscode.ExtensionContext,
  onSetupToolbar: () => Promise<void>,
): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    'stagewiseGettingStarted',
    'Getting Started with stagewise',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    },
  );

  panel.webview.html = getWebviewContent();

  // Handle messages from the webview
  panel.webview.onDidReceiveMessage(
    async (message) => {
      switch (message.command) {
        case 'setupToolbar':
          try {
            await onSetupToolbar();
            // Show success message in webview
            panel.webview.postMessage({
              command: 'setupComplete',
              success: true,
            });
          } catch (error) {
            // Show error message in webview
            panel.webview.postMessage({
              command: 'setupComplete',
              success: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
          break;
        case 'openDocs':
          vscode.env.openExternal(
            vscode.Uri.parse(
              'https://github.com/stagewise-io/stagewise#readme',
            ),
          );
          break;
        case 'showManualSetup':
          // Navigate to manual setup view
          panel.webview.postMessage({
            command: 'showManualSetup',
          });
          break;
        case 'backToWalkthrough':
          // Navigate back to main walkthrough
          panel.webview.postMessage({
            command: 'showWalkthrough',
          });
          break;
        case 'dismissPanel':
          // Set a flag to indicate the user has seen the getting started panel
          await context.globalState.update(
            'stagewise.hasSeenGettingStarted',
            true,
          );
          panel.dispose();
          break;
      }
    },
    undefined,
    context.subscriptions,
  );

  return panel;
}

function getWebviewContent(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Getting Started with stagewise</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
            line-height: 1.6;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        .view {
            display: none;
        }
        .view.active {
            display: block;
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        .logo {
            width: 64px;
            height: 64px;
            border-radius: 50%;
            margin-bottom: 16px;
        }
        h1 {
            color: var(--vscode-titleBar-activeForeground);
            margin: 0 0 8px 0;
            font-size: 2.2em;
        }
        h2 {
            color: var(--vscode-titleBar-activeForeground);
            margin: 24px 0 16px 0;
            font-size: 1.5em;
        }
        h3 {
            color: var(--vscode-titleBar-activeForeground);
            margin: 20px 0 12px 0;
            font-size: 1.2em;
        }
        .subtitle {
            color: var(--vscode-descriptionForeground);
            font-size: 1.2em;
            margin-bottom: 30px;
        }
                 .walkthrough-step {
             background: linear-gradient(135deg, var(--vscode-editor-inactiveSelectionBackground), var(--vscode-editor-selectionBackground));
             border: 2px solid var(--vscode-panel-border);
             border-radius: 12px;
             padding: 32px;
             margin-bottom: 24px;
             text-align: center;
             transition: all 0.3s ease;
             position: relative;
             overflow: hidden;
         }
        .walkthrough-step:hover {
            border-color: var(--vscode-button-background);
            transform: translateY(-2px);
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
        }
        .walkthrough-step::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
            transition: left 0.5s;
        }
        .walkthrough-step:hover::before {
            left: 100%;
        }
        .step-number {
            display: inline-block;
            width: 40px;
            height: 40px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border-radius: 50%;
            line-height: 40px;
            font-weight: bold;
            font-size: 1.2em;
            margin-bottom: 16px;
        }
        .step-title {
            font-size: 1.4em;
            font-weight: bold;
            margin-bottom: 8px;
            color: var(--vscode-titleBar-activeForeground);
        }
        .step-description {
            color: var(--vscode-descriptionForeground);
            margin-bottom: 16px;
        }
        .step-icon {
            font-size: 2em;
            margin-bottom: 16px;
        }
        .button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
            margin: 8px;
            display: inline-block;
            transition: all 0.2s ease;
        }
        .button:hover {
            background-color: var(--vscode-button-hoverBackground);
            transform: translateY(-1px);
        }
        .button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
        .button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .button.secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .button.back {
            background-color: transparent;
            color: var(--vscode-descriptionForeground);
            border: 1px solid var(--vscode-panel-border);
        }
        .button.back:hover {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
        }
        .status {
            margin-top: 16px;
            padding: 16px;
            border-radius: 8px;
            display: none;
            text-align: center;
        }
        .status.success {
            background-color: var(--vscode-testing-iconPassed);
            color: var(--vscode-editor-background);
        }
        .status.error {
            background-color: var(--vscode-testing-iconFailed);
            color: var(--vscode-editor-background);
        }
        .feature-list {
            list-style-type: none;
            padding: 0;
            margin: 24px 0;
        }
        .feature-item {
            display: flex;
            align-items: center;
            margin-bottom: 16px;
            padding: 12px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 8px;
            border-left: 4px solid var(--vscode-button-background);
        }
        .feature-icon {
            margin-right: 16px;
            font-size: 1.3em;
            min-width: 24px;
        }
        .code-block {
            background-color: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            padding: 16px;
            margin: 16px 0;
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            overflow-x: auto;
            position: relative;
        }
        .code-block::before {
            content: attr(data-lang);
            position: absolute;
            top: 8px;
            right: 12px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
        }
        .framework-accordion {
            margin: 16px 0;
        }
        .framework-item {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            margin-bottom: 8px;
            overflow: hidden;
        }
        .framework-header {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 16px;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: background-color 0.2s ease;
        }
        .framework-header:hover {
            background-color: var(--vscode-editor-selectionBackground);
        }
        .framework-header.active {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .framework-content {
            padding: 0 16px;
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.3s ease, padding 0.3s ease;
        }
        .framework-content.active {
            max-height: 1000px;
            padding: 16px;
        }
        .chevron {
            transition: transform 0.3s ease;
        }
        .chevron.active {
            transform: rotate(180deg);
        }
        .dismiss-section {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid var(--vscode-panel-border);
        }
        .magic-sparkle {
            display: inline-block;
            animation: sparkle 2s ease-in-out infinite;
        }
        @keyframes sparkle {
            0%, 100% { transform: scale(1) rotate(0deg); opacity: 1; }
            50% { transform: scale(1.1) rotate(180deg); opacity: 0.8; }
        }
        .back-nav {
            margin-bottom: 20px;
        }
        .installation-steps {
            background-color: var(--vscode-textBlockQuote-background);
            border-left: 4px solid var(--vscode-textBlockQuote-border);
            border-radius: 8px;
            padding: 24px;
            margin: 24px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Main Walkthrough View -->
        <div id="walkthroughView" class="view active">
            <div class="header">
                <div class="subtitle">🎉 Welcome to stagewise!</div>
                <h1>Visual vibe coding. Right in your codebase.</h1>
                <p class="subtitle">Choose your setup adventure below <span class="magic-sparkle">✨</span></p>
            </div>

                         <h2>🚀 Choose Your Setup Method</h2>
             
             <div class="walkthrough-step">
                 <div class="step-icon">🪄</div>
                 <div class="step-number">1</div>
                 <div class="step-title">AI-Assisted Auto-Setup</div>
                 <div class="step-description">
                     Let our AI analyze your project and automatically configure the toolbar. 
                     Perfect for getting started in seconds!
                 </div>
                 <button class="button" id="setupButton" onclick="setupToolbar()">
                     ✨ Auto-Setup Toolbar (AI-Guided)
                 </button>
                 <div class="status" id="status"></div>
             </div>

             <div class="walkthrough-step">
                 <div class="step-icon">💻</div>
                 <div class="step-number">2</div>
                 <div class="step-title">Manual Setup</div>
                 <div class="step-description">
                     Prefer to set things up yourself? Get detailed instructions with 
                     framework-specific examples.
                 </div>
                 <button class="button secondary" onclick="showManualSetup()">
                     📖 Manual Setup Instructions
                 </button>
             </div>

            <div class="dismiss-section">
                <button class="button secondary" onclick="dismissPanel()">
                    Got it! Don't show this again
                </button>
            </div>
        </div>

        <!-- Manual Setup View -->
        <div id="manualSetupView" class="view">
            <div class="back-nav">
                <button class="button back" onclick="backToWalkthrough()">
                    ← Back to Setup Options
                </button>
            </div>

            <div class="header">
                <h1>💻 Manual Setup Guide</h1>
                <p class="subtitle">Follow these steps to integrate stagewise into your project</p>
            </div>

            <div class="installation-steps">
                <h2>📦 Quick Installation</h2>
                
                <h3>Step 1: Install the toolbar package</h3>
                <div class="code-block" data-lang="bash">pnpm i -D @stagewise/toolbar</div>
                
                <h3>Step 2: Initialize the toolbar in your app</h3>
                <div class="code-block" data-lang="typescript">// Import the toolbar
import { initToolbar } from '@stagewise/toolbar';

// Define your toolbar configuration
const stagewiseConfig = {
  plugins: [],
};

// Initialize the toolbar in development mode
if (process.env.NODE_ENV === 'development') {
  initToolbar(stagewiseConfig);
}</div>

                <p><strong>⚡️ The toolbar will automatically connect to the extension!</strong></p>
                
                <div class="status success" style="display: block; margin-top: 16px;">
                    <strong>💡 Pro Tip:</strong> If you have multiple Cursor windows open, keep only one open when using stagewise to ensure reliable operation.
                </div>
            </div>

            <h2>🎯 Framework-Specific Integration</h2>
            <p>For easier integration, we provide framework-specific packages with dedicated components:</p>

            <div class="framework-accordion">
                <div class="framework-item">
                    <div class="framework-header" onclick="toggleFramework('react')">
                        <span><strong>React.js</strong> - @stagewise/toolbar-react</span>
                        <span class="chevron" id="react-chevron">▼</span>
                    </div>
                    <div class="framework-content" id="react-content">
                        <p>Initialize the toolbar in your main entry file (e.g., <code>src/main.tsx</code>) by creating a separate React root for it:</p>
                        <div class="code-block" data-lang="tsx">// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { StagewiseToolbar } from '@stagewise/toolbar-react';
import './index.css';

// Render the main app
createRoot(document.getElementById('root')!).render(
  &lt;StrictMode&gt;
    &lt;App /&gt;
  &lt;/StrictMode&gt;,
);

// Initialize toolbar separately
const toolbarConfig = {
  plugins: [], // Add your custom plugins here
};

document.addEventListener('DOMContentLoaded', () => {
  const toolbarRoot = document.createElement('div');
  toolbarRoot.id = 'stagewise-toolbar-root';
  document.body.appendChild(toolbarRoot);

  createRoot(toolbarRoot).render(
    &lt;StrictMode&gt;
      &lt;StagewiseToolbar config={toolbarConfig} /&gt;
    &lt;/StrictMode&gt;
  );
});</div>
                    </div>
                </div>

                <div class="framework-item">
                    <div class="framework-header" onclick="toggleFramework('nextjs')">
                        <span><strong>Next.js</strong> - @stagewise/toolbar-next</span>
                        <span class="chevron" id="nextjs-chevron">▼</span>
                    </div>
                    <div class="framework-content" id="nextjs-content">
                        <p>Include the <code>&lt;StagewiseToolbar&gt;</code> component in your root layout file:</p>
                        <div class="code-block" data-lang="tsx">// src/app/layout.tsx
import { StagewiseToolbar } from '@stagewise/toolbar-next';

export default function RootLayout({
  children,
}: Readonly&lt;{
  children: React.ReactNode;
}&gt;) {
  return (
    &lt;html lang="en"&gt;
      &lt;body&gt;
        &lt;StagewiseToolbar
          config={{
            plugins: [], // Add your custom plugins here
          }}
        /&gt;
        {children}
      &lt;/body&gt;
    &lt;/html&gt;
  );
}</div>
                    </div>
                </div>

                <div class="framework-item">
                    <div class="framework-header" onclick="toggleFramework('nuxt')">
                        <span><strong>Nuxt.js</strong> - @stagewise/toolbar-vue</span>
                        <span class="chevron" id="nuxt-chevron">▼</span>
                    </div>
                    <div class="framework-content" id="nuxt-content">
                        <p>Place the <code>&lt;StagewiseToolbar&gt;</code> component in your <code>app.vue</code> or layout file:</p>
                        <div class="code-block" data-lang="vue">// app.vue
&lt;script setup lang="ts"&gt;
import { StagewiseToolbar, type ToolbarConfig } from '@stagewise/toolbar-vue';

const config: ToolbarConfig = {
  plugins: [], // Add your custom plugins here
};
&lt;/script&gt;

&lt;template&gt;
  &lt;div&gt;
    &lt;NuxtRouteAnnouncer /&gt;
    &lt;ClientOnly&gt;
      &lt;StagewiseToolbar :config="config" /&gt;
    &lt;/ClientOnly&gt;
    &lt;NuxtWelcome /&gt;
  &lt;/div&gt;
&lt;/template&gt;</div>
                    </div>
                </div>

                <div class="framework-item">
                    <div class="framework-header" onclick="toggleFramework('vue')">
                        <span><strong>Vue.js</strong> - @stagewise/toolbar-vue</span>
                        <span class="chevron" id="vue-chevron">▼</span>
                    </div>
                    <div class="framework-content" id="vue-content">
                        <p>Add the <code>&lt;StagewiseToolbar&gt;</code> component to your main App component:</p>
                        <div class="code-block" data-lang="vue">// src/App.vue
&lt;script setup lang="ts"&gt;
import { StagewiseToolbar, type ToolbarConfig } from '@stagewise/toolbar-vue';

const config: ToolbarConfig = {
  plugins: [], // Add your custom plugins here
};
&lt;/script&gt;

&lt;template&gt;
  &lt;StagewiseToolbar :config="config" /&gt;
  &lt;div&gt;
    &lt;!-- Your app content --&gt;
  &lt;/div&gt;
&lt;/template&gt;</div>
                    </div>
                </div>

                <div class="framework-item">
                    <div class="framework-header" onclick="toggleFramework('svelte')">
                        <span><strong>SvelteKit</strong> - @stagewise/toolbar</span>
                        <span class="chevron" id="svelte-chevron">▼</span>
                    </div>
                    <div class="framework-content" id="svelte-content">
                        <p>Integrate using Svelte's lifecycle functions in your layout file:</p>
                        <div class="code-block" data-lang="svelte">// src/routes/+layout.svelte
&lt;script lang="ts"&gt;
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { initToolbar, type ToolbarConfig } from '@stagewise/toolbar';

  onMount(() => {
    if (browser) {
      const stagewiseConfig: ToolbarConfig = {
        plugins: [
          // Add your Svelte-specific plugins here
        ],
      };
      initToolbar(stagewiseConfig);
    }
  });
&lt;/script&gt;

&lt;slot /&gt;</div>
                    </div>
                </div>
            </div>

            <div class="installation-steps">
                <h2>🤖 Agent Support</h2>
                <ul class="feature-list">
                    <li class="feature-item">
                        <span class="feature-icon">✅</span>
                        <span><strong>Cursor</strong> - Fully supported</span>
                    </li>
                    <li class="feature-item">
                        <span class="feature-icon">✅</span>
                        <span><strong>GitHub Copilot</strong> - Fully supported</span>
                    </li>
                    <li class="feature-item">
                        <span class="feature-icon">✅</span>
                        <span><strong>Windsurf</strong> - Fully supported</span>
                    </li>
                    <li class="feature-item">
                        <span class="feature-icon">🚧</span>
                        <span><strong>Cline</strong> - In progress</span>
                    </li>
                </ul>
            </div>

            <div style="text-align: center; margin: 40px 0;">
                <button class="button" onclick="openDocs()">
                    📖 View Full Documentation
                </button>
                <button class="button secondary" onclick="dismissPanel()">
                    Complete Setup
                </button>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function setupToolbar() {
            const button = document.getElementById('setupButton');
            const status = document.getElementById('status');
            
            button.disabled = true;
            button.textContent = '⏳ Setting up...';
            status.style.display = 'none';
            
            vscode.postMessage({ command: 'setupToolbar' });
        }

        function showManualSetup() {
            vscode.postMessage({ command: 'showManualSetup' });
        }

        function backToWalkthrough() {
            vscode.postMessage({ command: 'backToWalkthrough' });
        }

        function openDocs() {
            vscode.postMessage({ command: 'openDocs' });
        }

        function dismissPanel() {
            vscode.postMessage({ command: 'dismissPanel' });
        }

        function toggleFramework(framework) {
            const content = document.getElementById(framework + '-content');
            const header = document.querySelector('[onclick="toggleFramework(\'' + framework + '\')"]');
            const chevron = document.getElementById(framework + '-chevron');
            
            const isActive = content.classList.contains('active');
            
            // Close all other frameworks
            document.querySelectorAll('.framework-content').forEach(c => c.classList.remove('active'));
            document.querySelectorAll('.framework-header').forEach(h => h.classList.remove('active'));
            document.querySelectorAll('.chevron').forEach(ch => ch.classList.remove('active'));
            
            if (!isActive) {
                content.classList.add('active');
                header.classList.add('active');
                chevron.classList.add('active');
            }
        }

        function showView(viewId) {
            document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
            document.getElementById(viewId).classList.add('active');
        }

        // Handle messages from the extension
        window.addEventListener('message', event => {
            const message = event.data;
            const button = document.getElementById('setupButton');
            const status = document.getElementById('status');

            switch (message.command) {
                case 'setupComplete':
                    button.disabled = false;
                    if (message.success) {
                        button.textContent = '✅ Setup Complete!';
                        status.textContent = 'Toolbar setup completed successfully! Start your development server and look for the stagewise toolbar in your browser.';
                        status.className = 'status success';
                    } else {
                        button.textContent = '❌ Setup Failed';
                        status.textContent = 'Setup failed: ' + (message.error || 'Unknown error');
                        status.className = 'status error';
                    }
                    status.style.display = 'block';
                    break;
                case 'showManualSetup':
                    showView('manualSetupView');
                    break;
                case 'showWalkthrough':
                    showView('walkthroughView');
                    break;
            }
        });
    </script>
</body>
</html>`;
}

export function shouldShowGettingStarted(
  context: vscode.ExtensionContext,
): boolean {
  // Show getting started panel if the user hasn't seen it before
  return !context.globalState.get('stagewise.hasSeenGettingStarted', false);
}
