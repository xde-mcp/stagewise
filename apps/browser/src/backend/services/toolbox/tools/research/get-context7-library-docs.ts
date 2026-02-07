import {
  type GetContext7LibraryDocsToolInput,
  getContext7LibraryDocsToolInputSchema,
} from '@shared/karton-contracts/ui/agent/tools/types';
import type { AppRouter, TRPCClient } from '@stagewise/api-client';
import { tool } from 'ai';
import { rethrowCappedToolOutputError, capToolOutput } from '../../utils';

/* Due to an issue in zod schema conversion in the ai sdk,
   the schema descriptions are not properly used for the prompts -
   thus, we include them in the descriptions as well. */
export const DESCRIPTION = `Get up to date documentation for a given context7 library id and topic. 

Parameters:
- libraryId (string, REQUIRED): Context7 library id to get the documentation for.
- topic (string, REQUIRED): Topic to get the documentation for.
- mode (enum, OPTIONAL): Mode to get the documentation for. Defaults to 'code'.
- page (number, OPTIONAL): Page to get the documentation for. Defaults to 1.`;

export async function getContext7LibraryDocsToolExecute(
  params: GetContext7LibraryDocsToolInput,
  apiClient: TRPCClient<AppRouter>,
) {
  const { libraryId, topic, mode, page } = params;

  try {
    const response = (await apiClient.context7.docs.query({
      libraryId,
      topic,
      mode,
      page,
      type: 'txt',
    })) as string;

    const cappedResponse = capToolOutput(response);

    const message = cappedResponse.truncated
      ? `Successfully searched for documentation for library: ${libraryId} (The result was truncated. Original size: ${cappedResponse.originalSize}, capped size: ${cappedResponse.cappedSize})`
      : `Successfully searched for documentation for library: ${libraryId}`;
    return {
      message,
      content: cappedResponse.result,
      truncated: cappedResponse.truncated,
    };
  } catch (error) {
    rethrowCappedToolOutputError(error);
  }
}

export const getContext7LibraryDocsTool = (apiClient: TRPCClient<AppRouter>) =>
  tool({
    description: DESCRIPTION,
    inputSchema: getContext7LibraryDocsToolInputSchema,
    execute: async (args) => {
      return getContext7LibraryDocsToolExecute(args, apiClient);
    },
  });
