import { useEffect, useMemo } from 'react';
import { createAuthOperations } from './auth-operations';

export function useAuthOperations(revoke: () => void) {
  const operations = useMemo(() => createAuthOperations(revoke), [revoke]);
  useEffect(() => {
    operations.activate();
    return () => operations.dispose();
  }, [operations]);
  return operations;
}
