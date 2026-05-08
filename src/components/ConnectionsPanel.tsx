import { useState } from 'react';
import { GoogleConnectionSection } from './connections-panel/GoogleConnectionSection';
import { TelegramConnectionSection } from './connections-panel/TelegramConnectionSection';
import { WhatsAppConnectionSection } from './connections-panel/WhatsAppConnectionSection';
import { useCalendarConnections } from './connections-panel/useCalendarConnections';
import { useTelegramConnection } from './connections-panel/useTelegramConnection';
import { useWhatsAppConnection } from './connections-panel/useWhatsAppConnection';
import type { ConnectionSection } from './connections-panel/types';

interface ConnectionsPanelProps {
  apiKey?: string;
}

export function ConnectionsPanel({ apiKey }: ConnectionsPanelProps) {
  const [expanded, setExpanded] = useState<ConnectionSection>(null);
  const whatsApp = useWhatsAppConnection(apiKey);
  const telegram = useTelegramConnection();
  const calendar = useCalendarConnections();
  const toggle = (section: ConnectionSection) => setExpanded((prev) => prev === section ? null : section);

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 pt-6 pb-4">
        <h3 className="text-gray-900 dark:text-white text-lg font-semibold">Conexiones</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Administra tus integraciones con servicios externos</p>
      </div>
      <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-6 space-y-3">
        <WhatsAppConnectionSection
          open={expanded === 'whatsapp'}
          onToggle={() => toggle('whatsapp')}
          connection={whatsApp}
        />
        <TelegramConnectionSection
          open={expanded === 'telegram'}
          onToggle={() => toggle('telegram')}
          connection={telegram}
        />
        <GoogleConnectionSection
          open={expanded === 'google'}
          onToggle={() => toggle('google')}
          connection={calendar}
        />
      </div>
    </div>
  );
}
