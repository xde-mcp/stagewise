import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL:
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://stagewise.io',
  basePath: '/api/auth',
});

export const { useSession } = authClient;
