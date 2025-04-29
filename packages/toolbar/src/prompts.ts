/**
 * Extracts React component names and source location from an HTMLElement.
 * @param element - The HTMLElement to extract React info from.
 * @returns An object containing component names and source location.
 */
export function getReactInfo(element: HTMLElement | null): {
  componentNames: string[];
  sourceLocation: string | null;
} {
  if (!element) {
    return { componentNames: [], sourceLocation: null };
  }
  try {
    // Find React Fiber key
    const fiberKey = Object.getOwnPropertyNames(element).find(
      (k) =>
        k.startsWith('__reactFiber$') ||
        k.startsWith('__reactInternalInstance$'),
    );

    if (!fiberKey) {
      return { componentNames: [], sourceLocation: null };
    }

    let fiber: any = (element as any)[fiberKey];
    const componentStack: string[] = [];

    // Walk up the Fiber tree and collect up to 10 component names
    while (fiber && componentStack.length < 10) {
      if (typeof fiber.type === 'function') {
        const name = fiber.type.displayName || fiber.type.name || 'Anonymous';
        if (!componentStack.includes(name)) {
          // Avoid duplicates
          componentStack.push(name);
        }
      }
      fiber = fiber.return;
    }

    // For source location, we could potentially get this from fiber._debugSource
    // but this is very internal and unstable, so leaving as null for now
    const sourceLocation = null;

    return {
      componentNames: componentStack,
      sourceLocation,
    };
  } catch (e) {
    console.error('Error getting React info:', e);
    return { componentNames: [], sourceLocation: null };
  }
}

/**
 * Extracts relevant attributes from an HTMLElement.
 * Filters out potentially noisy attributes like 'style' if computed styles are handled separately.
 * Prioritizes identifying attributes.
 */
function getElementAttributes(element: HTMLElement): { [key: string]: string } {
  const attrs: { [key: string]: string } = {};
  const priorityAttrs = [
    'id',
    'class',
    'name',
    'type',
    'href',
    'src',
    'alt',
    'for',
    'placeholder',
  ]; // Common identifying attributes
  const dataAttrs = [];

  for (let i = 0; i < element.attributes.length; i++) {
    const attr = element.attributes[i];
    // Store data-* attributes separately for emphasis
    if (attr.name.startsWith('data-')) {
      dataAttrs.push({ name: attr.name, value: attr.value });
    }
    // Capture priority attributes or others, potentially excluding style if handled elsewhere
    else if (
      priorityAttrs.includes(attr.name.toLowerCase()) ||
      attr.name.toLowerCase() !== 'style'
    ) {
      // Include 'class' even though classList is preferred, as it's in the source HTML
      attrs[attr.name] = attr.value;
    }
  }
  // Add data attributes to the main dictionary, perhaps prefixed for clarity
  dataAttrs.forEach((da) => {
    attrs[da.name] = da.value;
  });
  return attrs;
}

/**
 * Generates a detailed context string for a single HTMLElement.
 */
