import { Command, InvalidArgumentError } from 'commander';
import fs from 'node:fs';
import path from 'node:path';

function myParseInt(value: string) {
  // parseInt takes a string and a radix
  const parsedValue = Number.parseInt(value, 10);
  if (Number.isNaN(parsedValue)) {
    throw new InvalidArgumentError('Not a number.');
  }
  return parsedValue;
}

function myParsePath(value: string) {
  const parsedValue = path.resolve(value);
  if (!fs.existsSync(parsedValue)) {
    throw new InvalidArgumentError('Path does not exist.');
  }
  return parsedValue;
}

const program = new Command();

// Store command info for later use
let commandExecuted: string | undefined;
let authSubcommand: string | undefined;

program
  .name('stagewise')
  .description('Stagewise CLI - Development Proxy & AI Coding Assistant')
  .version('0.0.1')
  .option<number>(
    '-p, --port [port]',
    'The port on which the stagewise-wrapped app will run',
    myParseInt,
  )
  .option<number>(
    '-a, --app-port <app-port>',
    'The port of the developed app that stagewise will wrap with the toolbar',
    myParseInt,
  )
  .option<string>(
    '-w, --workspace <workspace>',
    'The path to the repository of the developed app',
    myParsePath,
    process.cwd(),
  )
  .option('-s, --silent', 'Will not request user input or guide through setup')
  .option('-v, --verbose', 'Output debug information to the CLI')
  .option(
    '-t, --token <token>',
    'If set, will use the given auth token instead of using or asked for a stored one',
  )
  .option('-b', 'Bridge mode - will not start the coding agent server');

// Add auth command with subcommands
const authCommand = program
  .command('auth')
  .description('Manage authentication for Stagewise CLI');

authCommand
  .command('login')
  .description('Authenticate with Stagewise')
  .action(() => {
    commandExecuted = 'auth';
    authSubcommand = 'login';
  });

authCommand
  .command('logout')
  .description('Clear stored authentication tokens')
  .action(() => {
    commandExecuted = 'auth';
    authSubcommand = 'logout';
  });

authCommand
  .command('status')
  .description('Check authentication status')
  .action(() => {
    commandExecuted = 'auth';
    authSubcommand = 'status';
  });

// Default action for main program
program.action(() => {
  commandExecuted = 'main';
});

// Parse arguments but store raw values for validation
const rawArgs = process.argv.slice(2);
const _hasWorkspaceArg =
  rawArgs.includes('-w') || rawArgs.includes('--workspace');
const hasTokenArg = rawArgs.includes('-t') || rawArgs.includes('--token');
const hasBridgeMode = rawArgs.includes('-b');

// Validate bridge mode conflicts before parsing (to avoid path validation)
if (hasBridgeMode && hasTokenArg) {
  console.error(
    'Bridge mode (-b) is incompatible with token (-t) configuration',
  );
  process.exit(1);
}

// Parse with Commander
program.parse(process.argv);

// Initialize variables
let port: number | undefined;
let appPort: number | undefined;
let workspace: string;
let silent: boolean;
let verbose: boolean;
let token: string | undefined;
let bridgeMode: boolean;

// Get options from the main program (global options are available on program)
const options = program.opts();

// Handle auth commands separately
if (commandExecuted === 'auth') {
  // Set default values for auth commands
  port = undefined;
  appPort = undefined;
  workspace = process.cwd();
  silent = false;
  verbose = false;
  token = undefined;
  bridgeMode = false;
} else {
  const {
    port: parsedPort,
    appPort: parsedAppPort,
    workspace: parsedWorkspace,
    silent: parsedSilent,
    verbose: parsedVerbose,
    token: parsedToken,
    b: parsedBridgeMode,
  } = options as {
    port?: number;
    appPort?: number;
    workspace: string;
    silent: boolean;
    verbose: boolean;
    token?: string;
    b: boolean;
  };

  // Validate port conflicts
  if (!parsedBridgeMode && parsedAppPort && parsedPort === parsedAppPort) {
    throw new Error('port and app-port cannot be the same');
  }

  port = parsedPort;
  appPort = parsedAppPort;
  workspace = parsedWorkspace;
  silent = parsedSilent;
  verbose = parsedVerbose;
  token = parsedToken;
  bridgeMode = parsedBridgeMode;
}

// Export the parsed values
export {
  port,
  appPort,
  workspace,
  silent,
  verbose,
  token,
  bridgeMode,
  commandExecuted,
  authSubcommand,
};
