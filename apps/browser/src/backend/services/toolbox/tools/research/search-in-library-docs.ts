import {
  type SearchInLibraryDocsToolInput,
  searchInLibraryDocsToolInputSchema,
} from '@shared/karton-contracts/ui/agent/tools/types';
import type { AppRouter, TRPCClient } from '@stagewise/api-client';
import { tool } from 'ai';
import { rethrowCappedToolOutputError, capToolOutput } from '../../utils';

/* Due to an issue in zod schema conversion in the ai sdk,
   the schema descriptions are not properly used for the prompts -
   thus, we include them in the descriptions as well. */
export const DESCRIPTION = `Get up to date documentation for a given library id and topic. 

Parameters:
- packageId (string, REQUIRED): Package ID for which docs should be searched
- topic (string, REQUIRED): Topic to search for in the docs
- mode (enum, OPTIONAL): Mode to get the documentation for. Defaults to 'code'.
- page (number, OPTIONAL): Page to get the documentation for. Defaults to 1.`;

export async function searchInLibraryDocsToolExecute(
  params: SearchInLibraryDocsToolInput,
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

export const searchInLibraryDocsTool = (apiClient: TRPCClient<AppRouter>) =>
  tool({
    description: DESCRIPTION,
    inputSchema: searchInLibraryDocsToolInputSchema,
    execute: async (args) => {
      return searchInLibraryDocsToolExecute(args, apiClient);
    },
  });
