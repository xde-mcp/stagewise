import {
  type ResolveContext7LibraryToolInput,
  resolveContext7LibraryToolInputSchema,
} from '@shared/karton-contracts/ui/tools/types';
import type { AppRouter, TRPCClient } from '@stagewise/api-client';
import { tool } from 'ai';
import { rethrowCappedToolOutputError, capToolOutput } from '../../utils';

/* Due to an issue in zod schema conversion in the ai sdk,
   the schema descriptions are not properly used for the prompts -
   thus, we include them in the descriptions as well. */
export const DESCRIPTION = `Use this tool to start searching for library documentation. 
It will return a list of context7 library ids and titles that are relevant to the library name.
You can then use the getContext7LibraryDocs tool to get the documentation for a given context7 library id and topic.

Parameters:
- library (string, REQUIRED): Library name to resolve the context7 library id for.`;

export async function resolveContext7LibraryToolExecute(
  params: ResolveContext7LibraryToolInput,
  apiClient: TRPCClient<AppRouter>,
) {
  const { library } = params;

  try {
    const response = await apiClient.context7.search.query({ query: library });
    const results = response.results.map((r) => ({
      libraryId: r.id,
      title: r.title,
      description: r.description,
      trustScore: r.trustScore,
      versions: r.versions,
    }));

    const capped = capToolOutput(results);
    const message = capped.truncated
      ? `Successfully searched for documentation for library: ${library} (The result was truncated. Original size: ${capped.originalSize}, capped size: ${capped.cappedSize})`
      : `Successfully searched for documentation for library: ${library}`;
    return {
      message,
      library,
      results: capped.result,
      truncated: capped.truncated,
      itemsRemoved: capped.itemsRemoved,
    };
  } catch (error) {
    rethrowCappedToolOutputError(error);
  }
}

export const resolveContext7LibraryTool = (apiClient: TRPCClient<AppRouter>) =>
  tool({
    description: DESCRIPTION,
    inputSchema: resolveContext7LibraryToolInputSchema,
    execute: async (args) => {
      return resolveContext7LibraryToolExecute(args, apiClient);
    },
  });
