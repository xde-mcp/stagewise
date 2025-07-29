import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

describe('CLI Workflow Integration Tests', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'stagewise-test-'));
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('CLI arguments', () => {
    it('should start with default port when no port is specified', async () => {
      const child = spawn(
        'tsx',
        ['src/index.ts', '-a', '3000', '-w', testDir, '-s', '-t', 'test-token'],
        {
          cwd: process.cwd(),
          shell: false,
        },
      );

      let output = '';
      let errorOutput = '';
      child.stdout.on('data', (data) => {
        output += data.toString();
      });
      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      // Wait a bit for the process to start
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Check if the output contains the expected port
      if (errorOutput) {
        console.error('Test stderr:', errorOutput);
      }
      expect(output).toContain('3100');

      child.kill();
    });

    it('should fail when port and app-port are the same', async () => {
      const child = spawn(
        'tsx',
        ['src/index.ts', '-p', '3000', '-a', '3000', '-s'],
        {
          cwd: process.cwd(),
          shell: false,
        },
      );

      let errorOutput = '';
      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      const exitCode = await new Promise<number>((resolve) => {
        child.on('exit', (code) => resolve(code || 0));
      });

      expect(exitCode).not.toBe(0);
      expect(errorOutput).toContain('port and app-port cannot be the same');
    });

    it('should succeed in bridge mode with workspace argument', async () => {
      const child = spawn(
        'tsx',
        ['src/index.ts', '-b', '-w', testDir, '-a', '3000', '-s'],
        {
          cwd: process.cwd(),
          shell: false,
        },
      );

      let output = '';
      let errorOutput = '';
      child.stdout.on('data', (data) => {
        output += data.toString();
      });
      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      // Wait a bit for the process to start
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Should start successfully
      if (errorOutput) {
        console.error('Test stderr:', errorOutput);
      }
      expect(output).toContain('Running in bridge mode');

      child.kill();
    });
  });

  describe('Config file handling', () => {
    it('should load configuration from stagewise.json', async () => {
      // Create a config file
      const config = {
        port: 4100,
        appPort: 4000,
        autoPlugins: true,
      };

      await fs.writeFile(
        path.join(testDir, 'stagewise.json'),
        JSON.stringify(config, null, 2),
        'utf-8',
      );

      const child = spawn(
        'tsx',
        ['src/index.ts', '-w', testDir, '-s', '-t', 'test-token'],
        {
          cwd: process.cwd(),
          shell: false,
        },
      );

      let output = '';
      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      // Wait a bit for the process to start
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // The CLI should use the config file values
      expect(output).toContain('4100');

      child.kill();
    });

    it('should validate config file and fail on invalid schema', async () => {
      // Create an invalid config file
      const invalidConfig = {
        port: 'not a number', // Should be number
        appPort: 3000,
      };

      await fs.writeFile(
        path.join(testDir, 'stagewise.json'),
        JSON.stringify(invalidConfig, null, 2),
        'utf-8',
      );

      const child = spawn(
        'tsx',
        ['src/index.ts', '-w', testDir, '-s', '-t', 'test-token'],
        {
          cwd: process.cwd(),
          shell: false,
        },
      );

      let errorOutput = '';
      let output = '';
      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      const exitCode = await new Promise<number>((resolve) => {
        child.on('exit', (code) => resolve(code || 0));
      });

      expect(exitCode).not.toBe(0);
      // Check both stderr and stdout for the error message
      const combinedOutput = errorOutput + output;
      expect(combinedOutput).toContain(
        'Invalid configuration in stagewise.json',
      );

      child.kill();
    });
  });

  describe('Bridge mode', () => {
    it('should start in bridge mode without requiring app-port', async () => {
      const child = spawn('tsx', ['src/index.ts', '-b', '-s'], {
        cwd: process.cwd(),
        shell: false,
      });

      let _output = '';
      let errorOutput = '';

      child.stdout.on('data', (data) => {
        _output += data.toString();
      });

      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      // Wait a bit for the process to start
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Should start without errors
      expect(errorOutput).not.toContain('app-port');

      child.kill();
    });
  });

  describe('Verbose mode', () => {
    it('should output debug information in verbose mode', async () => {
      const child = spawn(
        'tsx',
        [
          'src/index.ts',
          '-a',
          '3000',
          '-w',
          testDir,
          '-v',
          '-s',
          '-t',
          'test-token',
        ],
        {
          cwd: process.cwd(),
          shell: false,
        },
      );

      let output = '';
      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      // Wait a bit for debug output
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Should contain debug prefix
      expect(output).toContain('[DEBUG]');

      child.kill();
    });
  });
});
