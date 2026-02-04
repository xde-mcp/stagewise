import { z } from 'zod';
import type { InferUITools } from 'ai';

/**
 * Tool Schema Definitions
 *
 * These schemas define the input and output types for agent tools.
 * They are kept separate from the tool implementations (execute functions)
 * so that both UI and backend can import the types.
 *
 * The backend (toolbox service) uses these schemas to construct tools with
 * actual execute functions. The UI uses the inferred types for rendering
 * tool calls and their outputs.
 */

export const overwriteFileToolInputSchema = z.object({
  relative_path: z
    .string()
    .describe('Relative file path to overwrite or create.'),
  content: z
    .string()
    .describe(
      'New content for the file. Leading/trailing markdown code block markers (```) are automatically removed.',
    ),
});

export const overwriteFileToolOutputSchema = z.object({
  message: z.string(),
});

export type OverwriteFileToolInput = z.infer<
  typeof overwriteFileToolInputSchema
>;
export type OverwriteFileToolOutput = z.infer<
  typeof overwriteFileToolOutputSchema
>;

/**
 * Schema definition for overwriteFileTool (without execute function)
 */
export const overwriteFileToolSchema = {
  inputSchema: overwriteFileToolInputSchema,
  outputSchema: overwriteFileToolOutputSchema,
} as const;

export const readFileToolInputSchema = z.object({
  relative_path: z
    .string()
    .describe('Relative path of file to read. File must exist.'),
  start_line: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe(
      'Starting line number (1-indexed, INCLUSIVE). Must be >= 1. Omit to read from beginning.',
    ),
  end_line: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe(
      'Ending line number (1-indexed, INCLUSIVE). Must be >= start_line. Omit to read to end.',
    ),
  explanation: z
    .string()
    .describe('One sentence explaining why this tool is being used.'),
});

export const readFileToolOutputSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  result: z.object({
    content: z.string().optional(),
    totalLines: z.number().optional(),
    linesRead: z.number(),
    truncated: z.boolean(),
    originalSize: z.number(),
    cappedSize: z.number(),
  }),
});

export type ReadFileToolInput = z.infer<typeof readFileToolInputSchema>;
export type ReadFileToolOutput = z.infer<typeof readFileToolOutputSchema>;

/**
 * Schema definition for readFileTool (without execute function)
 */
export const readFileToolSchema = {
  inputSchema: readFileToolInputSchema,
  outputSchema: readFileToolOutputSchema,
} as const;

export const listFilesToolInputSchema = z.object({
  relative_path: z
    .string()
    .optional()
    .describe("Path to list. Defaults to current directory ('.')."),
  recursive: z
    .boolean()
    .optional()
    .describe('Whether to list recursively. Defaults to false.'),
  maxDepth: z
    .number()
    .min(0)
    .optional()
    .describe(
      'Maximum recursion depth (must be >= 0). Defaults to unlimited. Depth is 0-indexed from starting directory.',
    ),
  pattern: z
    .string()
    .optional()
    .describe(
      "File extension or glob pattern to filter results. Examples: '.ts', '*.js'.",
    ),
  includeDirectories: z
    .boolean()
    .optional()
    .describe('Include directories in results. Defaults to true.'),
  includeFiles: z
    .boolean()
    .optional()
    .describe('Include files in results. Defaults to true.'),
});

export const listFilesToolOutputSchema = z.object({
  message: z.string(),
  result: z.object({
    files: z.array(z.any()),
    totalFiles: z.number().optional(),
    totalDirectories: z.number().optional(),
    truncated: z.boolean(),
    itemsRemoved: z.number().optional(),
  }),
});

export type ListFilesToolInput = z.infer<typeof listFilesToolInputSchema>;
export type ListFilesToolOutput = z.infer<typeof listFilesToolOutputSchema>;

export const listFilesToolSchema = {
  inputSchema: listFilesToolInputSchema,
  outputSchema: listFilesToolOutputSchema,
} as const;

