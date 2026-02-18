import type { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import { safeStorage } from 'electron';
import { getGlobalDataPath } from './paths';

interface PersistedDataOptions {
  encrypt?: boolean;
}

/**
 * Reads persisted data from a JSON file in the global data directory.
 * Uses Zod schema for validation and type inference.
 *
 * When `options.encrypt` is true the file is assumed to be encrypted
 * via Electron's safeStorage. Decryption is attempted first; on failure
 * the raw bytes are decoded as UTF-8 (graceful plaintext fallback).
 *
 * @param name - The name of the data file (without .json extension)
 * @param schema - Zod schema to validate and infer the type
 * @param defaultValue - Value to return if file doesn't exist or is invalid
 * @param options - Optional settings (e.g. `{ encrypt: true }`)
 * @returns The parsed data or default value
 */
export async function readPersistedData<T extends z.ZodTypeAny>(
  name: string,
  schema: T,
  defaultValue: z.infer<T>,
  options?: PersistedDataOptions,
): Promise<z.infer<T>> {
  const filePath = path.join(getGlobalDataPath(), `${name}.json`);
  try {
    let content: string;

    if (options?.encrypt) {
      const buffer = await fs.readFile(filePath);
      try {
        if (safeStorage.isEncryptionAvailable())
          content = safeStorage.decryptString(buffer);
        else content = buffer.toString('utf-8');
      } catch {
        content = buffer.toString('utf-8');
      }
    } else content = await fs.readFile(filePath, 'utf-8');

    return schema.parse(JSON.parse(content));
  } catch {
    return defaultValue;
  }
}

/**
 * Writes data to a JSON file in the global data directory.
 * Validates data against schema before writing.
 *
 * When `options.encrypt` is true the JSON payload is encrypted via
 * Electron's safeStorage before being written. Falls back to plaintext
 * if encryption is unavailable.
 *
 * @param name - The name of the data file (without .json extension)
 * @param schema - Zod schema to validate the data
 * @param data - The data to write
 * @param options - Optional settings (e.g. `{ encrypt: true }`)
 */
export async function writePersistedData<T extends z.ZodTypeAny>(
  name: string,
  schema: T,
  data: z.infer<T>,
  options?: PersistedDataOptions,
): Promise<void> {
  const filePath = path.join(getGlobalDataPath(), `${name}.json`);
  schema.parse(data);

  const json = JSON.stringify(data, null, 2);

  if (options?.encrypt) {
    try {
      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(json);
        await fs.writeFile(filePath, encrypted);
        return;
      }
    } catch {
      // fall through to plaintext write
    }
  }

  await fs.writeFile(filePath, json, 'utf-8');
}
