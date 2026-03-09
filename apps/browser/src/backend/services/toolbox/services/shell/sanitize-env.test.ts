import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { sanitizeEnv } from './sanitize-env';

describe('sanitizeEnv', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = process.env;
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('strips sensitive vars', () => {
    process.env.MY_SECRET_TOKEN = 'abc';
    process.env.DB_PASSWORD = 'xyz';
    process.env.PRIVATE_KEY_DATA = 'secret';

    const env = sanitizeEnv();

    expect(env.MY_SECRET_TOKEN).toBeUndefined();
    expect(env.DB_PASSWORD).toBeUndefined();
    expect(env.PRIVATE_KEY_DATA).toBeUndefined();
  });

  it('whitelist wins over sensitive patterns', () => {
    process.env.SHELL = '/bin/zsh';
    process.env.PATH = '/usr/bin';
    process.env.SSH_AUTH_SOCK = '/tmp/ssh-agent';

    const env = sanitizeEnv();

    expect(env.SHELL).toBe('/bin/zsh');
    expect(env.PATH).toBe('/usr/bin');
    expect(env.SSH_AUTH_SOCK).toBeUndefined();
  });

  it('strips ELECTRON_ vars', () => {
    process.env.ELECTRON_RUN_AS_NODE = '1';
    process.env.ELECTRON_OZONE_PLATFORM_HINT = 'auto';

    const env = sanitizeEnv();

    expect(env.ELECTRON_RUN_AS_NODE).toBeUndefined();
    expect(env.ELECTRON_OZONE_PLATFORM_HINT).toBeUndefined();
  });

  it('sets STAGEWISE_SHELL marker', () => {
    const env = sanitizeEnv();
    expect(env.STAGEWISE_SHELL).toBe('1');
  });

  it('omits undefined values', () => {
    const env = sanitizeEnv();
    for (const value of Object.values(env)) {
      expect(value).toBeDefined();
      expect(typeof value).toBe('string');
    }
  });

  it('passes through normal vars', () => {
    process.env.SOME_NORMAL_VAR = 'hello';

    const env = sanitizeEnv();

    expect(env.SOME_NORMAL_VAR).toBe('hello');
  });

  it('uses resolvedEnv as base when provided', () => {
    process.env.FROM_PROCESS = 'process';

    const resolved = {
      FROM_RESOLVED: 'resolved',
      PATH: '/custom/bin:/usr/bin',
      MY_SECRET_TOKEN: 'leaked',
      ELECTRON_RUN_AS_NODE: '1',
    };

    const env = sanitizeEnv(resolved);

    expect(env.FROM_RESOLVED).toBe('resolved');
    expect(env.PATH).toBe('/custom/bin:/usr/bin');
    expect(env.FROM_PROCESS).toBeUndefined();
    expect(env.MY_SECRET_TOKEN).toBeUndefined();
    expect(env.ELECTRON_RUN_AS_NODE).toBeUndefined();
    expect(env.STAGEWISE_SHELL).toBe('1');
  });
});
