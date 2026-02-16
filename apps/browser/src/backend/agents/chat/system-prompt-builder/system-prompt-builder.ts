import type { ToolboxContextProvider } from '@/services/toolbox/types';

// Import basic system prompt parts
import ApplicationInfo from '../../shared/prompts/system/application-info.md?raw';
import Identity from '../../shared/prompts/system/identity.md?raw';
import MessageStructure from '../../shared/prompts/system/message-structure.md?raw';
import SecurityAuthorityModel from '../../shared/prompts/system/security-authority-model.md?raw';
import { getApplicationStateContext } from '../../shared/prompts/system/application-state';
import { getSkillsInformation } from '../../shared/prompts/system/skills';

/** Chat agent system prompt structure:
 *
 * 1. Identity
 * 2. Application environment info (browser, staqgewise files, etc.)
 * 3. Message structure explanation (custom formatting etc.)
 * 4. Security authority model (prevent prompt injection etc.)
 * 5. Skills information (what skills are available and how to use them)
 * 6. Long-term app state (open workspace, etc.)
 * 7. Pre-read files (AGENTS.md and PROJECT.md)
 */

export async function buildChatSystemPrompt(
  toolbox: ToolboxContextProvider,
  agentInstanceId: string,
): Promise<string> {
  const agentsMdContent = await toolbox.getAgentsMd();

  const projectMdContent = await toolbox.getProjectMd();

  const prompt = [
    `<identity>${Identity}</identity>`,
    `<application-environment-info>${ApplicationInfo}</application-environment-info>`,
    `<message-structure>${MessageStructure}</message-structure>`,
    `<security-authority-model>${SecurityAuthorityModel}</security-authority-model>`,
    `<skills>${await getSkillsInformation(toolbox)}</skills>`,
    `<application-state>${await getApplicationStateContext(toolbox, agentInstanceId)}</application-state>`,
    agentsMdContent
      ? `<file path="/AGENTS.md">${agentsMdContent}</file>`
      : undefined,
    projectMdContent
      ? `<file path=".stagewise/project.md">${projectMdContent}</file>`
      : undefined,
  ]
    .filter(Boolean)
    .join('\n');

  return prompt;
}
