import { callCursorAgent } from 'src/utils/call-cursor-agent';

export async function setupToolbar() {
  const prompt = `
  Objective: Automatically initialize the Stagewise toolbar (\`@stagewise/core\`) in the current project for development mode only. Use the framework-agnostic Vanilla JS approach described below.

**Context & Instructions:**

The goal is to inject the Stagewise toolbar using the \`initToolbar\` function from the \`@stagewise/core\` package. This toolbar should ONLY be active during development (\`process.env.NODE_ENV === 'development'\`).

**Required Code Structure for Initialization:**

\`\`\`javascript
// 1. Import the function (should be at the top of the file)
import { initToolbar } from '@stagewise/core';

// 2. Define a basic configuration (can be placed near the initialization call)
const stagewiseConfig = {
  // plugins: [] // Plugins array can be empty or omitted for basic setup
};

// 3. Initialize the toolbar within a development mode check
//    (This block should run once when the application starts)
if (process.env.NODE_ENV === 'development') {
  initToolbar(stagewiseConfig);
  console.log('Stagewise Toolbar initialized.'); // Optional: Add console log for confirmation
}
\`\`\`

**Steps for the AI Agent:**

1.  **Check Package Installation:**
    * Verify if \`@stagewise/core\` is listed in \`devDependencies\` in the project's \`package.json\`.
    * If it's NOT present, add it using the project's detected package manager (pnpm, npm, or yarn). For example: \`pnpm add -D @stagewise/core\` or \`npm install --save-dev @stagewise/core\` or \`yarn add --dev @stagewise/core\`.

2.  **Check Existing Initialization:**
    * Scan the project's likely frontend entry point files (e.g., \`main.js\`, \`index.js\`, \`app.js\`, \`app.ts\`, \`main.ts\`, \`src/index.js\`, etc.).
    * Look for code that already imports \`initToolbar\` from \`@stagewise/core\` AND calls it within a condition checking for \`process.env.NODE_ENV === 'development'\` (or equivalent development mode checks like \`import.meta.env.DEV\` for Vite).
    * **If existing initialization code matching this pattern is found, STOP and do nothing.** Report that Stagewise appears to be already initialized.

3.  **Add Initialization Code (if not already present):**
    * Identify the most appropriate frontend entry point file where application setup occurs. If unsure, target common files like \`src/main.js\` or \`src/index.js\`.
    * **Add the import:** Ensure \`import { initToolbar } from '@stagewise/core';\` exists at the top of the selected file. Add it if missing.
    * **Add the initialization block:** Insert the following code block into the file, ensuring it runs once during the application's startup sequence and *only* in development mode. Place it after essential app setup but before the app is fully mounted or rendered if possible.

        \`\`\`javascript
        // --- Stagewise Toolbar Initialization ---
        // Ensure this block is only included once

        // Define basic config (if not already defined globally/imported)
        const stagewiseConfig = { plugins: [] }; // Use an empty config for initial setup

        // Initialize only in development mode
        if (process.env.NODE_ENV === 'development') {
          try {
            initToolbar(stagewiseConfig);
            console.log('Stagewise Toolbar initialized via automatic setup.');
          } catch (error) {
            console.error('Failed to initialize Stagewise Toolbar:', error);
          }
        }
        // --- End Stagewise Initialization ---
        \`\`\`
    * Adapt the development check if the project clearly uses a different pattern (like \`import.meta.env.DEV\` in Vite projects). Use \`process.env.NODE_ENV === 'development'\` as the default.

**Important Constraints:**

* **Idempotency:** Critically important - **DO NOT** add the initialization code if it already exists in a suitable form.
* **Development Mode Only:** The \`initToolbar\` call MUST be guarded by a development environment check (\`process.env.NODE_ENV === 'development'\` or equivalent).
* **Framework-Agnostic:** Use the direct \`initToolbar\` call. Do not attempt to wrap it in React Hooks (\`useEffect\`), Vue lifecycle methods (\`onMounted\`), or other framework-specific constructs unless absolutely necessary based on the entry point file structure. The provided block is designed to be generally applicable.
* **File Selection:** Prioritize common JavaScript/TypeScript entry point files. Avoid modifying HTML files directly for this setup.

Please proceed with setting up the Stagewise toolbar according to these instructions.

  `;
  await callCursorAgent(prompt);
}
