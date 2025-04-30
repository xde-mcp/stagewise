import {
  DEFAULT_PORT,
  PING_ENDPOINT,
  PING_RESPONSE,
} from '@stagewise/extension-toolbar-srpc-contract';

export async function findPort(
  maxAttempts = 10,
  timeout = 300,
): Promise<number | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const port = DEFAULT_PORT + attempt;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(
          `http://localhost:${port}${PING_ENDPOINT}`,
          {
            signal: controller.signal,
          },
        );

        clearTimeout(timeoutId);

        if (response.ok) {
          const text = await response.text();
          if (text === PING_RESPONSE) {
            return port;
          }
        }
      } catch (error) {
        clearTimeout(timeoutId);
        // Continue to next port if request fails
        continue;
      }
    } catch (error) {
      // Continue to next port if any other error occurs
      continue;
    }
  }

  return null;
}
