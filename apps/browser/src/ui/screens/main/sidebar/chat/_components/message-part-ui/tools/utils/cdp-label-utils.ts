import type { TabState } from '@shared/karton-contracts/ui';

/**
 * Represents a parsed CDP call extracted from a sandbox script.
 */
export interface ParsedCDPCall {
  tabHandle: string;
  method: string;
}

/**
 * Represents a parsed writeFile call extracted from a sandbox script.
 */
export interface ParsedWriteFileCall {
  relativePath: string;
}

/**
 * Represents a parsed getAttachment call extracted from a sandbox script.
 */
export interface ParsedGetAttachmentCall {
  attachmentId: string;
}

/**
 * Indicates an outputAttachment call was found in a sandbox script.
 */
export interface ParsedMultimodalAttachmentCall {
  found: true;
}

/**
 * Human-readable labels for common CDP methods.
 * Each method maps to in-progress/completed labels and a preposition for the hostname.
 * - "from" for data retrieval (read, got, extracted)
 * - "on" for actions/interactions (queried, called, ran)
 */
const CDP_METHOD_LABELS: Record<
  string,
  { inProgress: string; completed: string; preposition: 'on' | 'from' | 'of' }
> = {
  // CSS domain
  'CSS.enable': {
    inProgress: 'Enabling CSS inspection',
    completed: 'Enabled CSS inspection',
    preposition: 'on',
  },
  'CSS.getComputedStyleForNode': {
    inProgress: 'Reading computed styles',
    completed: 'Read computed styles',
    preposition: 'from',
  },
  'CSS.getMatchedStylesForNode': {
    inProgress: 'Reading CSS rules',
    completed: 'Read CSS rules',
    preposition: 'from',
  },
  'CSS.getInlineStylesForNode': {
    inProgress: 'Reading inline styles',
    completed: 'Read inline styles',
    preposition: 'from',
  },
  'CSS.getStyleSheetText': {
    inProgress: 'Reading stylesheet',
    completed: 'Read stylesheet',
    preposition: 'from',
  },

  // DOM domain
  'DOM.enable': {
    inProgress: 'Enabling DOM inspection',
    completed: 'Enabled DOM inspection',
    preposition: 'on',
  },
  'DOM.getDocument': {
    inProgress: 'Reading document',
    completed: 'Read document',
    preposition: 'from',
  },
  'DOM.querySelector': {
    inProgress: 'Querying element',
    completed: 'Queried element',
    preposition: 'on',
  },
  'DOM.querySelectorAll': {
    inProgress: 'Querying elements',
    completed: 'Queried elements',
    preposition: 'on',
  },
  'DOM.getOuterHTML': {
    inProgress: 'Reading element HTML',
    completed: 'Read element HTML',
    preposition: 'from',
  },
  'DOM.resolveNode': {
    inProgress: 'Resolving element',
    completed: 'Resolved element',
    preposition: 'on',
  },
  'DOM.getBoxModel': {
    inProgress: 'Reading box model',
    completed: 'Read box model',
    preposition: 'from',
  },

  // Runtime domain
  'Runtime.enable': {
    inProgress: 'Enabling runtime',
    completed: 'Enabled runtime',
    preposition: 'on',
  },
  'Runtime.evaluate': {
    inProgress: 'Running a script',
    completed: 'Ran a script',
    preposition: 'on',
  },
  'Runtime.callFunctionOn': {
    inProgress: 'Calling function',
    completed: 'Called function',
    preposition: 'on',
  },
  'Runtime.getProperties': {
    inProgress: 'Reading properties',
    completed: 'Read properties',
    preposition: 'from',
  },

  // Page domain
  'Page.enable': {
    inProgress: 'Enabling page inspection',
    completed: 'Enabled page inspection',
    preposition: 'on',
  },
  'Page.getFrameTree': {
    inProgress: 'Reading frames',
    completed: 'Read frames',
    preposition: 'from',
  },
  'Page.captureScreenshot': {
    inProgress: 'Taking screenshot',
    completed: 'Took screenshot',
    preposition: 'of',
  },

  // Network domain
  'Network.enable': {
    inProgress: 'Enabling network inspection',
    completed: 'Enabled network inspection',
    preposition: 'on',
  },
  'Network.getResponseBody': {
    inProgress: 'Reading response',
    completed: 'Read response',
    preposition: 'from',
  },
};