export const grepSearchToolInputSchema = z.object({
  query: z
    .string()
    .describe(
      'Regex pattern using ripgrep syntax (similar to PCRE). Search for exact code strings or patterns.',
    ),
  case_sensitive: z
    .boolean()
    .optional()
    .describe(
      'Whether search is case sensitive. Defaults to false (case insensitive).',
    ),
  include_file_pattern: z
    .string()
    .optional()
    .describe(
      'Glob pattern for files to include. Examples: "*.ts", "**/*.tsx", "src/**/*.js".',
    ),
  exclude_file_pattern: z
    .string()
    .optional()
    .describe(
      'Glob pattern for files to exclude. Examples: "**/test-*.js", "metadata/**".',
    ),
  max_matches: z
    .number()
    .optional()
    .describe(
      'Maximum matches to return. Defaults to 15, maximum allowed is 50.',
    ),
  explanation: z
    .string()
    .describe('One sentence explaining why this tool is being used.'),
});

export const grepSearchToolOutputSchema = z.object({
  message: z.string(),
  result: z.object({
    totalMatches: z.number().optional(),
    filesSearched: z.number().optional(),
    matches: z.array(z.any()),
    truncated: z.boolean(),
    itemsRemoved: z.number().optional(),
  }),
});

export type GrepSearchToolInput = z.infer<typeof grepSearchToolInputSchema>;
export type GrepSearchToolOutput = z.infer<typeof grepSearchToolOutputSchema>;

export const grepSearchToolSchema = {
  inputSchema: grepSearchToolInputSchema,
  outputSchema: grepSearchToolOutputSchema,
} as const;

export const globToolInputSchema = z.object({
  pattern: z
    .string()
    .describe(
      "Glob pattern supporting standard syntax (*, **, ?, [abc]). Examples: '**/*.test.ts' for test files, 'src/**/config.json' for configs.",
    ),
});

export const globToolOutputSchema = z.object({
  message: z.string(),
  result: z.object({
    totalMatches: z.number().optional(),
    relativePaths: z.array(z.string()),
    truncated: z.boolean(),
    itemsRemoved: z.number().optional(),
  }),
});

export type GlobToolInput = z.infer<typeof globToolInputSchema>;
export type GlobToolOutput = z.infer<typeof globToolOutputSchema>;

export const globToolSchema = {
  inputSchema: globToolInputSchema,
  outputSchema: globToolOutputSchema,
} as const;

const editSchema = z.object({
  old_string: z.string().describe('Text to find and replace.'),
  new_string: z.string().describe('Text to replace it with.'),
  replace_all: z
    .boolean()
    .optional()
    .describe(
      'If true, replaces all occurrences. If false (default), replaces only FIRST occurrence in current content.',
    ),
});

export const multiEditToolInputSchema = z.object({
  relative_path: z
    .string()
    .describe('Relative file path to edit. File must exist.'),
  edits: z
    .array(editSchema)
    .min(1)
    .describe('Array of edit objects (minimum 1 edit).'),
});

export const multiEditToolOutputSchema = z.object({
  message: z.string(),
  result: z.object({
    editsApplied: z.number(),
  }),
});

export type MultiEditToolInput = z.infer<typeof multiEditToolInputSchema>;
export type MultiEditToolOutput = z.infer<typeof multiEditToolOutputSchema>;

export const multiEditToolSchema = {
  inputSchema: multiEditToolInputSchema,
  outputSchema: multiEditToolOutputSchema,
} as const;

export const deleteFileToolInputSchema = z.object({
  relative_path: z
    .string()
    .describe('Relative file path to delete. Must be an existing file.'),
});

export const deleteFileToolOutputSchema = z.object({
  message: z.string(),
});

export type DeleteFileToolInput = z.infer<typeof deleteFileToolInputSchema>;
export type DeleteFileToolOutput = z.infer<typeof deleteFileToolOutputSchema>;

export const deleteFileToolSchema = {
  inputSchema: deleteFileToolInputSchema,
  outputSchema: deleteFileToolOutputSchema,
} as const;

