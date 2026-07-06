import { Button } from '../ui/Button';
import { BellIcon } from './ProactiveBlock';
import type { ProactiveConfigState } from './types';

export function ProactiveTestPanel({ proactive }: { proactive: ProactiveConfigState }) {
  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 bg-surface-2 border border-border rounded-xl p-3">
      <Button variant="primary" size="sm" onClick={proactive.testNotification} loading={proactive.proactiveTesting} icon={<BellIcon className="w-3.5 h-3.5" />}>
        Sincronizar
      </Button>
      <div className="flex-1 flex items-center overflow-hidden">
        {proactive.proactiveTestResult ? (
          <p className="text-xs font-medium text-accent truncate">{proactive.proactiveTestResult}</p>
        ) : (
          <p className="text-xs text-secondary">Requiere WhatsApp vinculado.</p>
        )}
      </div>
    </div>
  );
}
