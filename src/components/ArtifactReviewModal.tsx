import { useState, useCallback } from 'react';

/* ── Types ── */
export interface PendingApproval {
  artifact_id: string;
  step_run_id: string;
  run_id: string;
  trace_id: string;
  step_key: string;
  step_name: string;
  artifact_type: string;
  ai_output_raw: string | null;
  qa_result: { passed: boolean; issues: string[] } | null;
  sla_due_at: string | null;
  assigned_to: string | null;
  workflow_name: string;
  trigger_type: string;
  context_data: Record<string, any>;
  created_at: string;
}

interface ArtifactReviewModalProps {
  approval: PendingApproval;
  onClose: () => void;
  onDecision: (decision: string) => void;
  userId: string;
}

/* ── Helpers ── */
const ARTIFACT_ICONS: Record<string, string> = {
  email_draft: '\u2709\uFE0F',
  whatsapp_message: '\uD83D\uDCAC',
  iris_task: '\uD83D\uDCCB',
  meeting_agenda: '\uD83D\uDCC5',
  proposal_brief: '\uD83D\uDCC4',
  entity_extraction: '\uD83D\uDCCA',
};

const ARTIFACT_LABELS: Record<string, string> = {
  email_draft: 'Borrador de Email',
  whatsapp_message: 'Mensaje WhatsApp',
  iris_task: 'Tarea Iris',
  meeting_agenda: 'Agenda de Reunión',
  proposal_brief: 'Brief de Propuesta',
  entity_extraction: 'Extracción de Entidades',
};

/* ── Component ── */
export function ArtifactReviewModal({ approval, onClose, onDecision, userId }: ArtifactReviewModalProps) {
  const [editedContent, setEditedContent] = useState(approval.ai_output_raw ?? '');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionType, setActionType] = useState<string | null>(null);

  const icon = ARTIFACT_ICONS[approval.artifact_type] ?? '\uD83D\uDCC4';
  const typeLabel = ARTIFACT_LABELS[approval.artifact_type] ?? approval.artifact_type;

  const rawInput = approval.context_data?.raw_input ?? approval.context_data?.input ?? null;

  const requiresReason = actionType === 'rejected' || actionType === 'changes_requested';

  const handleSubmit = useCallback(
    async (decision: string) => {
      if ((decision === 'rejected' || decision === 'changes_requested') && !reason.trim()) {
        setActionType(decision);
        return;
      }

      setSubmitting(true);
      try {
        await (window as any).workflow.submitApproval({
          artifact_id: approval.artifact_id,
          step_run_id: approval.step_run_id,
          run_id: approval.run_id,
          decision,
          reviewer_id: userId,
          human_edit: decision === 'approved_with_edits' ? editedContent : undefined,
          reason: reason.trim() || undefined,
        });
        onDecision(decision);
      } catch (err) {
        console.error('[ArtifactReviewModal] Error submitting approval:', err);
      } finally {
        setSubmitting(false);
      }
    },
    [approval, userId, editedContent, reason, onDecision],
  );

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-[640px] max-w-[95vw] max-h-[90vh] flex flex-col bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header accent */}
        <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-indigo-500" />

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-white/10">
          <span className="text-2xl">{icon}</span>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
              {approval.step_name}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {approval.workflow_name} &middot; {typeLabel}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-gray-400"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* QA warnings */}
          {approval.qa_result && !approval.qa_result.passed && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-2 mb-1.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                  Advertencias de QA
                </span>
              </div>
              <ul className="space-y-1">
                {approval.qa_result.issues.map((issue, i) => (
                  <li key={i} className="text-xs text-amber-700 dark:text-amber-300">
                    &bull; {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Source context */}
          {rawInput && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold mb-1.5">
                Contexto original
              </div>
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap max-h-40 overflow-y-auto">
                {typeof rawInput === 'string' ? rawInput : JSON.stringify(rawInput, null, 2)}
              </div>
            </div>
          )}

          {/* AI-generated content */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold mb-1.5">
              Contenido generado por IA
            </div>
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/20 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap max-h-48 overflow-y-auto">
              {approval.ai_output_raw ?? <span className="italic text-gray-400">Sin contenido generado</span>}
            </div>
          </div>

          {/* Editable textarea */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold mb-1.5">
              Editar contenido (opcional)
            </div>
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              rows={6}
              className="w-full p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-800 dark:text-gray-200 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500/40 placeholder-gray-400"
              placeholder="Puedes editar el contenido antes de aprobar..."
            />
          </div>

          {/* Reason textarea (shown when reject/changes requested) */}
          {requiresReason && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold mb-1.5">
                Motivo <span className="text-red-500">*</span>
              </div>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-red-300 dark:border-red-500/30 text-sm text-gray-800 dark:text-gray-200 resize-y focus:outline-none focus:ring-2 focus:ring-red-500/40 placeholder-gray-400"
                placeholder="Explica por qué rechazas o solicitas cambios..."
                autoFocus
              />
            </div>
          )}

          {/* Reason for non-required cases */}
          {!requiresReason && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold mb-1.5">
                Comentario (opcional)
              </div>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="w-full p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-800 dark:text-gray-200 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500/40 placeholder-gray-400"
                placeholder="Agrega un comentario opcional..."
              />
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 px-6 py-4 border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02]">
          <button
            onClick={() => handleSubmit('rejected')}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-red-500/20 disabled:opacity-50"
          >
            Rechazar
          </button>
          <button
            onClick={() => handleSubmit('changes_requested')}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-amber-900 dark:text-amber-100 bg-amber-400 hover:bg-amber-500 rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-amber-400/20 disabled:opacity-50"
          >
            Pedir Contexto
          </button>
          <div className="flex-1" />
          <button
            onClick={() => handleSubmit('approved_with_edits')}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-blue-500/20 disabled:opacity-50"
          >
            Editar y Aprobar
          </button>
          <button
            onClick={() => handleSubmit('approved')}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-white bg-green-500 hover:bg-green-600 rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-green-500/20 disabled:opacity-50"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Enviando...
              </span>
            ) : (
              'Aprobar'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
