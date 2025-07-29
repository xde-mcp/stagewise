import * as vscode from 'vscode';
import { dirname, resolve, join, relative, extname } from 'node:path';
import { minimatch } from 'minimatch';
import ignore from 'ignore';
import {
  BaseFileSystemProvider,
  type ClientRuntime,
  type GrepMatch,
  type GrepResult,
  type GlobResult,
  type SearchReplaceMatch,
  type SearchReplaceResult,
} from '@stagewise/agent-runtime-interface';

/**
 * VSCode implementation of the file system provider
 * Uses VSCode's workspace API for file operations and Node.js for path operations
 *
 * IMPORTANT: All path parameters are expected to be relative paths.
 * The resolvePath method converts them to absolute paths using the working directory.
 */
export class VSCodeFileSystemProvider extends BaseFileSystemProvider {
  private gitignore: ReturnType<typeof ignore> | null = null;
  private gitignorePatterns: string[] = [];
  private gitignoreInitialized = false;
  getCurrentWorkingDirectory(): string {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
  }

  private async readFileContent(uri: vscode.Uri): Promise<string> {
    const bytes = await vscode.workspace.fs.readFile(uri);
    const decoder = new TextDecoder();
    return decoder.decode(bytes);
  }

  private async writeFileContent(
    uri: vscode.Uri,
    content: string,
  ): Promise<void> {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(content);
    await vscode.workspace.fs.writeFile(uri, bytes);
  }

