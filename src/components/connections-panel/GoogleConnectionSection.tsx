import { Button } from '../ui/Button';
import { ConnectionChrome } from './ConnectionChrome';
import { GoogleLogo, MicrosoftLogo } from './ProviderLogos';
import type { CalendarConnection, CalendarConnectionsState } from './types';

export function GoogleConnectionSection(props: {
  open: boolean;
  onToggle: () => void;
  connection: CalendarConnectionsState;
}) {
  const { connection } = props;
  return (
    <ConnectionChrome
      open={props.open}
      onToggle={props.onToggle}
      connected={!!connection.google}
      icon={<div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0"><GoogleLogo /></div>}
      title="Google Workspace"
      subtitle={connection.google ? `${connection.google.email} — Calendar, Gmail, Drive, Chat` : 'Calendar, Gmail, Drive y Google Chat'}
    >
      <div className="pt-4 space-y-3">
        <ProviderRow
          label="Google"
          provider="google"
          connection={connection.google}
          loading={connection.loading}
          onConnect={connection.connect}
          onDisconnect={connection.disconnect}
          logo={<GoogleLogo small />}
        />
        <ProviderRow
          label="Microsoft Outlook"
          provider="microsoft"
          connection={connection.microsoft}
          loading={connection.loading}
          onConnect={connection.connect}
          onDisconnect={connection.disconnect}
          logo={<MicrosoftLogo />}
        />
        {connection.error && <p className="text-xs text-danger text-center">{connection.error}</p>}
        {connection.google && (
          <p className="text-xs text-secondary text-center leading-relaxed">
            Con Google conectado, SofLIA tiene acceso a Calendar, Gmail, Drive y Google Chat.
          </p>
        )}
      </div>
    </ConnectionChrome>
  );
}

function ProviderRow(props: {
  label: string;
  provider: 'google' | 'microsoft';
  connection?: CalendarConnection;
  loading: string | null;
  logo: React.JSX.Element;
  onConnect: (provider: 'google' | 'microsoft') => Promise<void>;
  onDisconnect: (provider: 'google' | 'microsoft') => Promise<void>;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-2 border border-border">
      <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center shrink-0">{props.logo}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{props.label}</p>
        {props.connection && <p className="text-xs text-secondary font-mono truncate">{props.connection.email}</p>}
      </div>
      {props.connection ? (
        <button onClick={() => props.onDisconnect(props.provider)} className="text-xs font-medium text-danger hover:text-danger px-3 py-1.5 rounded-lg hover:bg-danger/10 transition-colors">
          Desconectar
        </button>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => props.onConnect(props.provider)} loading={props.loading === props.provider}>
          Conectar
        </Button>
      )}
    </div>
  );
}