export const getLintingDiagnosticsToolInputSchema = z.object({
  explanation: z
    .string()
    .optional()
    .describe('One sentence explaining why you are checking diagnostics.'),
});

export const lintingDiagnosticSchema = z.object({
  line: z.number(),
  column: z.number(),
  severity: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  source: z.string(),
  message: z.string(),
  code: z.string().optional(),
});

export const fileDiagnosticsSchema = z.object({
  path: z.string(),
  diagnostics: z.array(lintingDiagnosticSchema),
});

export const diagnosticsSummarySchema = z.object({
  totalFiles: z.number(),
  totalIssues: z.number(),
  errors: z.number(),
  warnings: z.number(),
  infos: z.number(),
  hints: z.number(),
});

export const getLintingDiagnosticsToolOutputSchema = z.object({
  message: z.string(),
  files: z.array(fileDiagnosticsSchema),
  summary: diagnosticsSummarySchema,
});

export type LintingDiagnostic = z.infer<typeof lintingDiagnosticSchema>;
export type FileDiagnostics = z.infer<typeof fileDiagnosticsSchema>;
export type DiagnosticsSummary = z.infer<typeof diagnosticsSummarySchema>;
export type GetLintingDiagnosticsToolInput = z.infer<
  typeof getLintingDiagnosticsToolInputSchema
>;
export type GetLintingDiagnosticsToolOutput = z.infer<
  typeof getLintingDiagnosticsToolOutputSchema
>;

export const getLintingDiagnosticsToolSchema = {
  inputSchema: getLintingDiagnosticsToolInputSchema,
  outputSchema: getLintingDiagnosticsToolOutputSchema,
} as const;

export const updateStagewiseMdToolInputSchema = z.object({
  reason: z
    .string()
    .min(5)
    .max(50)
    .describe(
      'Brief reason for triggering the stagewise.md update (5-50 characters).',
    ),
});

export const updateStagewiseMdToolOutputSchema = z.object({
  message: z.string(),
  reason: z.string(),
});

export type UpdateStagewiseMdToolInput = z.infer<
  typeof updateStagewiseMdToolInputSchema
>;
export type UpdateStagewiseMdToolOutput = z.infer<
  typeof updateStagewiseMdToolOutputSchema
>;

export const updateStagewiseMdToolSchema = {
  inputSchema: updateStagewiseMdToolInputSchema,
  outputSchema: updateStagewiseMdToolOutputSchema,
} as const;

export const executeConsoleScriptToolInputSchema = z.object({
  id: z.string().describe('The tab ID to execute the script on'),
  script: z.string().describe('Synchronous JavaScript code to execute'),
});

export const executeConsoleScriptToolOutputSchema = z.object({
  message: z.string(),
  result: z.any(),
});

export type ExecuteConsoleScriptToolInput = z.infer<
  typeof executeConsoleScriptToolInputSchema
>;
export type ExecuteConsoleScriptToolOutput = z.infer<
  typeof executeConsoleScriptToolOutputSchema
>;

export const executeConsoleScriptToolSchema = {
  inputSchema: executeConsoleScriptToolInputSchema,
  outputSchema: executeConsoleScriptToolOutputSchema,
} as const;

export const consoleLogLevelSchema = z.enum([
  'log',
  'debug',
  'info',
  'error',
  'warning',
  'dir',
  'dirxml',
  'table',
  'trace',
  'clear',
  'startGroup',
  'startGroupCollapsed',
  'endGroup',
  'assert',
  'profile',
  'profileEnd',
  'count',
  'timeEnd',
]);

export type ConsoleLogLevel = z.infer<typeof consoleLogLevelSchema>;

export const readConsoleLogsToolInputSchema = z.object({
  id: z.string().describe('The tab ID to read console logs from'),
  filter: z
    .string()
    .optional()
    .describe('Case-insensitive substring to filter logs by'),
  limit: z
    .number()
    .int()
    .positive()
    .max(500)
    .optional()
    .describe('Maximum number of logs to return (most recent first)'),
  levels: z
    .array(consoleLogLevelSchema)
    .optional()
    .describe('Filter by specific log levels'),
  delayMs: z
    .number()
    .int()
    .min(0)
    .max(5000)
    .optional()
    .describe(
      'Milliseconds to wait BEFORE reading logs. Use after injecting monitoring code to capture async/animation logs.',
    ),
});

