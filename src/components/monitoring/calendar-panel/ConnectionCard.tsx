import type { CalendarConnection, CalendarProvider } from './types';
import { ProviderLogo } from './ProviderLogo';

type Props = {
  connection?: CalendarConnection;
  loading: boolean;
  provider: CalendarProvider;
  onConnect: (provider: CalendarProvider) => void;
  onDisconnect: (provider: CalendarProvider) => void;
};

export function ConnectionCard({ connection, loading, provider, onConnect, onDisconnect }: Props) {
  return (
    <div className="group/conn flex items-center justify-between p-4 rounded-2xl bg-white/2 border border-white/5 hover:bg-white/5 transition-all">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/5 shrink-0">
          <ProviderLogo provider={provider} />
        </div>
        <div className="min-w-0">
          {connection && (
            <p className="text-[11px] text-gray-400 truncate font-mono tracking-tighter">{connection.email}</p>
          )}
        </div>
      </div>
      <div className="shrink-0 ml-3">
        {connection ? (
          <button
            onClick={() => onDisconnect(provider)}
            className="p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-400/5 transition-all"
          >
            <DisconnectIcon />
          </button>
        ) : (
          <button
            onClick={() => onConnect(provider)}
            disabled={loading}
            className="text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl bg-white text-black hover:bg-gray-200 transition-all disabled:opacity-50 active:scale-95"
          >
            {loading ? '...' : 'Conectar'}
          </button>
        )}
      </div>
    </div>
  );
}

function DisconnectIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}
