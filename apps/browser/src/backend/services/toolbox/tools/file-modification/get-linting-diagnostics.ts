import type { MountedLspServices } from '../../utils';
import {
  getLintingDiagnosticsToolInputSchema,
  type DiagnosticsSummary,
  type FileDiagnostics,
  type LintingDiagnostic,
} from '@shared/karton-contracts/ui/agent/tools/types';
import { tool } from 'ai';
import { rethrowCappedToolOutputError } from '../../utils';
import { resolveMountedLspService } from '../../utils/path-mounting';

const description = `MANDATORY: Get linting and type-checking diagnostics for files modified during this session.

YOU MUST call this tool after completing code changes to check for:
- TypeScript/JavaScript type errors (MUST be fixed)
- ESLint rule violations (SHOULD be fixed)
- Biome linting issues (SHOULD be fixed)
- Other LSP-reported problems

WORKFLOW:
1. Complete all code changes for the current task
2. Call this tool to check for issues
3. If errors/warnings found, fix them immediately
4. Only then ask the user for feedback

Never leave the codebase with unresolved errors caused by your changes.`;

type LintingDiagnosticsResult = {
  files: FileDiagnostics[];
  summary: DiagnosticsSummary;
};

export const getLintingDiagnosticsToolExecute = async (
  mountedLspServices: MountedLspServices,
  paths: string[],
) => {
  if (paths.length === 0) {
    return {
      files: [],
      summary: {
        totalFiles: 0,
        totalIssues: 0,
        errors: 0,
        warnings: 0,
        infos: 0,
        hints: 0,
      },
    };
  }

  // Touch all files in parallel so LSP servers open and analyze them,
  // then wait for diagnostics to arrive (3s timeout per file).
  await Promise.all(
    paths.map(async (mountedPath) => {
      try {
        const { lspService, relativePath } = resolveMountedLspService(
          mountedLspServices,
          mountedPath,
        );
        await lspService.touchFile(relativePath, true);
      } catch {
        // Silently skip -- we still attempt to collect diagnostics below
      }
    }),
  );

  const files: LintingDiagnosticsResult['files'] = [];

  let totalErrors = 0;
  let totalWarnings = 0;
  let totalInfos = 0;
  let totalHints = 0;

  for (const mountedPath of paths) {
    try {
      const { lspService, relativePath } = resolveMountedLspService(
        mountedLspServices,
        mountedPath,
      );

      const aggregatedDiagnostics =
        await lspService.getDiagnosticsForFile(relativePath);

      if (aggregatedDiagnostics.length === 0) continue;

      const fileDiagnostics: LintingDiagnostic[] = [];

      for (const { serverID, diagnostic } of aggregatedDiagnostics) {
        const severity = (diagnostic.severity ?? 1) as 1 | 2 | 3 | 4;
        fileDiagnostics.push({
          line: diagnostic.range.start.line + 1,
          column: diagnostic.range.start.character + 1,
          severity,
          source: diagnostic.source ?? serverID,
          message: diagnostic.message,
          code:
            diagnostic.code !== undefined ? String(diagnostic.code) : undefined,
        });

        if (severity === 1) totalErrors++;
        else if (severity === 2) totalWarnings++;
        else if (severity === 3) totalInfos++;
        else if (severity === 4) totalHints++;
      }

      if (fileDiagnostics.length > 0) {
        files.push({ path: mountedPath, diagnostics: fileDiagnostics });
      }
    } catch (error) {
      rethrowCappedToolOutputError(error);
    }
  }

  const totalIssues = totalErrors + totalWarnings + totalInfos + totalHints;

  if (totalIssues === 0) {
    return {
      message: 'No linting issues found in the specified files.',
      files: [],
      summary: {
        totalFiles: files.length,
        totalIssues,
        errors: totalErrors,
        warnings: totalWarnings,
        infos: totalInfos,
        hints: totalHints,
      },
    };
  }

  return {
    message: `Found ${totalIssues} linting issue${totalIssues !== 1 ? 's' : ''} in ${files.length} file${files.length !== 1 ? 's' : ''}.`,
    files,
    summary: {
      totalFiles: files.length,
      totalIssues,
      errors: totalErrors,
      warnings: totalWarnings,
      infos: totalInfos,
      hints: totalHints,
    },
  };
};

export const getLintingDiagnosticsTool = (
  mountedLspServices: MountedLspServices,
) =>
  tool({
    description,
    inputSchema: getLintingDiagnosticsToolInputSchema,
    execute: async ({ paths }) => {
      return getLintingDiagnosticsToolExecute(mountedLspServices, paths);
    },
  });
