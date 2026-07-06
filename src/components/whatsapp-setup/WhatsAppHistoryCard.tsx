import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
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
    <Card>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Historial WhatsApp</h3>
          <p className="text-xs text-secondary mt-0.5">Uso interno para memoria y mejora del modelo</p>
        </div>
        <Button variant="secondary" size="sm" onClick={onRefresh} disabled={loading}>
          {loading ? 'Actualizando' : 'Actualizar'}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <Metric label="Total" value={stats?.total || 0} />
        <Metric label="Entradas" value={stats?.incoming || 0} />
        <Metric label="Salidas" value={stats?.outgoing || 0} />
        <Metric label="Tools" value={stats?.tool || 0} />
        <Metric label="Media" value={(stats?.media || 0) + (stats?.audio || 0) + (stats?.file || 0)} />
      </div>

      <div className="border border-border rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[92px_110px_1fr] gap-3 px-3 py-2 bg-surface-2 text-xs font-medium text-secondary">
          <span>Fecha</span>
          <span>Tipo</span>
          <span>Contenido</span>
        </div>
        <div className="max-h-64 overflow-y-auto custom-scrollbar divide-y divide-border">
          {events.length === 0 && (
            <div className="px-3 py-6 text-sm text-secondary text-center">
              Aun no hay eventos registrados.
            </div>
          )}
          {events.map((event) => (
            <HistoryRow key={event.id} event={event} />
          ))}
        </div>
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface-2 border border-border rounded-2xl px-3 py-3">
      <p className="text-xs font-medium text-secondary">{label}</p>
      <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">{value}</p>
    </div>
  );
}

function HistoryRow({ event }: { event: WhatsAppConversationHistoryEvent }) {
  return (
    <div className="grid grid-cols-[92px_110px_1fr] gap-3 px-3 py-2 text-xs text-gray-700 dark:text-gray-200">
      <span className="font-mono text-xs text-secondary">{formatDate(event.timestamp)}</span>
      <span className="font-mono text-xs uppercase text-secondary">{formatKind(event)}</span>
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