export const readConsoleLogsToolOutputSchema = z.object({
  message: z.string(),
  result: z.any(),
});

export type ReadConsoleLogsToolInput = z.infer<
  typeof readConsoleLogsToolInputSchema
>;
export type ReadConsoleLogsToolOutput = z.infer<
  typeof readConsoleLogsToolOutputSchema
>;

export const readConsoleLogsToolSchema = {
  inputSchema: readConsoleLogsToolInputSchema,
  outputSchema: readConsoleLogsToolOutputSchema,
} as const;

export const getContext7LibraryDocsToolInputSchema = z.object({
  libraryId: z
    .string()
    .describe('Context7 library id to get the documentation for.'),
  topic: z.string().describe('Topic to get the documentation for.'),
  mode: z
    .enum(['code', 'info'])
    .describe('Mode to get the documentation for.')
    .default('code'),
  page: z.number().describe('Page to get the documentation for.').default(1),
});

export const getContext7LibraryDocsToolOutputSchema = z.object({
  message: z.string(),
  content: z.string(),
  truncated: z.boolean(),
});

export type GetContext7LibraryDocsToolInput = z.infer<
  typeof getContext7LibraryDocsToolInputSchema
>;
export type GetContext7LibraryDocsToolOutput = z.infer<
  typeof getContext7LibraryDocsToolOutputSchema
>;

export const getContext7LibraryDocsToolSchema = {
  inputSchema: getContext7LibraryDocsToolInputSchema,
  outputSchema: getContext7LibraryDocsToolOutputSchema,
} as const;

export const resolveContext7LibraryToolInputSchema = z.object({
  library: z
    .string()
    .describe('Library name to resolve the context7 library id for.'),
});

export const resolveContext7LibraryToolOutputSchema = z.object({
  message: z.string(),
  library: z.string(),
  results: z.array(
    z.object({
      libraryId: z.string(),
      title: z.string(),
      description: z.string().optional(),
      trustScore: z.number().optional(),
      versions: z.array(z.string()).optional(),
    }),
  ),
  truncated: z.boolean(),
  itemsRemoved: z.number().optional(),
});

export type ResolveContext7LibraryToolInput = z.infer<
  typeof resolveContext7LibraryToolInputSchema
>;
export type ResolveContext7LibraryToolOutput = z.infer<
  typeof resolveContext7LibraryToolOutputSchema
>;

export const resolveContext7LibraryToolSchema = {
  inputSchema: resolveContext7LibraryToolInputSchema,
  outputSchema: resolveContext7LibraryToolOutputSchema,
} as const;

/**
 * Combined schema definitions for all tools.
 * Used with InferUITools to derive TypeScript types.
 */
export const allToolSchemas = {
  overwriteFileTool: overwriteFileToolSchema,
  readFileTool: readFileToolSchema,
  listFilesTool: listFilesToolSchema,
  grepSearchTool: grepSearchToolSchema,
  globTool: globToolSchema,
  multiEditTool: multiEditToolSchema,
  deleteFileTool: deleteFileToolSchema,
  getLintingDiagnosticsTool: getLintingDiagnosticsToolSchema,
  updateStagewiseMdTool: updateStagewiseMdToolSchema,
  executeConsoleScriptTool: executeConsoleScriptToolSchema,
  readConsoleLogsTool: readConsoleLogsToolSchema,
  getContext7LibraryDocsTool: getContext7LibraryDocsToolSchema,
  resolveContext7LibraryTool: resolveContext7LibraryToolSchema,
} as const;

/**
 * Inferred UI types for all tools.
 * Use this type for type-safe tool rendering in the UI.
 */
export type UITools = InferUITools<typeof allToolSchemas>;

/**
 * Type helper for individual tool parts
 */
export type ToolName = keyof UITools;
