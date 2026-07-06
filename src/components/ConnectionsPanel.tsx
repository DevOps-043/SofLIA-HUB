import { useState } from 'react';
import { GoogleConnectionSection } from './connections-panel/GoogleConnectionSection';
import { TelegramConnectionSection } from './connections-panel/TelegramConnectionSection';
import { WhatsAppConnectionSection } from './connections-panel/WhatsAppConnectionSection';
import { useCalendarConnections } from './connections-panel/useCalendarConnections';
import { useTelegramConnection } from './connections-panel/useTelegramConnection';
import { useWhatsAppConnection } from './connections-panel/useWhatsAppConnection';
import type { ConnectionSection } from './connections-panel/types';
import { useAuth } from '../contexts/AuthContext';

interface ConnectionsPanelProps {
  apiKey?: string;
}

export function ConnectionsPanel({ apiKey }: ConnectionsPanelProps) {
  const [expanded, setExpanded] = useState<ConnectionSection>(null);
  const auth = useAuth();
  const activeMembership = auth.sofiaContext?.memberships.find((membership) =>
    membership.organization_id === auth.sofiaContext?.currentOrganization?.id
  );
  const isOrgAdmin = activeMembership?.role === 'owner' || activeMembership?.role === 'admin';
  const whatsApp = useWhatsAppConnection(apiKey);
  const telegram = useTelegramConnection();
  const calendar = useCalendarConnections();
  const toggle = (section: ConnectionSection) => setExpanded((prev) => prev === section ? null : section);

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 pt-6 pb-4">
        <h3 className="text-gray-900 dark:text-white text-lg font-semibold">
          {isOrgAdmin ? 'Canales organizacionales' : 'Canales personales'}
        </h3>
        <p className="text-xs text-secondary mt-0.5">
          {isOrgAdmin
            ? 'Administra WhatsApp, Telegram y politicas para la organizacion'
            : 'Conecta tus canales para uso personal, recordatorios y tus dispositivos'}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-6 space-y-3">
        <WhatsAppConnectionSection
          open={expanded === 'whatsapp'}
          onToggle={() => toggle('whatsapp')}
          connection={whatsApp}
          isOrgAdmin={isOrgAdmin}
        />
        <TelegramConnectionSection
          open={expanded === 'telegram'}
          onToggle={() => toggle('telegram')}
          connection={telegram}
          isOrgAdmin={isOrgAdmin}
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
