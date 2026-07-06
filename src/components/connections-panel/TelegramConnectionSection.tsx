import { Button } from '../ui/Button';
import { Toggle } from '../ui/Toggle';
import { ConnectionChrome } from './ConnectionChrome';
import type { TelegramConnectionState } from './types';

export function TelegramConnectionSection(props: {
  open: boolean;
  onToggle: () => void;
  connection: TelegramConnectionState;
  isOrgAdmin?: boolean;
}) {
  const { connection } = props;
  return (
    <ConnectionChrome
      open={props.open}
      onToggle={props.onToggle}
      connected={connection.connected}
      icon={<TelegramIcon />}
      title="Telegram"
      subtitle={connection.connected ? `@${connection.status?.bot?.username || 'Bot conectado'}` : 'No configurado'}
    >
      {connection.connected
        ? <TelegramConnected connection={connection} isOrgAdmin={Boolean(props.isOrgAdmin)} />
        : <TelegramSetup connection={connection} isOrgAdmin={Boolean(props.isOrgAdmin)} />}
    </ConnectionChrome>
  );
}

function TelegramConnected({ connection, isOrgAdmin }: { connection: TelegramConnectionState; isOrgAdmin: boolean }) {
  return (
    <div className="pt-4 space-y-3">
      <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-2 border border-border">
        <div className="w-8 h-8 rounded-lg bg-[#2AABEE]/10 flex items-center justify-center"><CheckIcon /></div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white">@{connection.status?.bot?.username}</p>
          <p className="text-xs text-secondary">{connection.status?.bot?.first_name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Toggle checked={Boolean(connection.status?.enabled)} onChange={(next) => connection.toggle(next)} aria-label="Activar bot de Telegram" />
          <button onClick={connection.disconnect} className="text-xs font-medium text-danger hover:text-danger px-3 py-1.5 rounded-lg hover:bg-danger/10 transition-colors">Quitar</button>
        </div>
      </div>
      <p className="text-xs text-secondary text-center">
        {isOrgAdmin
          ? 'Canal administrado para automatizaciones y mensajes organizacionales.'
          : 'Canal personal para recordatorios, notificaciones y tu agente privado.'}
      </p>
      <RecentChats chats={connection.status?.recent_chats || []} />
    </div>
  );
}

function TelegramSetup({ connection, isOrgAdmin }: { connection: TelegramConnectionState; isOrgAdmin: boolean }) {
  return (
    <div className="pt-4 space-y-3">
      <p className="text-sm text-secondary">
        {isOrgAdmin
          ? 'Ingresa el token del bot organizacional de Telegram.'
          : 'Ingresa el token de tu bot personal para recordatorios y notificaciones propias.'}
      </p>
      <div className="flex gap-2">
        <input
          type="password"
          value={connection.tokenInput}
          onChange={(event) => connection.setTokenInput(event.target.value)}
          placeholder="123456:ABC-DEF..."
          className="flex-1 px-3.5 py-2.5 text-sm rounded-xl bg-surface-2 border border-border text-gray-900 dark:text-white placeholder-secondary/70 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-colors"
          onKeyDown={(event) => event.key === 'Enter' && connection.saveToken()}
        />
        <Button variant="primary" size="sm" onClick={connection.saveToken} loading={connection.testing} disabled={!connection.tokenInput.trim()}>
          Conectar
        </Button>
      </div>
      {connection.error && <p className="text-xs text-danger">{connection.error}</p>}
    </div>
  );
}

function RecentChats({ chats }: { chats: Array<{ chatId: string; title: string; type: string }> }) {
  if (chats.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium text-secondary mb-2">Chats recientes</p>
      <div className="space-y-1">
        {chats.slice(0, 3).map((chat) => (
          <div key={chat.chatId} className="flex items-center gap-2 p-2 rounded-lg bg-surface-2">
            <p className="text-xs text-gray-600 dark:text-gray-300 truncate flex-1">{chat.title}</p>
            <p className="text-xs text-secondary shrink-0">{chat.type}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TelegramIcon() {
  return <div className="w-10 h-10 rounded-xl bg-[#2AABEE]/10 flex items-center justify-center shrink-0"><svg className="w-5 h-5 text-[#2AABEE]" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg></div>;
}

function CheckIcon() {
  return <svg className="w-4 h-4 text-[#2AABEE]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>;
}
