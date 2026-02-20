import { useState } from 'react';
import type { DailySummary, ActivityLog } from '../../core/entities/ActivityLog';
import { generateSummaryForSession, sendSummaryViaWhatsApp } from '../../services/monitoring-service';

interface SummaryCardProps {
  summary: DailySummary | null;
  userId: string;
  logs: ActivityLog[];
  selectedDate: string;
  onSummaryGenerated: (summary: DailySummary) => void;
}

export function SummaryCard({ summary, userId, logs, selectedDate, onSummaryGenerated }: SummaryCardProps) {
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleGenerate = async () => {
    if (logs.length === 0) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await generateSummaryForSession(
        userId,
        '',
        logs,
        { startedAt: `${selectedDate}T00:00:00Z`, triggerType: 'manual' },
      );
      onSummaryGenerated({
        userId,
        date: selectedDate,
        totalTimeSeconds: result.totalTimeSeconds || 0,
        productiveTimeSeconds: result.productiveTimeSeconds || 0,
        unproductiveTimeSeconds: 0,
        idleTimeSeconds: result.idleTimeSeconds || 0,
        topApps: result.topApps || [],
        aiSummary: result.summaryText,
        projectsDetected: result.projectsDetected?.map((p: string) => ({ projectId: '', projectName: p, timeSeconds: 0 })) || [],
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!summary?.aiSummary) return;
    setSending(true);
    setError(null);
    try {
      // Use the user's own WhatsApp number (the connected one)
      const status = await window.monitoring.getStatus();
      const phoneNumber = (status as any)?.phoneNumber || '';
      if (!phoneNumber) {
        // Send to renderer to let user pick — for now just use a generic approach
        await sendSummaryViaWhatsApp('', `*Resumen de Productividad — ${selectedDate}*\n\n${summary.aiSummary}`);
      } else {
        await sendSummaryViaWhatsApp(phoneNumber, `*Resumen de Productividad — ${selectedDate}*\n\n${summary.aiSummary}`);
      }
      setSent(true);
      setTimeout(() => setSent(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Resumen del dia</h3>
        <div className="flex items-center gap-2">
          {summary?.aiSummary && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400 font-medium">
              AI
            </span>
          )}
        </div>
      </div>

      {!summary ? (
        <div className="text-center py-6">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
            {logs.length > 0
              ? 'Hay actividad registrada. Genera un resumen con AI.'
              : 'Sin resumen disponible. Completa una sesion de monitoreo para generar uno.'}
          </p>
          {logs.length > 0 && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="text-xs px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white transition-colors disabled:opacity-50"
            >
              {generating ? 'Generando...' : 'Generar resumen AI'}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {formatSeconds(summary.totalTimeSeconds)}
              </p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500">Total</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {formatSeconds(summary.productiveTimeSeconds)}
              </p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500">Productivo</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-gray-400 dark:text-gray-500">
                {formatSeconds(summary.idleTimeSeconds)}
              </p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500">Inactivo</p>
            </div>
          </div>

          {/* AI Summary */}
          {summary.aiSummary && (
            <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-3">
              <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                {summary.aiSummary}
              </p>
            </div>
          )}

          {/* Projects detected */}
          {summary.projectsDetected && summary.projectsDetected.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold mb-2">
                Proyectos detectados
              </p>
              <div className="flex flex-wrap gap-1.5">
                {summary.projectsDetected.map((proj: any, i: number) => (
                  <span
                    key={i}
                    className="text-[10px] px-2 py-1 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-medium"
                  >
                    {proj.projectName || proj.name}
                    {proj.timeSeconds && ` (${formatSeconds(proj.timeSeconds)})`}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Top apps */}
          {summary.topApps && summary.topApps.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold mb-2">
                Top aplicaciones
              </p>
              <div className="flex flex-wrap gap-1.5">
                {summary.topApps.slice(0, 5).map((app: any, i: number) => (
                  <span
                    key={i}
                    className="text-[10px] px-2 py-1 rounded-full bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400"
                  >
                    {app.name} — {formatSeconds(app.duration || app.durationSeconds)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-white/5">
            <button
              onClick={handleGenerate}
              disabled={generating || logs.length === 0}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium bg-violet-50 text-violet-600 hover:bg-violet-100 dark:bg-violet-900/20 dark:text-violet-400 dark:hover:bg-violet-900/30 transition-colors disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-3.5 w-3.5 ${generating ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {generating ? 'Generando...' : 'Regenerar'}
            </button>
            {summary.aiSummary && (
              <button
                onClick={handleSendWhatsApp}
                disabled={sending}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                  sent
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                    : 'bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30'
                }`}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                {sent ? 'Enviado' : sending ? 'Enviando...' : 'WhatsApp'}
              </button>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-500 mt-2 text-center">{error}</p>}
    </div>
  );
}

function formatSeconds(seconds: number): string {
  if (!seconds || seconds === 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
