import { useState } from 'react';
import type { SdoApproval, SdoAuditEvent, SdoDecision } from '../../services/sdo-service';
import {
  AUTHORITY_LABELS,
  authorityChipClass,
  EPISTEMIC_LABELS,
  epistemicChipClass,
  formatearFechaCorta,
  TEMPORAL_LABELS,
  temporalChipClass,
} from './sdo-ui-helpers';

interface DetalleDecisionProps {
  decision: SdoDecision;
  approvals: SdoApproval[];
  audit: SdoAuditEvent[];
  busy: boolean;
  onApprove: (comment: string) => Promise<void>;
  onReject: (comment: string) => Promise<void>;
  onGenerateRecord: () => Promise<void>;
  onClose: () => void;
}

export function DetalleDecision(props: DetalleDecisionProps) {
  const { decision } = props;
  const [comment, setComment] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);
  const puedeDecidir = decision.authority_status !== 'aprobado' && decision.authority_status !== 'rechazado';

  const handleReject = async () => {
    if (!comment.trim()) {
      setRejectError('Para rechazar es obligatorio un comentario con la razon.');
      return;
    }
    setRejectError(null);
    await props.onReject(comment.trim());
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto sidebar-scrollbar rounded-2xl border border-gray-200/70 bg-white/85 p-5 dark:border-white/[0.08] dark:bg-white/[0.03]">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-bold text-[#0A2540] dark:text-white">{decision.statement}</h3>
        <button
          onClick={props.onClose}
          className="rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:text-white/50 dark:hover:bg-white/[0.06]"
        >
          Cerrar
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${epistemicChipClass(decision.epistemic_status)}`}>
          {EPISTEMIC_LABELS[decision.epistemic_status]}
        </span>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${authorityChipClass(decision.authority_status)}`}>
          {AUTHORITY_LABELS[decision.authority_status]}
        </span>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${temporalChipClass(decision.temporal_status)}`}>
          {TEMPORAL_LABELS[decision.temporal_status]}
        </span>
        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-white/[0.06] dark:text-white/60">
          {decision.confidentiality}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-gray-600 dark:text-white/70">
        <div>
          <dt className="font-semibold text-gray-500 dark:text-white/50">Decision Owner</dt>
          <dd>{decision.decision_owner || 'Sin asignar'}</dd>
        </div>
        <div>
          <dt className="font-semibold text-gray-500 dark:text-white/50">Origen</dt>
          <dd>{decision.origin_system ? `${decision.origin_system} (${decision.origin_ref || '—'})` : 'Manual'}</dd>
        </div>
        <div>
          <dt className="font-semibold text-gray-500 dark:text-white/50">Aprobada por</dt>
          <dd>{decision.approved_by_user_id || 'Pendiente'}</dd>
        </div>
        <div>
          <dt className="font-semibold text-gray-500 dark:text-white/50">Vigencia</dt>
          <dd>
            {formatearFechaCorta(decision.valid_from)} → {formatearFechaCorta(decision.valid_until)}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-gray-500 dark:text-white/50">Proxima revision</dt>
          <dd>{formatearFechaCorta(decision.review_due)}</dd>
        </div>
        <div>
          <dt className="font-semibold text-gray-500 dark:text-white/50">Extraida por</dt>
          <dd>
            {decision.extracted_by === 'ia'
              ? `IA${decision.model_version ? ` (${decision.model_version})` : ''}${decision.confidence != null ? ` · confianza ${Math.round(decision.confidence * 100)}%` : ''}`
              : 'Humano'}
          </dd>
        </div>
      </dl>

      {decision.communication_rule && (
        <div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          <span className="font-semibold">Restriccion de comunicacion:</span> {decision.communication_rule}
        </div>
      )}

      <div className="mt-4">
        <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-white/50">Evidencia</h4>
        {decision.source_refs.length === 0 ? (
          <p className="mt-1 text-xs text-gray-500 dark:text-white/50">Sin evidencia registrada — tratar como inferido.</p>
        ) : (
          <ul className="mt-1 space-y-1.5">
            {decision.source_refs.map((ref, index) => (
              <li key={index} className="rounded-lg bg-gray-50 p-2 text-xs text-gray-700 dark:bg-white/[0.04] dark:text-white/70">
                {ref.excerpt ? `“${ref.excerpt}”` : 'Referencia sin cita'}
                {ref.locator && <span className="ml-1 text-gray-400 dark:text-white/40">[{ref.locator.tipo} {ref.locator.valor}]</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {puedeDecidir && (
        <div className="mt-4 rounded-xl border border-gray-200/70 p-3 dark:border-white/[0.08]">
          <label className="text-xs font-semibold text-gray-600 dark:text-white/60">Comentario (obligatorio al rechazar)</label>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white p-2 text-xs text-gray-800 focus:border-accent focus:outline-none dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
            placeholder="Contexto de la decision de aprobar o rechazar..."
          />
          {rejectError && <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{rejectError}</p>}
          <div className="mt-2 flex gap-2">
            <button
              disabled={props.busy}
              onClick={() => props.onApprove(comment.trim())}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
            >
              Aprobar
            </button>
            <button
              disabled={props.busy}
              onClick={handleReject}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white transition-all hover:bg-red-700 disabled:opacity-50"
            >
              Rechazar
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          disabled={props.busy}
          onClick={props.onGenerateRecord}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-all hover:bg-gray-100 disabled:opacity-50 dark:border-white/[0.08] dark:text-white/70 dark:hover:bg-white/[0.05]"
        >
          Generar decision record (PDF)
        </button>
      </div>

      {props.approvals.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-white/50">Aprobaciones</h4>
          <ul className="mt-1 space-y-1 text-xs text-gray-600 dark:text-white/60">
            {props.approvals.map((approval) => (
              <li key={approval.id}>
                {formatearFechaCorta(approval.decided_at)} — <span className="font-semibold">{approval.decision}</span> por {approval.decided_by_user_id}
                {approval.comment ? `: “${approval.comment}”` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {props.audit.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-white/50">Bitacora</h4>
          <ul className="mt-1 space-y-1 text-xs text-gray-500 dark:text-white/50">
            {props.audit.slice(0, 12).map((evento) => (
              <li key={evento.id}>
                {formatearFechaCorta(evento.created_at)} — {evento.event_type} ({evento.actor_type}
                {evento.actor_id ? `: ${evento.actor_id}` : ''}){evento.reason ? ` — ${evento.reason}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
