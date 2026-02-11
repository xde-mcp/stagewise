import type { Meta, StoryObj } from '@storybook/react';
import type { AgentMessage } from '@shared/karton-contracts/ui/agent';
import {
  ProjectMdStatusSection,
  type ProjectMdStatus,
} from '../project-md-section';
import { StatusCardSectionComponent } from '../shared';

// Helper to create mock assistant messages with tool parts
function createMockToolMessage(
  toolType: string,
  input?: Record<string, unknown>,
): AgentMessage {
  return {
    id: `mock-message-${Date.now()}`,
    role: 'assistant',
    parts: [
      {
        type: toolType,
        state: 'input-available',
        input: input ?? {},
      } as AgentMessage['parts'][number],
    ],
  };
}

// Wrapper component to render the section
interface ProjectMdSectionStoryProps {
  status: ProjectMdStatus;
  history: AgentMessage[];
  workspacePath?: string | null;
}

function ProjectMdSectionStory({
  status,
  history,
  workspacePath,
}: ProjectMdSectionStoryProps) {
  const section = ProjectMdStatusSection({
    status,
    history,
    workspacePath,
    onDismiss: () => console.log('[Storybook] onDismiss called'),
    onShowFile: () =>
      console.log(
        '[Storybook] onShowFile called - would navigate to agent-settings#context-files',
      ),
  });

  if (!section) {
    return (
      <div className="rounded border border-muted-foreground border-dashed p-4 text-center text-muted-foreground text-sm">
        Section is hidden (status = &apos;hidden&apos;)
      </div>
    );
  }

  return (
    <div className="relative rounded-lg border border-border bg-background p-1">
      <StatusCardSectionComponent item={section} showDivider={false} />
    </div>
  );
}

const meta: Meta<typeof ProjectMdSectionStory> = {
  title: 'Chat/Footer Status Card/Project MD Section',
  component: ProjectMdSectionStory,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-[400px] p-4">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    status: {
      control: 'select',
      options: ['hidden', 'running', 'completed'],
      description: 'Current status of the project-md generation',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ProjectMdSectionStory>;

/**
 * Hidden State
 *
 * When status is 'hidden', the section returns null and nothing is rendered.
 * This is the default state when no project-md generation is in progress.
 */
export const Hidden: Story = {
  args: {
    status: 'hidden',
    history: [],
  },
};

/**
 * Running - Initial State
 *
 * When generation first starts with no tool calls yet.
 * Shows "Initializing PROJECT.md..."
 */
export const RunningInitial: Story = {
  name: 'Running / Initial',
  args: {
    status: 'running',
    history: [],
  },
};

/**
 * Running - Reading Files
 *
 * When the agent is reading a specific file.
 * Shows "Reading Button.tsx..."
 */
export const RunningReadingFiles: Story = {
  name: 'Running / Reading Files',
  args: {
    status: 'running',
    history: [
      createMockToolMessage('tool-readFileTool', {
        relative_path: 'src/components/Button.tsx',
      }),
    ],
  },
};

/**
 * Running - Listing Files
 *
 * When the agent is listing files in a directory.
 * Shows "Listing files in src/components..."
 */
export const RunningListingFiles: Story = {
  name: 'Running / Listing Files',
  args: {
    status: 'running',
    history: [
      createMockToolMessage('tool-listFilesTool', {
        relative_path: 'src/components',
      }),
    ],
  },
};

/**
 * Running - Glob Search
 *
 * When the agent is searching for files using glob patterns.
 * Shows "Searching for **\/*.tsx..."
 */
export const RunningGlobSearch: Story = {
  name: 'Running / Glob Search',
  args: {
    status: 'running',
    history: [
      createMockToolMessage('tool-globTool', {
        pattern: '**/*.tsx',
      }),
    ],
  },
};

/**
 * Running - Grep Search
 *
 * When the agent is searching code for specific patterns.
 * Shows "Searching code for useState..."
 */
export const RunningGrepSearch: Story = {
  name: 'Running / Grep Search',
  args: {
    status: 'running',
    history: [
      createMockToolMessage('tool-grepSearchTool', {
        query: 'useState',
      }),
    ],
  },
};

/**
 * Running - Writing PROJECT.md
 *
 * When the agent is writing the final PROJECT.md file.
 * Shows "Writing PROJECT.md..."
 */
export const RunningWritingFile: Story = {
  name: 'Running / Writing PROJECT.md',
  args: {
    status: 'running',
    history: [createMockToolMessage('tool-writeProjectMdTool', {})],
  },
};

/**
 * Running - Multiple Tool Calls
 *
 * Demonstrates that the section shows the LAST tool call status.
 * After reading files and listing, now searching with grep.
 */
export const RunningMultipleToolCalls: Story = {
  name: 'Running / Multiple Tool Calls',
  args: {
    status: 'running',
    history: [
      createMockToolMessage('tool-listFilesTool', { relative_path: 'src' }),
      createMockToolMessage('tool-readFileTool', {
        relative_path: 'package.json',
      }),
      createMockToolMessage('tool-grepSearchTool', { query: 'dependencies' }),
    ],
  },
};

/**
 * Running - Absolute Path (without workspacePath)
 *
 * When agent uses absolute paths and no workspacePath is provided,
 * shows the full path (ugly).
 */
export const RunningAbsolutePathNoWorkspace: Story = {
  name: 'Running / Absolute Path (no workspace)',
  args: {
    status: 'running',
    workspacePath: null,
    history: [
      createMockToolMessage('tool-listFilesTool', {
        relative_path: '/Users/user/projects/my-app/src/components',
      }),
    ],
  },
};

/**
 * Running - Absolute Path (with workspacePath)
 *
 * When agent uses absolute paths but workspacePath is provided,
 * the path is relativized for display (nice!).
 * Shows "Listing files in src/components..." instead of the full path.
 */
export const RunningAbsolutePathWithWorkspace: Story = {
  name: 'Running / Absolute Path (with workspace)',
  args: {
    status: 'running',
    workspacePath: '/Users/user/projects/my-app',
    history: [
      createMockToolMessage('tool-listFilesTool', {
        relative_path: '/Users/user/projects/my-app/src/components',
      }),
    ],
  },
};

/**
 * Completed State
 *
 * When generation is complete, shows the file with action buttons.
 * - File icon and "PROJECT.md generated" text
 * - "Done" button to dismiss
 * - "Show file" button to navigate to agent settings
 */
export const Completed: Story = {
  args: {
    status: 'completed',
    history: [],
  },
};
