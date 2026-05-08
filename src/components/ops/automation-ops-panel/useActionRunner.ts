import { useCallback, useState } from 'react';
import { getErrorMessage } from './formatters';

export function useActionRunner() {
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  const runAction = useCallback(async (key: string, callback: () => Promise<void>) => {
    setActionKey(key);
    setError(null);
    setNotice(null);
    try {
      await callback();
    } catch (currentError: unknown) {
      setError(getErrorMessage(currentError) || 'La accion fallo.');
    } finally {
      setActionKey(null);
    }
  }, []);

  return { notice, setNotice, error, setError, actionKey, comment, setComment, runAction };
}