/**
 * Parses a sandbox script to extract CDP calls.
 * Matches patterns like: API.sendCDP("t_1", "CSS.getComputedStyleForNode", ...)
 */
export function parseCDPCalls(script: string): ParsedCDPCall[] {
  // Regex to match API.sendCDP("tabHandle", "Method.name", ...)
  // Supports both single and double quotes
  const regex = /API\.sendCDP\s*\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']/g;
  const calls: ParsedCDPCall[] = [];

  let match = regex.exec(script);
  while (match !== null) {
    calls.push({
      tabHandle: match[1],
      method: match[2],
    });
    match = regex.exec(script);
  }

  return calls;
}

/**
 * Parses a sandbox script to extract writeFile calls.
 * Matches fs.writeFile, fs.writeFileSync, fsp.writeFile, and legacy API.writeFile.
 */
export function parseWriteFileCalls(script: string): ParsedWriteFileCall[] {
  const regex =
    /(?:API\.writeFile|fs\.writeFile(?:Sync)?|fsp\.writeFile)\s*\(\s*["'`]([^"'`]+)["'`]/g;
  const calls: ParsedWriteFileCall[] = [];

  let match = regex.exec(script);
  while (match !== null) {
    calls.push({
      relativePath: match[1],
    });
    match = regex.exec(script);
  }

  return calls;
}

/**
 * Parses a sandbox script to extract getAttachment calls.
 * Matches patterns like: API.getAttachment("abc123")
 */
export function parseGetAttachmentCalls(
  script: string,
): ParsedGetAttachmentCall[] {
  // Regex to match API.getAttachment("attachmentId")
  // Supports both single and double quotes
  const regex = /API\.getAttachment\s*\(\s*["']([^"']+)["']/g;
  const calls: ParsedGetAttachmentCall[] = [];

  let match = regex.exec(script);
  while (match !== null) {
    calls.push({
      attachmentId: match[1],
    });
    match = regex.exec(script);
  }

  return calls;
}

/**
 * Parses a sandbox script to extract outputAttachment calls.
 * Matches patterns like: API.outputAttachment({...})
 */
export function parseOutputAttachmentCalls(
  script: string,
): ParsedMultimodalAttachmentCall[] {
  const regex = /API\.outputAttachment\s*\(/g;
  const calls: ParsedMultimodalAttachmentCall[] = [];

  while (regex.exec(script) !== null) calls.push({ found: true });

  return calls;
}

/**
 * Gets the filename from a path (last segment after /).
 */
function getFileName(relativePath: string): string {
  const parts = relativePath.split('/');
  return parts[parts.length - 1] || relativePath;
}

interface MethodLabelResult {
  label: string;
  preposition: 'on' | 'from' | 'of';
}

/**
 * Gets a human-readable label and preposition for a CDP method.
 * Falls back to a generic label based on the domain if the method is unknown.
 */
export function getMethodLabel(
  method: string,
  isInProgress: boolean,
): MethodLabelResult {
  const labels = CDP_METHOD_LABELS[method];
  if (labels)
    return {
      label: isInProgress ? labels.inProgress : labels.completed,
      preposition: labels.preposition,
    };

  // Fallback: extract domain and create generic label
  // e.g., "CSS.someUnknownMethod" → "Inspecting CSS" / "Inspected CSS"
  const domain = method.split('.')[0];
  if (domain) {
    return {
      label: isInProgress ? `Inspecting ${domain}` : `Inspected ${domain}`,
      preposition: 'on',
    };
  }

  return {
    label: isInProgress ? 'Running script' : 'Ran script',
    preposition: 'on',
  };
}

/**
 * Resolves a tab handle (e.g., "t_1") to its hostname.
 * Returns undefined if the tab is not found or URL parsing fails.
 */
export function resolveTabHostname(
  tabHandle: string,
  activeTabs: Record<string, TabState>,
): string | undefined {
  const tab = Object.values(activeTabs).find((t) => t.handle === tabHandle);
  if (!tab) return undefined;

  try {
    return new URL(tab.url).hostname;
  } catch {
    return undefined;
  }
}

/**
 * Generates a contextual label for a sandbox script based on its CDP calls,
 * file writes, and attachment reads.
 *
 * @param script - The sandbox script content
 * @param activeTabs - Current browser tabs from state
 * @param isInProgress - Whether the script is still running
 * @returns A human-readable label describing the operation
 */
export function getSandboxLabel(
  script: string | undefined,
  activeTabs: Record<string, TabState>,
  isInProgress: boolean,
): string {
  if (!script) return isInProgress ? 'Running a script...' : 'Ran a script';

  const cdpCalls = parseCDPCalls(script);
  const writeFileCalls = parseWriteFileCalls(script);
  const getAttachmentCalls = parseGetAttachmentCalls(script);
  const multimodalAttachmentCalls = parseOutputAttachmentCalls(script);

  // No API calls found
  if (
    cdpCalls.length === 0 &&
    writeFileCalls.length === 0 &&
    getAttachmentCalls.length === 0 &&
    multimodalAttachmentCalls.length === 0
  )
    return isInProgress ? 'Running a script...' : 'Ran a script';

  // Only multimodal attachment parsing, no other API calls
  if (
    cdpCalls.length === 0 &&
    writeFileCalls.length === 0 &&
    getAttachmentCalls.length === 0 &&
    multimodalAttachmentCalls.length > 0
  ) {
    if (multimodalAttachmentCalls.length === 1)
      return isInProgress ? 'Parsing attachment...' : 'Parsed attachment';

    return isInProgress
      ? `Parsing ${multimodalAttachmentCalls.length} attachments...`
      : `Parsed ${multimodalAttachmentCalls.length} attachments`;
  }

  // Only attachment reads, no CDP calls, no file writes
  if (
    cdpCalls.length === 0 &&
    writeFileCalls.length === 0 &&
    getAttachmentCalls.length > 0
  ) {
    if (getAttachmentCalls.length === 1)
      return isInProgress ? 'Reading attachment...' : 'Read attachment';

    return isInProgress
      ? `Reading ${getAttachmentCalls.length} attachments...`
      : `Read ${getAttachmentCalls.length} attachments`;
  }

  // Only file writes (possibly with attachment reads), no CDP calls
  if (cdpCalls.length === 0 && writeFileCalls.length > 0) {
    const attachmentSuffix =
      getAttachmentCalls.length > 0
        ? ` from ${getAttachmentCalls.length === 1 ? 'attachment' : `${getAttachmentCalls.length} attachments`}`
        : '';

    if (writeFileCalls.length === 1) {
      const fileName = getFileName(writeFileCalls[0].relativePath);
      return isInProgress
        ? `Writing ${fileName}${attachmentSuffix}...`
        : `Wrote ${fileName}${attachmentSuffix}`;
    }
    return isInProgress
      ? `Writing ${writeFileCalls.length} files${attachmentSuffix}...`
      : `Wrote ${writeFileCalls.length} files${attachmentSuffix}`;
  }

  // Get unique tab handles
  const uniqueTabHandles = Array.from(
    new Set(cdpCalls.map((c) => c.tabHandle)),
  );

  // Multiple tabs targeted
  if (uniqueTabHandles.length > 1)
    return isInProgress
      ? `Running a script on ${uniqueTabHandles.length} tabs...`
      : `Ran a script on ${uniqueTabHandles.length} tabs`;

  // Single tab - resolve hostname
  const hostname = resolveTabHostname(uniqueTabHandles[0], activeTabs);

  // Get the action from the last CDP call (most recent during streaming)
  const latestMethod = cdpCalls[cdpCalls.length - 1].method;
  const { label, preposition } = getMethodLabel(latestMethod, isInProgress);

  // Build the suffix using the method-specific preposition
  const suffix = hostname ? ` ${preposition} ${hostname}` : '';

  // If there are also file writes, mention them
  if (writeFileCalls.length > 0) {
    const fileInfo =
      writeFileCalls.length === 1
        ? getFileName(writeFileCalls[0].relativePath)
        : `${writeFileCalls.length} files`;
    if (isInProgress) return `${label}${suffix}, writing ${fileInfo}...`;
    return `${label}${suffix}, wrote ${fileInfo}`;
  }

  if (isInProgress) return `${label}${suffix}...`;

  return `${label}${suffix}`;
}
