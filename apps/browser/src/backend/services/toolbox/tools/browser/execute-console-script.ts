import {
  type ExecuteConsoleScriptToolInput,
  executeConsoleScriptToolInputSchema,
} from '@shared/karton-contracts/ui/tools/types';
import { tool } from 'ai';
import { rethrowCappedToolOutputError } from '../../utils';
import { capToolOutput } from '../../utils';
import type { WindowLayoutService } from '@/services/window-layout';

/* Due to an issue in zod schema conversion in the ai sdk,
   the schema descriptions are not properly used for the prompts -
   thus, we include them in the descriptions as well. */

export const DESCRIPTION = `Execute synchronous JavaScript in the browser console of a specific tab. Works on ANY website (external sites or localhost).

IMPORTANT LIMITATIONS:
- Scripts must be SYNCHRONOUS (no async/await, no Promise.then, no setTimeout/setInterval)
- Scripts execute immediately and return a value
- To check animations/transitions, use getComputedStyle() to inspect CSS properties, timing functions, and durations

Use cases:
1. COPY STYLES from external websites - Extract computed styles, then implement in user's codebase
2. DEBUG STYLING ISSUES on user's app - Inspect why elements look wrong
3. INSPECT ANIMATIONS - Check CSS animation/transition properties (NOT observe them over time)

When copying styles, be INCREDIBLY THOROUGH. Extract ALL of:
- Base computed styles (colors, typography, spacing, borders, shadows, layout)
- Pseudo-elements (::before, ::after) via getComputedStyle(el, '::before')
- Pseudo-class states (:hover, :active, :focus) - check CSS rules in stylesheets
- Transitions & animations (timing, easing, @keyframes) via CSS inspection
- Advanced effects (backdrop-filter, gradients, clip-path)

Script patterns:
- getComputedStyle(el) for all CSS properties including animation/transition definitions
- getComputedStyle(el, '::before') for pseudo-elements
- document.styleSheets to find CSS rules and @keyframes definitions
- Return results as JSON.stringify({...}) for structured data

Example - Checking animation properties:
  const el = document.querySelector('.animated');
  const styles = getComputedStyle(el);
  JSON.stringify({
    animation: styles.animation,
    animationDuration: styles.animationDuration,
    animationTimingFunction: styles.animationTimingFunction,
    transition: styles.transition,
    transform: styles.transform
  })

Parameters:
- id (string, REQUIRED): The tab ID to execute the script on. Use the tab ID from browser-information in the system prompt.
- script (string, REQUIRED): Synchronous JavaScript code to execute.
`;

export const executeConsoleScriptTool = (
  windowLayoutService: WindowLayoutService,
) => {
  return tool({
    description: DESCRIPTION,
    inputSchema: executeConsoleScriptToolInputSchema,
    execute: (params) =>
      executeConsoleScriptToolExecute(params, windowLayoutService),
  });
};

async function executeConsoleScriptToolExecute(
  params: ExecuteConsoleScriptToolInput,
  windowLayoutService: WindowLayoutService,
) {
  try {
    // Timeout promise to prevent hanging
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Script execution timed out after 5 seconds'));
      }, 5000);
    });

    const result = await Promise.race([
      windowLayoutService.executeConsoleScript(params.script, params.id),
      timeoutPromise,
    ]);

    if (!result.success) throw new Error(result.error);

    // Convert result to string
    const scriptResult =
      typeof result.result === 'string'
        ? result.result
        : JSON.stringify(result.result);

    return {
      message: 'Successfully executed console script',
      result: capToolOutput(scriptResult),
    };
  } catch (error) {
    rethrowCappedToolOutputError(error);
  }
}
