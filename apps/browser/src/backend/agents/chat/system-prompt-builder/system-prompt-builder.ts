import type { ToolboxContextProvider } from '@/services/toolbox/types';

// Import basic system prompt parts
import { getApplicationInfo } from '../../shared/prompts/system/application-info';
import Identity from '../../shared/prompts/system/identity.md?raw';
import MessageStructure from '../../shared/prompts/system/message-structure.md?raw';
import SecurityAuthorityModel from '../../shared/prompts/system/security-authority-model.md?raw';
import { getApplicationStateContext } from '../../shared/prompts/system/application-state';
import { getSkillsInformation } from '../../shared/prompts/system/skills';

/** Chat agent system prompt structure:
 *
 * 1. Identity
 * 2. Application environment info (browser, stagewise files, etc.)
 * 3. Message structure explanation (custom formatting etc.)
 * 4. Security authority model (prevent prompt injection etc.)
 * 5. Skills information (what skills are available and how to use them)
 * 6. Long-term app state (open workspace, etc.)
 * 7. Pre-read files (AGENTS.md and WORKSPACE.md per mount)
 */

export async function buildChatSystemPrompt(
  toolbox: ToolboxContextProvider,
  agentInstanceId: string,
): Promise<string> {
  const agentsMdEntries = await toolbox.getAgentsMd(agentInstanceId);
  const workspaceMdEntries = await toolbox.getWorkspaceMd(agentInstanceId);

  const hasAgentsMd = agentsMdEntries.length > 0;
  const applicationInfo = getApplicationInfo({
    respectAgentsMd: hasAgentsMd,
  });

  const agentsMdParts = agentsMdEntries.map(
    (e) => `<file path="${e.mountPrefix}/AGENTS.md">${e.content}</file>`,
  );

  const workspaceMdParts = workspaceMdEntries.map(
    (e) =>
      `<file path="${e.mountPrefix}/.stagewise/WORKSPACE.md">${e.content}</file>`,
  );

  const prompt = [
    `<identity>${Identity}</identity>`,
    `<application-environment-info>${applicationInfo}</application-environment-info>`,
    `<message-structure>${MessageStructure}</message-structure>`,
    `<security-authority-model>${SecurityAuthorityModel}</security-authority-model>`,
    `<skills>${await getSkillsInformation(toolbox, agentInstanceId)}</skills>`,
    `<application-state>${await getApplicationStateContext(toolbox, agentInstanceId)}</application-state>`,
    ...agentsMdParts,
    ...workspaceMdParts,
  ]
    .filter(Boolean)
    .join('\n');

  return prompt;
}
