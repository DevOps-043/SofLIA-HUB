import { useState, useCallback } from 'react';
import { WorkflowTimeline } from './WorkflowTimeline';

/* ── Types ── */
interface MeetingWorkflowTriggerProps {
  userId: string;
  organizationId?: string;
  onRunCreated?: (runId: string) => void;
}

type MeetingType = 'fisica' | 'virtual' | 'llamada';

const MEETING_TYPES: { value: MeetingType; label: string; icon: string }[] = [
  { value: 'fisica', label: 'Física', icon: '\uD83C\uDFE2' },
  { value: 'virtual', label: 'Virtual', icon: '\uD83D\uDCBB' },
  { value: 'llamada', label: 'Llamada', icon: '\uD83D\uDCDE' },
];

/* ── Component ── */
export function MeetingWorkflowTrigger({ userId, organizationId, onRunCreated }: MeetingWorkflowTriggerProps) {
  const [meetingType, setMeetingType] = useState<MeetingType>('virtual');
  const [rawNotes, setRawNotes] = useState('');
  const [companyHint, setCompanyHint] = useState('');
  const [contactHint, setContactHint] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdRunId, setCreatedRunId] = useState<string | null>(null);

  const canSubmit = rawNotes.trim().length > 0 && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    try {
      const result = await (window as any).workflow.startRun({
        definitionSlug: 'meeting_followup',
        userId,
        organizationId,
        triggerType: 'manual',
        contextData: {
          raw_input: rawNotes.trim(),
          meeting_type: meetingType,
          company_hint: companyHint.trim() || undefined,
          contact_hint: contactHint.trim() || undefined,
        },
      });

      const runId = result?.run_id ?? result?.runId;
      if (runId) {
        setCreatedRunId(runId);
        onRunCreated?.(runId);
      }
    } catch (err: any) {
      console.error('[MeetingWorkflowTrigger] Error starting workflow:', err);
      setError(err?.message ?? 'Error al iniciar el workflow');
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, rawNotes, meetingType, companyHint, contactHint, userId, organizationId, onRunCreated]);

  const handleReset = useCallback(() => {
    setCreatedRunId(null);
    setRawNotes('');
    setCompanyHint('');
    setContactHint('');
    setError(null);
  }, []);

  /* ── Show timeline after creation ── */
  if (createdRunId) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Workflow iniciado
          </h2>
          <button
            onClick={handleReset}
            className="text-sm text-blue-500 hover:text-blue-400 underline"
          >
            Nueva reunión
          </button>
        </div>
        <WorkflowTimeline runId={createdRunId} />
      </div>
    );
  }

  /* ── Form ── */
  return (
    <div className="bg-white dark:bg-[#111111] text-gray-900 dark:text-gray-100 rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
      {/* Header accent */}
      <div className="h-1 w-full bg-gradient-to-r from-indigo-500 to-purple-500" />

      <div className="p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold">Seguimiento de Reunión</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Inicia el workflow de seguimiento post-reunión
          </p>
        </div>

        {/* Meeting type selector */}
        <div>
          <label className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold block mb-2">
            Tipo de reunión
          </label>
          <div className="flex gap-2">
            {MEETING_TYPES.map((mt) => (
              <button
                key={mt.value}
                onClick={() => setMeetingType(mt.value)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  meetingType === mt.value
                    ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400'
                    : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10'
                }`}
              >
                <span>{mt.icon}</span>
                <span>{mt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Raw notes */}
        <div>
          <label className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold block mb-2">
            Notas de la reunión <span className="text-red-500">*</span>
          </label>
          <textarea
            value={rawNotes}
            onChange={(e) => setRawNotes(e.target.value)}
            rows={6}
            placeholder="Pega aquí las notas de tu reunión..."
            className="w-full p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-800 dark:text-gray-200 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500/40 placeholder-gray-400"
          />
        </div>

        {/* Optional hints */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold block mb-2">
              Empresa (opcional)
            </label>
            <input
              type="text"
              value={companyHint}
              onChange={(e) => setCompanyHint(e.target.value)}
              placeholder="Nombre de la empresa"
              className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 placeholder-gray-400"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold block mb-2">
              Contacto (opcional)
            </label>
            <input
              type="text"
              value={contactHint}
              onChange={(e) => setContactHint(e.target.value)}
              placeholder="Nombre del contacto"
              className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 placeholder-gray-400"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full py-3 rounded-xl text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Iniciando workflow...
            </>
          ) : (
            'Iniciar Seguimiento'
          )}
        </button>
      </div>
    </div>
  );
}
