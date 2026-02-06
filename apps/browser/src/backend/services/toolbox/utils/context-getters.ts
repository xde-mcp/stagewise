import type { LspService } from '@/services/workspace/services/lsp';
import type { AggregatedDiagnostic } from '@/services/workspace/services/lsp/types';

/**
 * Collects current LSP diagnostics for a set of modified files.
 *
 * Iterates through the given file paths and queries the LSP service for
 * diagnostics on each one. Files with no diagnostics are omitted from
 * the result.
 *
 * @param lspService - The LSP service to query for diagnostics
 * @param modifiedFiles - Set of absolute file paths to collect diagnostics for
 * @returns Map of file paths to their aggregated diagnostics
 */
export async function collectDiagnosticsForFiles(
  lspService: LspService,
  modifiedFiles: Set<string>,
): Promise<Map<string, AggregatedDiagnostic[]>> {
  const result = new Map<string, AggregatedDiagnostic[]>();

  for (const filePath of modifiedFiles) {
    try {
      const diagnostics = await lspService.getDiagnosticsForFile(filePath);
      if (diagnostics.length > 0) result.set(filePath, diagnostics);
    } catch {
      // Silently skip files where diagnostics collection fails
      // (e.g. file was deleted, LSP server not ready, etc.)
    }
  }

  return result;
}
