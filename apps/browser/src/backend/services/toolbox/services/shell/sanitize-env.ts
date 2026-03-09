const WHITELIST = new Set([
  'PATH',
  'HOME',
  'USER',
  'USERNAME',
  'LOGNAME',
  'SHELL',
  'TERM',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'TMPDIR',
  'TEMP',
  'TMP',
  'EDITOR',
  'VISUAL',
  'XDG_CONFIG_HOME',
  'XDG_DATA_HOME',
  'XDG_CACHE_HOME',
  'NODE_ENV',
  'npm_config_registry',
]);

const SENSITIVE_PATTERNS = [
  'SECRET',
  'TOKEN',
  'KEY',
  'PASSWORD',
  'CREDENTIAL',
  'AUTH',
  'PRIVATE',
];

function isSensitive(key: string): boolean {
  const upper = key.toUpperCase();
  return SENSITIVE_PATTERNS.some((p) => upper.includes(p));
}

export function sanitizeEnv(
  resolvedEnv?: Record<string, string> | null,
): Record<string, string> {
  const env: Record<string, string> = {};
  const base: Record<string, string | undefined> =
    resolvedEnv ?? (process.env as Record<string, string | undefined>);

  for (const [key, value] of Object.entries(base)) {
    if (value === undefined) continue;

    if (key.startsWith('ELECTRON_') || key.startsWith('ELECTRON ')) continue;

    if (!WHITELIST.has(key) && isSensitive(key)) continue;

    env[key] = value;
  }

  if (process.platform === 'win32') {
    env.LC_ALL = 'C.UTF-8';
    env.LC_CTYPE = 'C.UTF-8';
    env.LANG = 'C.UTF-8';
  }

  env.STAGEWISE_SHELL = '1';

  return env;
}
