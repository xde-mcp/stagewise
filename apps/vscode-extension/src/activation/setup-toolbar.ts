import { callCursorAgent } from 'src/utils/call-cursor-agent';

export async function setupToolbar() {
  const prompt = `
# Stagewise Toolbar Implementation Agent

<objective>
Automatically initialize the Stagewise toolbar in the user\'s project, ensuring it ONLY runs in development mode. Prioritize framework-specific integration if the project uses Next.js, React.js, Nuxt.js, Vue.js, or SvelteKit. Use the framework-agnostic Vanilla JS approach (\`@stagewiseguiding_principles

>/objective> >
>/core\`) as a fallback. 
1. **Detect Framework:** First, identify the JavaScript framework used in the project by checking \`package.json\` dependencies and file structures.
2. **Prioritize Framework-Specific Setup:** Use the dedicated Stagewise package for the detected framework.
3. **Ensure Idempotency:** Before making changes, check if Stagewise is already initialized to avoid duplications.
4. **Development Mode Only:** Ensure toolbar only runs in development environments.
5. **Package Installation:** Add required Stagewise packages as devDependencies if not present.
6. **Simple Configuration:** Use a basic configuration object with empty plugins array.
</guiding_principles>

<implementation_workflow>
## Phase 1: Project Analysis

<framework_detection>
Examine project structure to identify the JavaScript framework:
- Check \`package.json\` for dependencies: \`next\`, \`react\`, \`nuxt\`, \`vue\`, \`@sveltejs/kit\`
- Look for characteristic files:
  - Next.js: \`next.config.js\`, \`src/app/layout.tsx\`
  - React: \`vite.config.js\` with React plugin, \`src/main.tsx\`
  - Nuxt.js: \`nuxt.config.js\`, \`app.vue\`
  - Vue.js: \`vite.config.js\` with Vue plugin, \`src/App.vue\`
  - SvelteKit: \`svelte.config.js\`, \`src/routes/+layout.svelte\`
</framework_detection>

<idempotency_check>
Scan for existing Stagewise initialization:
- Look for imports of \`initToolbar\` from \`@stagewise/toolbar\` and its usage with dev check
- Check for \`<StagewiseToolbar>\` component from framework-specific packages
- For SvelteKit, look for \`initToolbar\` usage within \`onMount\`

**IMPORTANT**: If any suitable initialization is found, STOP and report that Stagewise appears to be already initialized.
</idempotency_check>

## Phase 2: Framework-Specific Integration Strategies

<next_js_strategy>
### Next.js Integration

**Package:** \`@stagewise/toolbar-next\`

**Target File:** Root layout file (typically \`src/app/layout.tsx\` or \`app/layout.js\`)

**Implementation:**
\`\`\`tsx
// src/app/layout.tsx
import { StagewiseToolbar } from '@stagewise/toolbar-next';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const stagewiseConfig = { plugins: [] };
  return (
    <html lang=<body>
        {/* Ensure StagewiseToolbar is only rendered in development */}<
      "en" process.env.NODE_ENV === 'development' && <StagewiseToolbar config={stagewiseConfig} />children
      </body>
    </html>
  );
}
\`\`\`

**Success Logging:** \`console.log('Stagewise Toolbar (Next.js) initialized via automatic setup.');\`
</next_js_strategy>

<react_js_strategy>
### React.js Integration

**Package:** \`@stagewise/toolbar-react\`

**Target File:** Main entry file (e.g., \`src/main.tsx\`, \`src/index.tsx\`)

**Implementation:**
\`\`\`tsx
// src/main.tsx (example)
// ... existing App rendering ...

// Initialize Stagewise Toolbar separately only in development
if (process.env.NODE_ENV === 'development' || import.meta.env.DEV) {
  const toolbarConfig = { plugins: [] };
  const stagewiseToolbarRootId = 'stagewise-toolbar-root';
  let toolbarRootElement = document.getElementById(stagewiseToolbarRootId);
  if (!toolbarRootElement) {
    toolbarRootElement = document.createElement('div');
    toolbarRootElement.id = stagewiseToolbarRootId;
    document.body.appendChild(toolbarRootElement);
  }

  createRoot(toolbarRootElement).render(
    <StrictMode>
      <StagewiseToolbar config={toolbarConfig} />
    </StrictMode>
  );
  console.log('Stagewise Toolbar (React) initialized via automatic setup.');
}
\`\`\`

**Required Imports:**
\`\`\`tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { StagewiseToolbar } from '@stagewise/toolbar-react';
\`\`\`
</react_js_strategy>

<nuxt_js_strategy>
### Nuxt.js Integration

**Package:** \`@stagewise/toolbar-vue\`

**Target File:** Root \`app.vue\` or relevant layout file

**Implementation:**
\`\`\`vue
// app.vue
<script setup lang="ts">
import { type ToolbarConfig } from '@stagewise/toolbar-vue';

const config: ToolbarConfig = { plugins: [] };

// Optional: Log initialization
if (process.dev) {
  console.log('Stagewise Toolbar (Nuxt.js) will be initialized via automatic setup.');
}
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <ClientOnly>
      <StagewiseToolbar v-if="process.dev" :config="config" />
    </ClientOnly>
    <NuxtWelcome />
  </div>
</template>
\`\`\`
</nuxt_js_strategy>

<vue_js_strategy>
### Vue.js Integration

**Package:** \`@stagewise/toolbar-vue\`

**Target File:** Main App component (e.g., \`src/App.vue\`)

**Implementation:**
\`\`\`vue
// src/App.vue
<script setup lang="ts">
import { StagewiseToolbar, } from '@stagewise/toolbar-vue';
import { onMounted } from 'vue';

const config: ToolbarConfig = { plugins: [] };
const isDevelopment = process.env.NODE_ENV === 'development' || import.meta.env.DEV;

onMounted(() => {
  if (isDevelopment) {
    console.log('Stagewise Toolbar (Vue.js) initialized via automatic setup.');
  }
});
</script>

<template>
  <StagewiseToolbar v-if="isDevelopment" :config="config" />
  <div>
    <!-- Existing app content -->
  </div>
</template>
\`\`\`
</vue_js_strategy>

<sveltekit_strategy>
### SvelteKit Integration

**Package:** \`@stagewise/toolbar\`

**Target File:** Root layout file (\`src/routes/+layout.svelte\`)

**Implementation:**
\`\`\`svelte
// src/routes/+layout.svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { initToolbar, type ToolbarConfig } from '@stagewise/toolbar';

  onMount(() => {
    if (browser && (process.env.NODE_ENV === 'development' || import.meta.env.DEV)) {
      const stagewiseConfig: ToolbarConfig = {
        plugins: [],
      };
      try {
        initToolbar(stagewiseConfig);
        console.log('Stagewise Toolbar (SvelteKit) initialized via automatic setup.');
      } catch (error) {
        console.error('Failed to initialize Stagewise Toolbar for SvelteKit:', error);
      }
    }
  });
</script>

<slot />
\`\`\`
</sveltekit_strategy>

<vanilla_js_strategy>
### Vanilla JS (Fallback) Integration

**Package:** \`@stagewise/toolbar\`

**Target File:** Most appropriate frontend entry point file (e.g., \`main.js\`, \`index.js\`, \`app.js\`)

**Implementation:**
\`\`\`javascript
// --- Stagewise Toolbar Initialization (Fallback) ---

// Import if not already at the top of the file
// import { initToolbar } from '@stagewise/toolbar'; 

// Define basic config
const stagewiseConfig = { plugins: [] }; 

// Initialize only in development mode
if (process.env.NODE_ENV === 'development') { // Use import.meta.env.DEV for Vite projects
  try {
    // Check if already initialized
    if (!document.getElementById('stagewise-toolbar-root-vanilla')) {
      const stagewiseCore = await import('@stagewise/toolbar');
      stagewiseCore.initToolbar(stagewiseConfig);
      // Mark that initialization has run
      const marker = document.createElement('div');
      marker.id = 'stagewise-toolbar-root-vanilla';
      marker.style.display = 'none';
      document.body.appendChild(marker);
      console.log('Stagewise Toolbar (Vanilla JS) initialized via automatic setup.');
    }
  } catch (error) {
    console.error('Failed to initialize Stagewise Toolbar (Vanilla JS):', error);
  }
}
// --- End Stagewise Initialization ---
\`\`\`
</vanilla_js_strategy>
</implementation_workflow>

<package_installation>
## Package Installation Guide

Install the required Stagewise package as a dev dependency based on the detected framework:

1. For Next.js: \`npm install --save-dev @stagewise/toolbar-next\` or \`pnpm add -D @stagewise/toolbar-next\` or \`yarn add -D @stagewise/toolbar-next\`
2. For React.js: \`npm install --save-dev @stagewise/toolbar-react\` or \`pnpm add -D @stagewise/toolbar-react\` or \`yarn add -D @stagewise/toolbar-react\`
3. For Vue.js/Nuxt.js: \`npm install --save-dev @stagewise/toolbar-vue\` or \`pnpm add -D @stagewise/toolbar-vue\` or \`yarn add -D @stagewise/toolbar-vue\`
4. For SvelteKit or Vanilla JS: \`npm install --save-dev @stagewise/toolbar\` or \`pnpm add -D @stagewise/toolbar\` or \`yarn add -D @stagewise/toolbar\`

Use the package manager detected in the project (npm, yarn, or pnpm) based on lock files.
</package_installation>

<critical_constraints>
## Critical Constraints

1. **Strict Idempotency:** DO NOT add initialization code if Stagewise is already set up in any way.
2. **Development Mode Only:** Always ensure the toolbar runs ONLY in development environments.
3. **Package Scope:** All Stagewise packages must be installed as \`devDependencies\`.
4. **Component Safety:** Even for framework-specific components, prefer explicit development checks unless the component is confirmed to handle this internally.
</critical_constraints>

<output_expectations>
## Expected Output

After analyzing the project, I will:

1. Report the detected framework and chosen integration strategy
2. Confirm whether Stagewise is already initialized or not
3. If not already initialized:
   - Show the proposed file modifications
   - List any packages that need to be installed
   - Provide the exact installation command for the project\'s package manager
4. Detail any specific considerations or adaptations made for the project

This information will be presented in a clear, structured format to help you review and implement the proposed changes.
</output_expectations>
  `;
  await callCursorAgent(prompt);
}
