import { input, confirm } from '@inquirer/prompts';

interface PromptOptions {
  message: string;
  hint?: string;
  placeholder?: string;
  default?: string | number | boolean;
}

export const promptNumber = async (options: PromptOptions): Promise<number> => {
  const { message, hint, default: defaultValue } = options;

  let promptMessage = message;
  if (hint) {
    promptMessage += ` (${hint})`;
  }

  const result = await input({
    message: promptMessage,
    default: defaultValue?.toString(),
  });

  const parsed = Number.parseInt(result, 10);

  if (Number.isNaN(parsed)) {
    throw new Error('Invalid number provided');
  }

  return parsed;
};

export const promptConfirm = async (
  options: PromptOptions,
): Promise<boolean> => {
  const { message, hint, default: defaultValue } = options;

  let promptMessage = message;
  if (hint) {
    promptMessage += ` (${hint})`;
  }

  return await confirm({
    message: promptMessage,
    default: defaultValue as boolean | undefined,
  });
};
