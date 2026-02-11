import type { ToolboxService } from '@/services/toolbox';
import { formatWorkspaceInfoMarkdown } from '../shared/prompts/utils/workspace-info';

/**
 * Shared context about what aspects to analyze/document in a PROJECT.md file.
 */
const ANALYSIS_AREAS = `### UI & Component Architecture (Priority)
- Component framework (React, Vue, Angular, Svelte, etc.) and its patterns
- Component file structure, naming conventions, and organization
- Prop patterns, type definitions, and component APIs
- Design system or component library usage
- Shared/reusable component locations

### Styling & CSS Architecture (Priority)
- Styling approach (CSS Modules, Tailwind, styled-components, CSS-in-JS, Sass, etc.)
- CSS file organization and naming conventions
- Theme configuration, design tokens, or CSS variables
- Responsive design patterns and breakpoints
- Animation and transition conventions

### Project Structure
- Key directories and their purposes (especially UI-related folders)
- Monorepo structure if applicable (apps, packages, shared UI libraries)
- Entry points and routing structure

### Tech Stack & Dependencies
- Framework versions and major UI-related dependencies
- State management solutions
- Build tools affecting frontend (bundlers, transpilers)

### Development Conventions
- Available scripts for development, building, and testing
- Linting/formatting tools (especially CSS/style linting)
- Code style patterns observed in components

### Backend & Other Areas (Brief Overview)
Don't ignore non-frontend aspects - include a general overview of:
- API structure, endpoints, or backend services if present
- Database or data layer patterns
- Authentication/authorization approach
- Any other significant architectural aspects

Keep this section concise - just enough context so the AI assistant understands the full picture.`;

const TOOLS_AVAILABLE = `- **listFilesTool**: List files and directories
- **globTool**: Find files matching patterns  
- **readFileTool**: Read file contents
- **grepSearchTool**: Search for patterns in code
- **writeProjectMdTool**: Write the final PROJECT.md file`;

/**
 * Builds the system prompt for the ProjectMdAgent.
 *
 * This agent analyzes the user's project and generates a comprehensive PROJECT.md
 * file that describes the project structure, UI conventions, dependencies, etc.
 * This context file is then used by the ChatAgent to have better understanding
 * of the user's project.
 *
 * When updateReason is provided, the agent operates in "update mode" - focusing
 * only on the outdated sections rather than regenerating from scratch.
 */
export async function buildProjectMdSystemPrompt(
  toolbox: ToolboxService,
  updateReason: string | undefined,
): Promise<string> {
  const workspaceSnapshot = toolbox.getWorkspaceSnapshot();
  const workspacePath = workspaceSnapshot.workspacePath ?? 'unknown';

  const isUpdateMode = !!updateReason;

  // Only include workspace info head start for full analysis mode
  const workspaceInfo = !isUpdateMode ? await toolbox.getWorkspaceInfo() : null;
  const workspaceInfoSection = workspaceInfo
    ? `## Static Analysis (Head Start)

Use this pre-analyzed information as a starting point - verify and expand upon it with your own exploration.

${formatWorkspaceInfoMarkdown(workspaceInfo)}

`
    : '';

  if (isUpdateMode) {
    return buildUpdateModePrompt(workspacePath);
  }

  return buildFullAnalysisModePrompt(workspacePath, workspaceInfoSection);
}

/**
 * System prompt for full analysis mode - creating PROJECT.md from scratch.
 */
function buildFullAnalysisModePrompt(
  workspacePath: string,
  workspaceInfoSection: string,
): string {
  return `You are a frontend-specialized project analyst creating a PROJECT.md file for a web project.

## Your Goal

Analyze the project at "${workspacePath}" and create a PROJECT.md that helps AI coding assistants understand this project - with **special emphasis on UI, styling, and frontend architecture**.

This context file powers a frontend-aware AI assistant, so thoroughly document everything related to components, styles, design patterns, and visual conventions.

${workspaceInfoSection}## What to Analyze

${ANALYSIS_AREAS}

## Output Format

Generate a well-structured PROJECT.md with clear markdown sections.
Be comprehensive on frontend/UI aspects, concise on other areas.

## Tools Available

${TOOLS_AVAILABLE}

## Instructions

Explore the project structure, read key config and component files, then generate the PROJECT.md using writeProjectMdTool. Call finish when done.

DO NOT include sensitive information like API keys or credentials.`;
}

/**
 * System prompt for update mode - selectively updating outdated sections.
 */
function buildUpdateModePrompt(workspacePath: string): string {
  return `You are a frontend-specialized project analyst updating an existing PROJECT.md file.

## Your Goal

You will receive the current PROJECT.md content along with a reason for the update. Your task is to **selectively update** only the outdated or affected sections - NOT regenerate the entire file.

The project is located at "${workspacePath}".

## Update Strategy

1. **Read the update reason carefully** - it tells you what changed
2. **Identify affected sections** - determine which parts of PROJECT.md need updating
3. **Investigate only what's needed** - read only the files/directories relevant to the change
4. **Preserve unchanged content** - keep sections that aren't affected by the update
5. **Update efficiently** - make targeted changes, don't rewrite everything

## Reference: Areas Covered in PROJECT.md

${ANALYSIS_AREAS}

## Tools Available

${TOOLS_AVAILABLE}

## Instructions

1. Analyze the update reason provided in the user message
2. Read the current PROJECT.md content (provided in the user message)
3. Investigate ONLY the files/areas affected by the change
4. Update the relevant sections while preserving the rest
5. Write the updated PROJECT.md using writeProjectMdTool
6. Call finish when done

Be efficient - don't re-analyze the entire project if only a small part changed.

DO NOT include sensitive information like API keys or credentials.`;
}
