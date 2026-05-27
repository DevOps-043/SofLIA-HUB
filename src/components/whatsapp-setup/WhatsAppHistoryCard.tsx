import type {
  WhatsAppConversationHistoryEvent,
  WhatsAppConversationHistoryStats,
} from './types';

interface WhatsAppHistoryCardProps {
  events: WhatsAppConversationHistoryEvent[];
  stats: WhatsAppConversationHistoryStats | null;
  loading: boolean;
  onRefresh: () => void;
}

export function WhatsAppHistoryCard({ events, stats, loading, onRefresh }: WhatsAppHistoryCardProps) {
  return (
    <section className="bg-white dark:bg-white/3 border border-gray-200 dark:border-white/10 rounded-3xl p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
        <div>
          <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Historial WhatsApp</h4>
          <p className="text-[9px] text-gray-400 uppercase tracking-widest mt-1">Uso interno para memoria y mejora del modelo</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="px-4 py-2 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-accent hover:text-white transition-all disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Actualizando' : 'Actualizar'}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <Metric label="Total" value={stats?.total || 0} />
        <Metric label="Entradas" value={stats?.incoming || 0} />
        <Metric label="Salidas" value={stats?.outgoing || 0} />
        <Metric label="Tools" value={stats?.tool || 0} />
        <Metric label="Media" value={(stats?.media || 0) + (stats?.audio || 0) + (stats?.file || 0)} />
      </div>

      <div className="border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[92px_110px_1fr] gap-3 px-3 py-2 bg-gray-50 dark:bg-background-dark/60 text-[9px] font-black uppercase tracking-widest text-gray-500">
          <span>Fecha</span>
          <span>Tipo</span>
          <span>Contenido</span>
        </div>
        <div className="max-h-64 overflow-y-auto custom-scrollbar divide-y divide-gray-100 dark:divide-white/5">
          {events.length === 0 && (
            <div className="px-3 py-6 text-xs text-gray-400 text-center">
              Aun no hay eventos registrados.
            </div>
          )}
          {events.map((event) => (
            <HistoryRow key={event.id} event={event} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-50 dark:bg-background-dark/60 border border-gray-200 dark:border-white/10 rounded-2xl px-3 py-3">
      <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">{label}</p>
      <p className="text-lg font-black text-gray-900 dark:text-white mt-1">{value}</p>
    </div>
  );
}

function HistoryRow({ event }: { event: WhatsAppConversationHistoryEvent }) {
  return (
    <div className="grid grid-cols-[92px_110px_1fr] gap-3 px-3 py-2 text-xs text-gray-700 dark:text-gray-200">
      <span className="font-mono text-[10px] text-gray-400">{formatDate(event.timestamp)}</span>
      <span className="font-mono text-[10px] uppercase text-gray-500">{formatKind(event)}</span>
      <span className="min-w-0 truncate" title={formatContent(event)}>
        {formatContent(event)}
      </span>
    </div>
  );
}

function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('es-MX', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatKind(event: WhatsAppConversationHistoryEvent): string {
  const direction = event.direction === 'incoming' ? 'IN' : event.direction === 'outgoing' ? 'OUT' : 'SYS';
  return `${direction} ${event.kind}`;
}

function formatContent(event: WhatsAppConversationHistoryEvent): string {
  if (event.text) return event.text.replace(/\s+/g, ' ').trim();
  if (event.media?.fileName) return event.media.fileName;
  if (event.tool?.names.length) return event.tool.names.join(', ');
  return event.jid;
}
