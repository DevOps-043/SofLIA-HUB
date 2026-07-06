import type { AutomationOpsController } from './useAutomationOpsController';
import { WhatsAppShortcuts } from './WhatsAppShortcuts';

export function ExtrasPanel({ controller: _controller }: { controller: AutomationOpsController }) {
  void _controller;
  return (
    <div className="max-w-xl mt-4 space-y-3">
      <WhatsAppShortcuts />
    </div>
  );
}
