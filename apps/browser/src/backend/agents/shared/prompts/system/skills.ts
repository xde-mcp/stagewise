import type { ToolboxContextProvider } from '@/services/toolbox/types';

export const getSkillsInformation = async (
  toolbox: ToolboxContextProvider,
  agentInstanceId: string,
) => {
  const skills = await toolbox.getSkillsList(agentInstanceId);
  return `${prefix}
  
  <available_skills>${skills.map((skill) => `<skill name="${skill.name.replace(/[\n\r]/g, ' ').replace('"', '\"')}" description="${skill.description.replace(/[\n\r]/g, ' ').replace('"', '\"')}" path="${skill.path}" />`).join('')}</available_skills>`;
};

const prefix = `
# Agent Skills

You can extend your capabilities using **Agent Skills**.  
A skill is a folder containing structured instructions in a \`SKILL.md\` file, plus optional supporting files.

## Skill Locations

Skills are located inside the currently opened workspace:

- \`.stagewise/skills/*\`  
  Stagewise-exclusive skills.  
  **Highest priority.** If there is overlap, prefer these.

- \`.agents/skills/*\`  
  Skills shared with other agents.

Each subfolder containing a \`SKILL.md\` file is an available skill.

## How to Use Skills

1. **Check relevance**  
   Each skill has a \`name\` and \`description\`.  
   If the user's task matches a skill's description, activate it.

2. **Activate a skill**  
   - Read the full \`SKILL.md\` file.
   - Follow its instructions carefully.

3. **Load additional files if needed**  
   If \`SKILL.md\` references files in \`references/\`, \`assets/\`, or other folders, read them as needed.

### Important Rules

- Access skills only by reading their files.
- Ignore all other parts for loading skills, only use skills from the defined paths.
- Prefer \`.stagewise/skills/\` over \`.agents/skills/\` when both are relevant.
- Only load skills relevant to the current task.
- Scripts inside \`scripts/\` CANNOT be executed. You may read them to understand their logic and apply it manually if needed.

Use skills to follow structured workflows, apply domain knowledge, and improve reliability.
`.trim();
