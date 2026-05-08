import { TelegramSettings } from './TelegramSettings';
import type { AutomationOpsController } from './useAutomationOpsController';
import { WhatsAppShortcuts } from './WhatsAppShortcuts';

export function ExtrasPanel({ controller }: { controller: AutomationOpsController }) {
  return (
    <div className="max-w-xl mt-4 space-y-3">
      <WhatsAppShortcuts />
      {controller.bridge.telegram && <TelegramSettings controller={controller} />}
    </div>
  );
}
