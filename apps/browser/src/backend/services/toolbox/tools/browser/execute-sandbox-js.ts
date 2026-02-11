import {
  type ExecuteSandboxJsToolInput,
  executeSandboxJsToolInputSchema,
} from '@shared/karton-contracts/ui/agent/tools/types';
import { tool } from 'ai';
import { rethrowCappedToolOutputError } from '../../utils';
import { capToolOutput } from '../../utils';
import type { SandboxService } from '@/services/sandbox';

/* Due to an issue in zod schema conversion in the ai sdk,
   the schema descriptions are not properly used for the prompts -
   thus, we include them in the descriptions as well. */

export const DESCRIPTION = `Execute JavaScript in a persistent, sandboxed environment. The sandbox is an isolated Node.js VM context — it does NOT have access to browser globals like \`document\`, \`window\`, or the DOM. To interact with browser tabs, use the \`API.sendCDP()\` function described below.

## Execution model
- Your script runs inside an async IIFE: \`(async () => { <your code> })()\`.
- You CAN use \`await\`, Promises, and async patterns.
- The **return value** of your script is sent back as the tool result. Always \`return\` the data you want to see.
- Timeout: 30 seconds per execution.

## Persistent context
The sandbox context is **persistent across calls** within your agent session. This means:
- Variables stored on \`globalThis\` survive between invocations (e.g. \`globalThis.myData = result\`).
- Use this to build up state, cache intermediate results, or store references for later use.
- You can run quick follow-up scripts to inspect or log previously stored values (e.g. \`return globalThis.myData\`).
- Note: variables declared with \`const\`/\`let\`/\`var\` inside a single script do NOT persist (they are scoped to the IIFE). Use \`globalThis\` explicitly to persist values.

## Available API

### \`API.sendCDP(tabHandle, method, params?)\`
Sends a **Chrome DevTools Protocol (CDP)** command to a specific browser tab and returns the result. This is your primary way to interact with web pages.

- \`tabHandle\` (string): The tab handle (e.g. \`"t_1"\`) from browser-information in the system prompt.
- \`method\` (string): The CDP method name (e.g. \`"Runtime.evaluate"\`, \`"DOM.getDocument"\`).
- \`params\` (object, optional): Parameters for the CDP method.
- Returns: A Promise that resolves with the CDP result object.

## Common CDP patterns

### Execute JavaScript in a page
\`\`\`
const result = await API.sendCDP("t_1", "Runtime.evaluate", {
  expression: "document.title",
  returnByValue: true,
});
return result.result.value;
\`\`\`

### Query the DOM
\`\`\`
const doc = await API.sendCDP("t_1", "DOM.getDocument", { depth: 0 });
const node = await API.sendCDP("t_1", "DOM.querySelector", {
  nodeId: doc.root.nodeId,
  selector: ".my-element",
});
return node;
\`\`\`

### Get computed styles
\`\`\`
const doc = await API.sendCDP("t_1", "DOM.getDocument", { depth: 0 });
const node = await API.sendCDP("t_1", "DOM.querySelector", {
  nodeId: doc.root.nodeId,
  selector: ".my-element",
});
const styles = await API.sendCDP("t_1", "CSS.getComputedStyleForNode", {
  nodeId: node.nodeId,
});
return styles;
\`\`\`

### Extract page content
\`\`\`
const html = await API.sendCDP("t_1", "Runtime.evaluate", {
  expression: "document.querySelector('.content').innerHTML",
  returnByValue: true,
});
return html.result.value;
\`\`\`

### Monitor network requests (requires enabling domain first)
\`\`\`
// Network domain is NOT pre-enabled, so enable it first
await API.sendCDP("t_1", "Network.enable");

// Now you can use Network methods
const cookies = await API.sendCDP("t_1", "Network.getCookies");
return cookies;
\`\`\`

## Use cases
1. **Inspect & extract styles** from any website — use CDP to get computed styles, CSS rules, animations, and pseudo-elements.
2. **Debug the user's app** — evaluate JS expressions in the page, inspect DOM state, check for errors.
3. **Interact with pages** — click elements, fill forms, trigger events via CDP.
4. **Multi-step analysis** — store intermediate results on \`globalThis\`, then run follow-up scripts to refine or combine them.

## Tips
- Always use \`return\` to send data back — the return value is shown to the user as the tool result.
- For structured data, return objects/arrays directly (they are JSON-serialized automatically).
- Use \`globalThis\` to persist data across multiple tool calls.
- Tab handles like \`"t_1"\` are listed in the browser-information section of the system prompt.
- When running \`Runtime.evaluate\`, set \`returnByValue: true\` to get serialized JS values back, or omit it to get object references.
- Selected elements include \`tabHandle\`, \`backendNodeId\`, and \`frameId\` which can be used directly with CDP methods like \`DOM.resolveNode\`, \`DOM.describeNode\`, or \`DOM.pushNodeByBackendIdToFrontend\` (to get a \`nodeId\`).

## Pre-enabled CDP domains
The following CDP domains are already enabled for each tab — do NOT call \`.enable()\` on them:
- \`DOM\` — DOM inspection and manipulation
- \`CSS\` — Computed styles, style rules, etc.
- \`Page\` — Page lifecycle, frames, navigation
- \`Runtime\` — JavaScript execution and evaluation
- \`Log\` and \`Console\` — Console message capture

For other CDP domains (e.g., \`Network\`, \`Overlay\`, \`Input\`), call \`<Domain>.enable\` before using them.

Parameters:
- script (string, REQUIRED): JavaScript code to execute in the sandbox.
`;

export const executeSandboxJsTool = (
  sandboxService: SandboxService,
  agentInstanceId: string,
) => {
  return tool({
    description: DESCRIPTION,
    inputSchema: executeSandboxJsToolInputSchema,
    execute: (params) =>
      executeSandboxJsToolExecute(params, agentInstanceId, sandboxService),
  });
};

async function executeSandboxJsToolExecute(
  params: ExecuteSandboxJsToolInput,
  agentInstanceId: string,
  sandboxService: SandboxService,
) {
  try {
    const value = await sandboxService.execute(agentInstanceId, params.script);

    // Convert result to string (execute() returns the raw script return value)
    const scriptResult =
      typeof value === 'string' ? value : JSON.stringify(value);

    return {
      message: 'Successfully executed sandbox JavaScript',
      result: capToolOutput(scriptResult),
    };
  } catch (error) {
    rethrowCappedToolOutputError(error);
  }
}
