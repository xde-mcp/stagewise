/**
 * Compares two sandbox session IDs and produces a change description
 * when the sandbox context was recreated (crash recovery or app restart).
 * Returns an empty array when there is no previous session ID
 * (first message) or when the session is unchanged.
 */
export function computeSandboxChanges(
  prevSessionId: string | null,
  currSessionId: string | null,
): string[] {
  if (!prevSessionId || !currSessionId) return [];
  if (prevSessionId === currSessionId) return [];
  return [
    'sandbox restarted: your globalThis state and cached modules have been reset',
  ];
}
