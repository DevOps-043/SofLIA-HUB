/**
 * Registro de decisiones del SDO: la fuente oficial de "que esta decidido,
 * por quien y hasta cuando". Lista con filtros por los tres ejes de estado,
 * detalle con evidencia y aprobacion humana, y tarjeta de contexto por sujeto.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  approveSdoObject,
  generateSdoDocument,
  getSdoContextCard,
  getSdoDecision,
  listSdoDecisions,
  rejectSdoObject,
  type SdoApproval,
  type SdoAuditEvent,
  type SdoAuthorityStatus,
  type SdoDecision,
  type SdoTemporalStatus,
} from '../../services/sdo-service';
import { DetalleDecision } from './DetalleDecision';
import {
  AUTHORITY_LABELS,
  authorityChipClass,
  formatearFechaCorta,
  TEMPORAL_LABELS,
  temporalChipClass,
} from './sdo-ui-helpers';

interface RegistroDecisionesProps {
  userId: string;
}

interface DetalleState {
  decision: SdoDecision;
  approvals: SdoApproval[];
  audit: SdoAuditEvent[];
}

export function RegistroDecisiones({ userId }: RegistroDecisionesProps) {
  const [decisions, setDecisions] = useState<SdoDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filtroAutoridad, setFiltroAutoridad] = useState<SdoAuthorityStatus | ''>('');
  const [filtroTemporal, setFiltroTemporal] = useState<SdoTemporalStatus | ''>('');
  const [busqueda, setBusqueda] = useState('');
  const [detalle, setDetalle] = useState<DetalleState | null>(null);
  const [sujetoTarjeta, setSujetoTarjeta] = useState('');
  const [tarjeta, setTarjeta] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await listSdoDecisions({
      authorityStatus: filtroAutoridad || undefined,
      temporalStatus: filtroTemporal || undefined,
      subject: busqueda.trim() || undefined,
      limit: 100,
    });
    if (result.success) {
      setDecisions(result.decisions || []);
    } else {
      setError(result.error || 'No pude cargar el registro de decisiones.');
    }
    setLoading(false);
  }, [filtroAutoridad, filtroTemporal, busqueda]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const abrirDetalle = async (decisionId: string) => {
    const result = await getSdoDecision(decisionId);
    if (result.success && result.decision) {
      setDetalle({ decision: result.decision, approvals: result.approvals || [], audit: result.audit || [] });
    } else {
      setError(result.error || 'No pude cargar el detalle de la decision.');
    }
  };

  const decidir = async (decision: 'aprobar' | 'rechazar', comment: string) => {
    if (!detalle) return;
    setBusy(true);
    setError(null);
    const fn = decision === 'aprobar' ? approveSdoObject : rejectSdoObject;
    const result = await fn({
      objectType: 'decision',
      objectId: detalle.decision.id,
      decidedByUserId: userId,
      comment: comment || undefined,
    });
    if (result.success) {
      setNotice(decision === 'aprobar' ? 'Decision aprobada y marcada como vigente.' : 'Decision rechazada.');
      await abrirDetalle(detalle.decision.id);
      await cargar();
    } else {
      setError(result.error || 'La operacion fallo.');
    }
    setBusy(false);
  };

  const generarRecord = async () => {
    if (!detalle) return;
    setBusy(true);
    setError(null);
    const result = await generateSdoDocument({ tipo: 'decision_record', ref: detalle.decision.id });
    if (result.success && result.result) {
      setNotice(`Decision record generado: ${result.result.filePath}`);
    } else {
      setError(result.error || 'No pude generar el documento.');
    }
    setBusy(false);
  };

  const generarTarjeta = async () => {
    if (!sujetoTarjeta.trim()) return;
    setBusy(true);
    setError(null);
    setTarjeta(null);
    const result = await getSdoContextCard({ sujeto: sujetoTarjeta.trim() });
    if (result.success && result.card) {
      setTarjeta(result.card.markdown);
    } else {
      setError(result.error || 'No pude generar la tarjeta de contexto.');
    }
    setBusy(false);
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden p-4 animate-view-in">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#0A2540] dark:text-white">Registro de decisiones</h2>
          <p className="text-xs text-gray-500 dark:text-white/50">
            Solo lo aprobado y vigente es oficial. Lo propuesto no debe comunicarse como confirmado.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar en decisiones..."
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-800 focus:border-accent focus:outline-none dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
          />
          <select
            value={filtroAutoridad}
            onChange={(event) => setFiltroAutoridad(event.target.value as SdoAuthorityStatus | '')}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/80"
          >
            <option value="">Autoridad: todas</option>
            {Object.entries(AUTHORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select
            value={filtroTemporal}
            onChange={(event) => setFiltroTemporal(event.target.value as SdoTemporalStatus | '')}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/80"
          >
            <option value="">Vigencia: todas</option>
            {Object.entries(TEMPORAL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </header>

      {notice && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="ml-2 font-bold">×</button>
        </div>
      )}
      {error && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-2 font-bold">×</button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 gap-4">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto sidebar-scrollbar rounded-2xl border border-gray-200/70 bg-white/85 dark:border-white/[0.08] dark:bg-white/[0.03]">
            {loading ? (
              <p className="p-4 text-sm text-gray-500 dark:text-white/50">Cargando registro...</p>
            ) : decisions.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500 dark:text-white/50">
                <p className="font-semibold">Sin decisiones registradas.</p>
                <p className="mt-1 text-xs">
                  Las decisiones aprobadas en reuniones se registran aqui automaticamente.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {decisions.map((decision) => (
                  <li key={decision.id}>
                    <button
                      onClick={() => void abrirDetalle(decision.id)}
                      className={`w-full px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.04] ${
                        detalle?.decision.id === decision.id ? 'bg-accent/5 dark:bg-accent/10' : ''
                      }`}
                    >
                      <p className="text-sm font-semibold text-gray-800 dark:text-white/90">{decision.statement}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-white/50">
                        <span className={`rounded-full px-2 py-0.5 font-semibold ${authorityChipClass(decision.authority_status)}`}>
                          {AUTHORITY_LABELS[decision.authority_status]}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 font-semibold ${temporalChipClass(decision.temporal_status)}`}>
                          {TEMPORAL_LABELS[decision.temporal_status]}
                        </span>
                        <span>Owner: {decision.decision_owner || 'sin asignar'}</span>
                        <span>{formatearFechaCorta(decision.created_at)}</span>
                        {decision.extracted_by === 'ia' && <span className="italic">extraida por IA</span>}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-3 rounded-2xl border border-gray-200/70 bg-white/85 p-3 dark:border-white/[0.08] dark:bg-white/[0.03]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-gray-600 dark:text-white/60">Tarjeta de contexto:</span>
              <input
                value={sujetoTarjeta}
                onChange={(event) => setSujetoTarjeta(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') void generarTarjeta(); }}
                placeholder="Sujeto (persona, proyecto, cliente)..."
                className="flex-1 min-w-[180px] rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-800 focus:border-accent focus:outline-none dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
              />
              <button
                disabled={busy || !sujetoTarjeta.trim()}
                onClick={() => void generarTarjeta()}
                className="rounded-lg bg-[#0A2540] px-3 py-1.5 text-xs font-bold text-white transition-all hover:bg-[#0D2F4D] disabled:opacity-50 dark:bg-accent dark:text-on-accent"
              >
                Generar
              </button>
              {tarjeta && (
                <button
                  onClick={() => setTarjeta(null)}
                  className="rounded-lg px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-100 dark:text-white/50 dark:hover:bg-white/[0.06]"
                >
                  Limpiar
                </button>
              )}
            </div>
            {tarjeta && (
              <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-xs text-gray-700 dark:bg-white/[0.04] dark:text-white/70">
                {tarjeta}
              </pre>
            )}
          </div>
        </div>

        {detalle && (
          <div className="w-[380px] min-w-[320px] max-w-[45%]">
            <DetalleDecision
              decision={detalle.decision}
              approvals={detalle.approvals}
              audit={detalle.audit}
              busy={busy}
              onApprove={(comment) => decidir('aprobar', comment)}
              onReject={(comment) => decidir('rechazar', comment)}
              onGenerateRecord={generarRecord}
              onClose={() => setDetalle(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
