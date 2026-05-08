import { useEffect } from 'react';
import { getErrorMessage } from './formatters';
import { useActionRunner } from './useActionRunner';
import { useAutomationData } from './useAutomationData';
import { useAutomationFormState } from './useAutomationFormState';
import { useBridgeAvailability } from './useBridgeAvailability';

export function useAutomationOpsController(userId: string) {
  const bridge = useBridgeAvailability();
  const forms = useAutomationFormState();
  const runner = useActionRunner();
  const data = useAutomationData(bridge, forms.telegram.hydrate);
  const setError = runner.setError;

  useEffect(() => {
    void data.refreshOverview(false).catch((currentError: unknown) => {
      setError(getErrorMessage(currentError) || 'No pude cargar la consola.');
    });
    const intervalId = window.setInterval(() => {
      void data.refreshOverview(true).catch(() => {});
    }, 20000);
    return () => window.clearInterval(intervalId);
  }, [data.refreshOverview, setError]);

  return { userId, bridge, forms, runner, data };
}

export type AutomationOpsController = ReturnType<typeof useAutomationOpsController>;