  async readFile(
    path: string,
    options?: { startLine?: number; endLine?: number },
  ) {
    try {
      const uri = vscode.Uri.file(this.resolvePath(path));
      const content = await this.readFileContent(uri);
      const lines = content.split('\n');
      const totalLines = lines.length;

      if (options?.startLine !== undefined) {
        if (options.startLine > totalLines) {
          return {
            success: false,
            message: `startLine ${options.startLine} exceeds file length (${totalLines} lines)`,
            error: 'LINE_OUT_OF_RANGE',
          };
        }

        const effectiveEndLine = options.endLine ?? totalLines;
        if (effectiveEndLine > totalLines) {
          return {
            success: false,
            message: `endLine ${effectiveEndLine} exceeds file length (${totalLines} lines)`,
            error: 'LINE_OUT_OF_RANGE',
          };
        }

        const selectedLines = lines.slice(
          options.startLine - 1,
          effectiveEndLine,
        );
        return {
          success: true,
          message: `Successfully read lines ${options.startLine}-${effectiveEndLine}`,
          content: selectedLines.join('\n'),
          totalLines,
        };
      }

      return {
        success: true,
        message: 'Successfully read file',
        content,
        totalLines,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to read file: ${path}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async writeFile(path: string, content: string) {
    try {
      const uri = vscode.Uri.file(this.resolvePath(path));

      // Create directory if it doesn't exist
      await this.createDirectory(dirname(uri.fsPath));
      await this.writeFileContent(uri, content);

      return {
        success: true,
        message: `Successfully wrote file: ${path}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to write file: ${path}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async editFile(
    path: string,
    content: string,
    startLine: number,
    endLine: number,
  ) {
    try {
      const uri = vscode.Uri.file(this.resolvePath(path));
      const fileContent = await this.readFileContent(uri);
      const lines = fileContent.split('\n');

      if (startLine > lines.length || endLine > lines.length) {
        return {
          success: false,
          message: `Line range ${startLine}-${endLine} exceeds file length (${lines.length} lines)`,
          error: 'LINE_OUT_OF_RANGE',
        };
      }

      if (startLine < 1 || endLine < startLine) {
        return {
          success: false,
          message: `Invalid line range ${startLine}-${endLine}`,
          error: 'INVALID_RANGE',
        };
      }

      const beforeLines = lines.slice(0, startLine - 1);
      const afterLines = lines.slice(endLine);
      const contentLines = content.split('\n');
      const newLines = [...beforeLines, ...contentLines, ...afterLines];
      await this.writeFileContent(uri, newLines.join('\n'));

      return {
        success: true,
        message: `Successfully edited lines ${startLine}-${endLine}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to edit file: ${path}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async createDirectory(path: string) {
    try {
      const uri = vscode.Uri.file(this.resolvePath(path));
      await vscode.workspace.fs.createDirectory(uri);
      return {
        success: true,
        message: `Successfully created directory: ${path}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create directory: ${path}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async listDirectory(
    path: string,
    options?: {
      recursive?: boolean;
      maxDepth?: number;
      pattern?: string;
      includeDirectories?: boolean;
      includeFiles?: boolean;
      respectGitignore?: boolean;
    },
  ) {
    try {
      const uri = vscode.Uri.file(this.resolvePath(path));
      const files: Array<{
        path: string;
        name: string;
        type: 'file' | 'directory';
        size?: number;
        depth: number;
      }> = [];
      let totalFiles = 0;
      let totalDirectories = 0;

      const listRecursive = async (dirUri: vscode.Uri, depth: number) => {
        if (options?.maxDepth !== undefined && depth > options.maxDepth) {
          return;
        }

        const entries = await vscode.workspace.fs.readDirectory(dirUri);

        for (const [name, type] of entries) {
          const fullPath = join(dirUri.fsPath, name);
          const relativePath = relative(uri.fsPath, fullPath);
          // For gitignore, paths must be relative to the repository root
          const gitignoreRelativePath = relative(
            this.config.workingDirectory,
            fullPath,
          );

          // Apply pattern filter if specified
          if (options?.pattern && !minimatch(relativePath, options.pattern)) {
            continue;
          }

          // Check gitignore if enabled (default true)
          if (options?.respectGitignore !== false) {
            await this.ensureGitignoreInitialized();
            if (this.gitignore?.ignores(gitignoreRelativePath)) {
              continue;
            }
          }

          if (type === vscode.FileType.Directory) {
            totalDirectories++;
            if (options?.includeDirectories !== false) {
              files.push({
                path: relative(this.config.workingDirectory, fullPath),
                name,
                type: 'directory' as const,
                depth,
              });
            }
            if (options?.recursive) {
              await listRecursive(vscode.Uri.file(fullPath), depth + 1);
            }
          } else if (type === vscode.FileType.File) {
            totalFiles++;
            if (options?.includeFiles !== false) {
              const stat = await vscode.workspace.fs.stat(
                vscode.Uri.file(fullPath),
              );
              files.push({
                path: relative(this.config.workingDirectory, fullPath),
                name,
                type: 'file' as const,
                size: stat.size,
                depth,
              });
            }
          }
        }
      };

      await listRecursive(uri, 0);

      return {
        success: true,
        message: `Successfully listed directory: ${path}`,
        files,
        totalFiles,
        totalDirectories,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to list directory: ${path}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async grep(
    path: string,
    pattern: string,
    options?: {
      recursive?: boolean;
      maxDepth?: number;
      filePattern?: string;
      caseSensitive?: boolean;
      maxMatches?: number;
      excludePatterns?: string[];
      respectGitignore?: boolean;
    },
  ): Promise<GrepResult> {
    try {
      const regex = new RegExp(pattern, options?.caseSensitive ? 'g' : 'gi');
      const matches: GrepMatch[] = [];
      let filesSearched = 0;
      const basePath = this.resolvePath(path);

      const searchFile = async (filePath: string) => {
        if (options?.maxMatches && matches.length >= options.maxMatches) {
          return;
        }

        try {
          const content = await this.readFileContent(vscode.Uri.file(filePath));
          const lines = content.split('\n');
          filesSearched++;

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue;
            let match: RegExpExecArray | null = null;
            regex.lastIndex = 0; // Reset regex state

            while (true) {
              match = regex.exec(line);
              if (!match) break;
              if (options?.maxMatches && matches.length >= options.maxMatches) {
                return;
              }

              const MAX_PREVIEW_LENGTH = 200; // Limit preview to 200 characters
              let preview = line?.trim() || '';
              if (preview.length > MAX_PREVIEW_LENGTH) {
                // Truncate long previews and add ellipsis
                preview = `${preview.substring(0, MAX_PREVIEW_LENGTH - 3)}...`;
              }

              matches.push({
                path: relative(this.config.workingDirectory, filePath),
                line: i + 1,
                column: match.index + 1,
                match: match[0],
                preview,
              });
            }
          }
        } catch (_error) {
          // Skip files that can't be read (binary files, etc.)
        }
      };

      const searchDirectory = async (dirPath: string, depth: number) => {
        if (options?.maxDepth !== undefined && depth > options.maxDepth) {
          return;
        }

        const entries = await vscode.workspace.fs.readDirectory(
          vscode.Uri.file(dirPath),
        );

        for (const [name, type] of entries) {
          const fullPath = join(dirPath, name);
          const relativePath = relative(basePath, fullPath);
          // For gitignore, paths must be relative to the repository root
          const gitignoreRelativePath = relative(
            this.config.workingDirectory,
            fullPath,
          );

          // Check exclude patterns
          if (
            options?.excludePatterns?.some((p) => minimatch(relativePath, p))
          ) {
            continue;
          }

          // Check gitignore if enabled (default true)
          if (options?.respectGitignore !== false) {
            await this.ensureGitignoreInitialized();
            if (this.gitignore?.ignores(gitignoreRelativePath)) {
              continue;
            }
          }

          if (type === vscode.FileType.File) {
            // Check file pattern
            if (options?.filePattern && !minimatch(name, options.filePattern)) {
              continue;
            }
            await searchFile(fullPath);
          } else if (type === vscode.FileType.Directory && options?.recursive) {
            await searchDirectory(fullPath, depth + 1);
          }
        }
      };

      if (await this.isDirectory(path)) {
        await searchDirectory(basePath, 0);
      } else {
        await searchFile(basePath);
      }

      return {
        success: true,
        message: `Found ${matches.length} matches in ${filesSearched} files`,
        matches,
        totalMatches: matches.length,
        filesSearched,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to search: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async glob(
    pattern: string,
    options?: {
      cwd?: string;
      absolute?: boolean;
      includeDirectories?: boolean;
      excludePatterns?: string[];
      respectGitignore?: boolean;
    },
  ): Promise<GlobResult> {
    try {
      const paths: string[] = [];
      const basePath = options?.cwd
        ? this.resolvePath(options.cwd)
        : this.config.workingDirectory;

      const searchDirectory = async (dirPath: string) => {
        const entries = await vscode.workspace.fs.readDirectory(
          vscode.Uri.file(dirPath),
        );

        for (const [name, type] of entries) {
          const fullPath = join(dirPath, name);
          const relativePath = relative(basePath, fullPath);
          // For gitignore, paths must be relative to the repository root
          const gitignoreRelativePath = relative(
            this.config.workingDirectory,
            fullPath,
          );

          // Check exclude patterns
          if (
            options?.excludePatterns?.some((p) => minimatch(relativePath, p))
          ) {
            continue;
          }

          // Check gitignore if enabled (default true)
          if (options?.respectGitignore !== false) {
            await this.ensureGitignoreInitialized();
            if (this.gitignore?.ignores(gitignoreRelativePath)) {
              continue;
            }
          }

          // Check if path matches the glob pattern
          if (minimatch(relativePath, pattern)) {
            if (
              type === vscode.FileType.File ||
              (type === vscode.FileType.Directory &&
                options?.includeDirectories)
            ) {
              paths.push(options?.absolute ? fullPath : relativePath);
            }
          }

          // Continue searching in subdirectories if pattern might match deeper
          if (type === vscode.FileType.Directory && pattern.includes('**')) {
            await searchDirectory(fullPath);
          }
        }
      };

      await searchDirectory(basePath);

      return {
        success: true,
        message: `Found ${paths.length} matching paths`,
        paths,
        totalMatches: paths.length,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to glob: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async searchAndReplace(
    filePath: string,
    searchString: string,
    replaceString: string,
    options?: {
      caseSensitive?: boolean;
      wholeWord?: boolean;
      regex?: boolean;
      preserveCase?: boolean;
      maxReplacements?: number;
      dryRun?: boolean;
    },
  ): Promise<SearchReplaceResult> {
    try {
      const uri = vscode.Uri.file(this.resolvePath(filePath));
      const content = await this.readFileContent(uri);
      const lines = content.split('\n');
      const replacements: SearchReplaceMatch[] = [];
      let totalReplacements = 0;
      const newLines: string[] = [];

      // Build the search pattern
      let searchPattern: RegExp;
      if (options?.regex) {
        searchPattern = new RegExp(
          searchString,
          options?.caseSensitive ? 'g' : 'gi',
        );
      } else {
        let pattern = searchString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape regex chars
        if (options?.wholeWord) {
          pattern = `\\b${pattern}\\b`;
        }
        searchPattern = new RegExp(
          pattern,
          options?.caseSensitive !== false ? 'g' : 'gi',
        );
      }

      // Process each line
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line === undefined) {
          newLines.push('');
          continue;
        }
        let modifiedLine = line;
        // biome-ignore lint/correctness/noUnusedVariables: It is actually used
        let lineReplacements = 0;

        // Find all matches in the current line
        let match: RegExpExecArray | null = null;
        const lineMatches: Array<{
          index: number;
          length: number;
          text: string;
        }> = [];
        searchPattern.lastIndex = 0; // Reset regex state

        while (true) {
          match = searchPattern.exec(line);
          if (!match) break;
          lineMatches.push({
            index: match.index,
            length: match[0].length,
            text: match[0],
          });

          if (
            options?.maxReplacements &&
            totalReplacements + lineMatches.length >= options.maxReplacements
          ) {
            break;
          }
        }

        // Process matches in reverse order to maintain indices
        for (let j = lineMatches.length - 1; j >= 0; j--) {
          const matchInfo = lineMatches[j];
          if (!matchInfo) continue;

          let replacement = replaceString;

          // Handle case preservation if requested
          if (options?.preserveCase && !options?.regex) {
            replacement = this.preserveCase(matchInfo.text, replacement);
          }

          // Record the replacement
          replacements.push({
            line: i + 1,
            column: matchInfo.index + 1,
            oldText: matchInfo.text,
            newText: replacement,
            lineContent: line.trim(),
          });

          // Apply the replacement
          modifiedLine =
            modifiedLine.substring(0, matchInfo.index) +
            replacement +
            modifiedLine.substring(matchInfo.index + matchInfo.length);

          lineReplacements++;
          totalReplacements++;

          if (
            options?.maxReplacements &&
            totalReplacements >= options.maxReplacements
          ) {
            break;
          }
        }

        newLines.push(modifiedLine);

        if (
          options?.maxReplacements &&
          totalReplacements >= options.maxReplacements
        ) {
          // Add remaining lines unchanged
          newLines.push(...lines.slice(i + 1));
          break;
        }
      }

      // Write the file if not a dry run and there were replacements
      const fileModified = totalReplacements > 0 && !options?.dryRun;
      if (fileModified) {
        await this.writeFileContent(uri, newLines.join('\n'));
      }

      return {
        success: true,
        message: options?.dryRun
          ? `Found ${totalReplacements} occurrences (dry run - no changes made)`
          : `Replaced ${totalReplacements} occurrences`,
        replacements,
        totalReplacements,
        fileModified,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to search and replace: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private preserveCase(original: string, replacement: string): string {
    if (!original || !replacement) {
      return replacement || '';
    }

    // If original is all uppercase, make replacement uppercase
    if (original === original.toUpperCase()) {
      return replacement.toUpperCase();
    }

    // If original is all lowercase, make replacement lowercase
    if (original === original.toLowerCase()) {
      return replacement.toLowerCase();
    }

    // If original starts with uppercase, capitalize replacement
    const firstChar = original.charAt(0);
    if (firstChar && firstChar === firstChar.toUpperCase()) {
      return (
        replacement.charAt(0).toUpperCase() + replacement.slice(1).toLowerCase()
      );
    }

    // Otherwise, return replacement as-is
    return replacement;
  }

  async deleteFile(path: string) {
    try {
      const uri = vscode.Uri.file(this.resolvePath(path));
      await vscode.workspace.fs.delete(uri, { recursive: false });
      return {
        success: true,
        message: `Successfully deleted file: ${path}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete file: ${path}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async copyFile(source: string, destination: string) {
    try {
      const sourceUri = vscode.Uri.file(this.resolvePath(source));
      const destUri = vscode.Uri.file(this.resolvePath(destination));

      // Create destination directory if needed
      await this.createDirectory(dirname(destUri.fsPath));
      await vscode.workspace.fs.copy(sourceUri, destUri, { overwrite: true });

      return {
        success: true,
        message: `Successfully copied ${source} to ${destination}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to copy file`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async moveFile(source: string, destination: string) {
    try {
      const sourceUri = vscode.Uri.file(this.resolvePath(source));
      const destUri = vscode.Uri.file(this.resolvePath(destination));

      // Create destination directory if needed
      await this.createDirectory(dirname(destUri.fsPath));
      await vscode.workspace.fs.rename(sourceUri, destUri, { overwrite: true });

      return {
        success: true,
        message: `Successfully moved ${source} to ${destination}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to move file`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async fileExists(path: string) {
    try {
      const uri = vscode.Uri.file(this.resolvePath(path));
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }

  async isDirectory(path: string) {
    try {
      const uri = vscode.Uri.file(this.resolvePath(path));
      const stat = await vscode.workspace.fs.stat(uri);
      return (
        (stat.type & vscode.FileType.Directory) === vscode.FileType.Directory
      );
    } catch {
      return false;
    }
  }

  async getFileStats(path: string) {
    const uri = vscode.Uri.file(this.resolvePath(path));
    const stat = await vscode.workspace.fs.stat(uri);
    return {
      size: stat.size,
      modifiedTime: stat.mtime ? new Date(stat.mtime) : undefined,
    };
  }

  // Path operations using Node.js path module
  resolvePath(path: string): string {
    // If path is already absolute, return it as-is
    if (resolve(path) === path) {
      return path;
    }
    // Otherwise resolve it relative to the working directory
    return resolve(this.config.workingDirectory, path);
  }

  getDirectoryName(path: string): string {
    return dirname(path);
  }

  joinPaths(...paths: string[]): string {
    return join(...paths);
  }

  getRelativePath(from: string, to: string): string {
    return relative(from, to);
  }

  getFileExtension(path: string): string {
    return extname(path);
  }

  async getGitignorePatterns(): Promise<string[]> {
    await this.ensureGitignoreInitialized();
    return this.gitignorePatterns;
  }

  async isIgnored(path: string): Promise<boolean> {
    await this.ensureGitignoreInitialized();
    return this.gitignore ? this.gitignore.ignores(path) : false;
  }

  private async ensureGitignoreInitialized(): Promise<void> {
    if (this.gitignoreInitialized) {
      return;
    }

    this.gitignoreInitialized = true;

    try {
      // Read .gitignore file from workspace root
      const gitignorePath = join(this.config.workingDirectory, '.gitignore');
      const gitignoreUri = vscode.Uri.file(gitignorePath);

      const content = await this.readFileContent(gitignoreUri);
      const patterns = content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));

      this.gitignorePatterns = patterns;
      this.gitignore = ignore().add(patterns);

      // Always ignore .git directory and common build/dependency directories
      const defaultIgnores = [
        '.git',
        'node_modules',
        'dist',
        'build',
        '.next',
        'out',
        'coverage',
        '.cache',
        '.turbo',
        '.vscode',
        '.idea',
        '*.log',
        '.DS_Store',
        'Thumbs.db',
      ];

      this.gitignore.add(defaultIgnores);
      this.gitignorePatterns.push(...defaultIgnores);
    } catch (_error) {
      // If .gitignore doesn't exist or can't be read, use default ignores
      const defaultIgnores = [
        '.git',
        'node_modules',
        'dist',
        'build',
        '.next',
        'out',
        'coverage',
        '.cache',
        '.turbo',
        '.vscode',
        '.idea',
        '*.log',
        '.DS_Store',
        'Thumbs.db',
      ];

      this.gitignore = ignore().add(defaultIgnores);
      this.gitignorePatterns = defaultIgnores;
    }
  }
}

export class ClientRuntimeVSCode implements ClientRuntime {
  constructor() {
    this.fileSystem = new VSCodeFileSystemProvider({
      workingDirectory:
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '',
    });
  }
  public fileSystem: BaseFileSystemProvider;
}
