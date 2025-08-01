import chalk from 'chalk';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function getVersion(): string {
  try {
    // Read package.json to get version
    const packageJsonPath = join(__dirname, '../../package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.version;
  } catch {
    return 'unknown';
  }
}

export function printBanner(silent: boolean): void {
  if (silent) {
    return;
  }

  const version = getVersion();

  /**
   * This function logs an ASCII art representation of the logo to the console.
   * It uses chalk to apply a blue and purple gradient, similar to the provided image,
   * with a white-filled center.
   */
  console.log();
  console.log(chalk.blue.bold('     STAGEWISE') + chalk.gray(` v${version}`));
  console.log(
    chalk.gray('     The frontend coding agent for production codebases'),
  );
  console.log();
  console.log();
}

export function printCompactBanner(silent: boolean): void {
  if (silent) {
    return;
  }

  const version = getVersion();

  console.log();
  console.log(chalk.blue.bold('  STAGEWISE') + chalk.gray(` v${version}`));
  console.log(chalk.gray('  Development Proxy & AI Coding Assistant'));
  console.log();
}