function generateElementContext(element: HTMLElement, index: number): string {
  let context = `### Element ${index + 1} Details:\n`;
  context += `- **Tag:** ${element.tagName.toLowerCase()}\n`;

  const id = element.id;
  if (id) {
    context += `- **ID:** ${id}\n`;
  }

  const classes = Array.from(element.classList).join(', ');
  if (classes) {
    context += `- **Classes:** ${classes}\n`;
  }

  const attributes = getElementAttributes(element);
  if (Object.keys(attributes).length > 0) {
    context += `- **Attributes:**\n`;
    for (const [key, value] of Object.entries(attributes)) {
      // Ensure class is not duplicated if already listed via classList
      if (key.toLowerCase() !== 'class' || !classes) {
        context += `  - ${key}: "${value}"\n`;
      }
    }
  }

  const text = element.innerText?.trim();
  if (text) {
    // Limit length to avoid excessive prompt size
    const maxLength = 100;
    context += `- **Visible Text:** "${text.length > maxLength ? `${text.substring(0, maxLength)}...` : text}"\n`;
  }

  // --- Structural Context ---
  context += `- **Structural Context (Parent):**\n`;
  if (element.parentElement) {
    const parent = element.parentElement;
    context += `  - Parent Tag: ${parent.tagName.toLowerCase()}\n`;
    if (parent.id) {
      context += `  - Parent ID: ${parent.id}\n`;
    }
    const parentClasses = Array.from(parent.classList).join(', ');
    if (parentClasses) {
      context += `  - Parent Classes: ${parentClasses}\n`;
    }
    // Optional: A snippet of parent's outerHTML containing the element might be useful
    // Be careful about length and complexity here.
    // try {
    //    const elementOuterHTML = element.outerHTML;
    //    const parentOuterHTML = parent.outerHTML;
    //    const snippetStart = Math.max(0, parentOuterHTML.indexOf(elementOuterHTML) - 50);
    //    const snippetEnd = Math.min(parentOuterHTML.length, parentOuterHTML.indexOf(elementOuterHTML) + elementOuterHTML.length + 50);
    //    context += `  - HTML Snippet Context: ...${parentOuterHTML.substring(snippetStart, snippetEnd)}...\n`;
    // } catch (e) { /* Handle potential errors */ }
  } else {
    context += `  - No parent element found (likely root or disconnected).\n`;
  }

  try {
    const styles = window.getComputedStyle(element);
    const relevantStyles = {
      color: styles.color,
      backgroundColor: styles.backgroundColor,
      fontSize: styles.fontSize,
      fontWeight: styles.fontWeight,
      display: styles.display,
      // Add other potentially relevant styles
    };
    context += `- **Current Computed Styles (Relevant):**\n`;
    for (const [key, value] of Object.entries(relevantStyles)) {
      context += `  - ${key}: ${value}\n`;
    }
  } catch (e) {
    context += `- Could not retrieve computed styles.\n`;
  }

  context += `\n`; // Add space before next element or end of section
  return context;
}

/**
 * Creates a comprehensive prompt for a Coding Agent LLM.
 *
 * @param selectedElements - An array of HTMLElements the user interacted with.
 * @param userPrompt - The user's natural language instruction.
 * @param url - The URL of the page where the interaction occurred.
 * @returns A formatted string prompt for the LLM.
 */
export function createPrompt(
  selectedElements: HTMLElement[],
  userPrompt: string,
  url: string,
): string {
  if (!selectedElements || selectedElements.length === 0) {
    // Handle cases where no specific element is selected, maybe provide general page context?
    // For now, we'll assume at least one element is usually selected for this type of interaction.
    return `
    \`\`\`
    Ah, sorry! I was wrong, it wasn't an error. The user has a specific change request. Here is the request:
    \`\`\`
User Prompt: "${userPrompt}"
URL: ${url}
Context: The user provided this prompt without selecting a specific element on the page. Please analyze the page code in general or ask for clarification.
`.trim();
  }

  let detailedContext = '';
  selectedElements.forEach((element, index) => {
    detailedContext += generateElementContext(element, index);
  });

  // --- Construct the Final Prompt ---
  // Using Markdown for clarity
  const finalPrompt = `
## User Request Context

**User's Goal:** "${userPrompt}"

**Interaction URL:** ${url}

## Selected Element(s) on Page

${detailedContext.trim()}

## Task for AI Agent

Based on the user's goal and the details of the selected HTML element(s) above:
1.  **Identify:** Locate the corresponding code file and structure (e.g., component, template) responsible for rendering this element/these elements. Use the provided tag, ID, classes, attributes, text content, and parent structure as clues.
2.  **Analyze:** Understand the user's request ("${userPrompt}") in the context of the identified code.
3.  **Modify:** Generate the necessary code changes (e.g., CSS, HTML structure, component props, state updates) to fulfill the user's request.
4.  **Consider:** If multiple elements were selected, apply the change appropriately to all of them if it makes sense, or clarify if the request seems ambiguous for multiple elements. Assume the user wants the change applied to all selected elements unless the prompt implies otherwise.

**Please provide the modified code snippet(s) and specify the file(s) to be changed.**
`.trim(); // Use trim() to remove leading/trailing whitespace

  return finalPrompt;
}
