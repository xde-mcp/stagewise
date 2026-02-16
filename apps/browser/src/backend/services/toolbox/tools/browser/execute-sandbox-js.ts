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

### \`API.writeFile(relativePath, content)\`
Writes a file to the user's workspace. Changes are tracked in diff-history and can be undone.

- \`relativePath\` (string): Path relative to workspace root (e.g. \`"src/output.json"\`, \`"screenshots/page.png"\`).
- \`content\` (string | Buffer): File content — use string for text files, Buffer for binary files.
- Returns: A Promise that resolves with \`{ success: true, bytesWritten: number }\`.
- Throws: If no workspace is connected or path is outside workspace.

**Examples:**
\`\`\`js
// Write a text file (e.g., JSON data)
await API.writeFile("output/data.json", JSON.stringify(myData, null, 2));

// Write a binary file (e.g., screenshot from CDP)
const screenshot = await API.sendCDP("t_1", "Page.captureScreenshot", { format: "png" });
await API.writeFile("screenshots/page.png", Buffer.from(screenshot.data, "base64"));
\`\`\`

### \`API.getAttachment(attachmentId)\`
Retrieves a user-provided attachment (image, file) from the conversation by its ID. Use this to access files the user has attached to their messages.

- \`attachmentId\` (string): The attachment ID from the user message (e.g., from \`[](image:abc123)\` or \`[](file:xyz789)\`).
- Returns: A Promise that resolves with \`{ id, fileName, mediaType, content: Buffer }\`.
- Throws: If attachment not found, exceeds size limits (5MB images, 20MB documents), or is unsupported.

**Examples:**
\`\`\`js
// Get an image attachment and write it to the workspace
const img = await API.getAttachment("abc123");
await API.writeFile(\`uploads/\${img.fileName}\`, img.content);

// Get a file attachment and process its content
const file = await API.getAttachment("xyz789");
if (file.mediaType === "application/json") {
  const data = JSON.parse(file.content.toString("utf-8"));
  return data;
}
\`\`\`

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
5. **Save screenshots** — capture page screenshots via CDP and write them to the workspace using \`API.writeFile()\`.
6. **Export data** — extract data from pages and save it as JSON, CSV, or other formats to the workspace.
7. **Save user attachments** — retrieve images or files the user attached to messages via \`API.getAttachment()\` and write them to the workspace.

## Dynamic imports (external libraries)
You can use \`await import('https://...')\` to import ESM modules from CDNs like **esm.sh** at runtime. This lets you use any npm package without prior installation.

- Only \`https://\` URLs are allowed.
- Use the \`?bundle\` query parameter on esm.sh to bundle all transitive dependencies into a single request (faster, avoids nested fetches).
- Imported modules are cached for the duration of the agent session — subsequent imports of the same URL are instant.

**Examples:**
\`\`\`
// Use lodash from esm.sh (bundled)
const _ = (await import('https://esm.sh/lodash-es?bundle')).default;
return _.chunk([1, 2, 3, 4, 5, 6], 2);

// Use date-fns
const { format } = await import('https://esm.sh/date-fns?bundle');
return format(new Date(), 'yyyy-MM-dd');

// Use papaparse to generate CSV
const Papa = (await import('https://esm.sh/papaparse?bundle')).default;
const csv = Papa.unparse([{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }]);
await API.writeFile('output/data.csv', csv);
return 'CSV written';
\`\`\`

## Tips
- Always use \`return\` to send data back — the return value is shown to the user as the tool result.
- For structured data, return objects/arrays directly (they are JSON-serialized automatically).
- Use \`globalThis\` to persist data across multiple tool calls.
- Tab handles like \`"t_1"\` are listed in the browser-information section of the system prompt.
- When running \`Runtime.evaluate\`, set \`returnByValue: true\` to get serialized JS values back, or omit it to get object references.
- Selected elements include \`tabHandle\`, \`backendNodeId\`, and \`frameId\` which can be used directly with CDP methods like \`DOM.resolveNode\`, \`DOM.describeNode\`, or \`DOM.pushNodeByBackendIdToFrontend\` (to get a \`nodeId\`).

## Available globals
The sandbox provides these Node.js/Web APIs in addition to V8 built-ins (Promise, Map, Set, Array, Object, JSON, Math, RegExp, Date, Error, typed arrays, etc.):

- **Timers:** \`setTimeout\`, \`clearTimeout\`, \`setInterval\`, \`clearInterval\`, \`setImmediate\`, \`clearImmediate\`
- **Networking:** \`fetch\`, \`Headers\`, \`Request\`, \`Response\`, \`AbortController\`, \`AbortSignal\`
- **Console:** \`console\`
- **URLs:** \`URL\`, \`URLSearchParams\`
- **Encoding:** \`TextEncoder\`, \`TextDecoder\`, \`atob\`, \`btoa\`
- **Binary data:** \`Buffer\`, \`Blob\`
- **Forms:** \`FormData\`
- **Utilities:** \`structuredClone\`, \`queueMicrotask\`, \`crypto.randomUUID()\`
- **Compatibility:** \`self\`, \`global\`, \`process\` (minimal shim with \`process.env.NODE_ENV\`, \`process.nextTick\`)

## Node.js built-in modules
You can import safe Node.js built-in modules via \`await import('node:...')\`:

**Available:** \`node:buffer\`, \`node:crypto\`, \`node:events\`, \`node:path\`, \`node:querystring\`, \`node:stream\`, \`node:string_decoder\`, \`node:url\`, \`node:util\`, \`node:zlib\`, \`node:assert\`

**Blocked (security):** \`node:fs\`, \`node:net\`, \`node:http\`, \`node:https\`, \`node:child_process\`, \`node:worker_threads\`, \`node:vm\`, and other I/O modules — these throw a clear error.

**Examples:**
\`\`\`
// Compress data with zlib
const zlib = await import('node:zlib');
const compressed = zlib.deflateSync(Buffer.from('hello world'));
return compressed.toString('base64');

// Hash data with crypto
const crypto = await import('node:crypto');
return crypto.createHash('sha256').update('hello').digest('hex');

// Use util.promisify
const util = await import('node:util');
const zlib = await import('node:zlib');
const gzip = util.promisify(zlib.gzip);
const result = await gzip(Buffer.from('data'));
return result.toString('base64');
\`\`\`

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
    execute: async (params, options) => {
      const { toolCallId } = options as { toolCallId: string };
      // Set the tool call ID for this execution so file writes are tracked correctly
      sandboxService.setAgentToolCallId(agentInstanceId, toolCallId);
      try {
        return await executeSandboxJsToolExecute(
          params,
          agentInstanceId,
          sandboxService,
        );
      } finally {
        // Always clear the tool call ID after execution completes
        sandboxService.clearAgentToolCallId(agentInstanceId);
      }
    },
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
