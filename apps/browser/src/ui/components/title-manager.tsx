import { useKartonState } from '@ui/hooks/use-karton';
import { useEffect } from 'react';

export function TitleManager() {
  const authStatus = useKartonState((s) => s.userAccount.status);

  useEffect(() => {
    if (authStatus === 'unauthenticated')
      document.title = 'Sign in | stagewise';
    else document.title = 'stagewise';
  }, [authStatus]);

  return null;
}
