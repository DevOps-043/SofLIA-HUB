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
      if (!window.whatsApp) {
        throw new Error('Servicio de WhatsApp no disponible en este entorno.');
      }
      // Use the user's own WhatsApp number (the connected one)
      const waStatus = await window.whatsApp.getStatus();
      const phoneNumber = waStatus?.phoneNumber || '';
      if (!phoneNumber) {
        throw new Error('No se detectó un número de WhatsApp activo. ¿Está conectado?');
      }
      await sendSummaryViaWhatsApp(phoneNumber, `*Resumen de Productividad — ${selectedDate}*\n\n${summary.aiSummary}`);
      setSent(true);
      setTimeout(() => setSent(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="relative overflow-hidden group/summary">
      {/* Decorative Gradient */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
      
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-white text-lg font-black tracking-tight">Resumen Inteligente</h3>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">Análisis con Inteligencia Artificial</p>
          </div>
          {summary?.aiSummary && (
            <div className="flex items-center gap-2 px-3 py-1 bg-violet-500/10 border border-violet-500/20 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
              </span>
              <span className="text-[10px] font-black text-violet-400 uppercase tracking-widest">Optimizado con IA</span>
            </div>
          )}
        </div>

        {!summary ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center border border-white/10 shadow-inner group-hover/summary:scale-110 group-hover/summary:rotate-3 transition-all duration-500">
              <svg className="w-10 h-10 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="max-w-xs transition-all">
              <p className="text-sm text-gray-400 font-medium leading-relaxed">
                {logs.length > 0
                  ? 'Hemos analizado tu actividad. Haz clic para generar un resumen detallado con SofLIA AI.'
                  : 'Aún no hay actividad suficiente para generar un análisis. Inicia un monitoreo para comenzar.'}
              </p>
            </div>
            {logs.length > 0 && (
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="group/gen relative overflow-hidden px-8 py-3.5 rounded-2xl bg-white text-black text-xs font-black uppercase tracking-widest transition-all hover:scale-[1.05] active:scale-[0.98] shadow-2xl hover:shadow-white/10"
              >
                <div className="absolute inset-0 bg-violet-600 translate-y-full group-hover/gen:translate-y-0 transition-transform duration-500"></div>
                <span className="relative z-10 flex items-center gap-2 group-hover/gen:text-white transition-colors duration-300">
                  {generating ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      Analizando...
                    </>
                  ) : 'Generar Análisis IA'}
                </span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-10 animate-in fade-in zoom-in-95 duration-700">
            {/* AI Text Block */}
            <div className="relative group/text">
              <div className="absolute -left-4 top-0 bottom-0 w-1 bg-violet-600/30 rounded-full group-hover/text:bg-violet-600 transition-colors"></div>
              <div className="max-h-100 overflow-y-auto pr-4 custom-scrollbar">
                <p className="text-base text-gray-200 whitespace-pre-line leading-loose font-medium italic">
                  "{summary.aiSummary}"
                </p>
              </div>
            </div>

            {/* Structured Insights Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Projects */}
              {summary.projectsDetected && summary.projectsDetected.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Proyectos en Enfoque</h4>
                  <div className="flex flex-wrap gap-2">
                    {summary.projectsDetected.map((proj: any, i: number) => (
                      <div
                        key={i}
                        className="group/tag px-4 py-2 rounded-xl bg-blue-500/5 border border-blue-500/10 hover:bg-blue-500 hover:text-white transition-all duration-300"
                      >
                        <span className="text-[10px] font-black uppercase tracking-tight">
                          {proj.projectName || proj.name}
                        </span>
                        {proj.timeSeconds > 0 && (
                          <span className="ml-2 text-[9px] font-bold opacity-50 group-hover/tag:opacity-100">
                             {formatSeconds(proj.timeSeconds)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Apps Snapshot */}
              {summary.topApps && summary.topApps.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Herramientas Clave</h4>
                  <div className="flex flex-wrap gap-2">
                    {summary.topApps.slice(0, 4).map((app: any, i: number) => (
                      <div
                        key={i}
                        className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-[10px] font-bold text-gray-400"
                      >
                        {app.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Premium Footer Actions */}
            <div className="pt-8 border-t border-white/5 flex flex-wrap gap-4 items-center justify-between">
              <div className="flex gap-4">
                 <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="flex items-center gap-2 p-2 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white hover:bg-white/5 transition-all"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-3.5 w-3.5 ${generating ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Actualizar Análisis
                </button>
              </div>

              <button
                onClick={handleSendWhatsApp}
                disabled={sending}
                className={`group/wa relative overflow-hidden flex items-center gap-2 px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-[0.98] ${
                  sent
                    ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                    : 'bg-[#25D366] text-white shadow-[0_0_20px_rgba(37,211,102,0.2)] hover:shadow-[#25D366]/40 hover:-translate-y-0.5'
                }`}
              >
                <div className="absolute inset-0 bg-white/10 translate-x-full group-hover/wa:translate-x-0 transition-transform duration-500"></div>
                {sent ? (
                   <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                     <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 14.14L8.707 15.414a1 1 0 01-1.414 0L4.293 12.707a1 1 0 011.414-1.414L8 13.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                   </svg>
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                )}
                <span className="relative z-10">{sent ? 'Análisis Enviado' : sending ? 'Preparando...' : 'Compartir en WhatsApp'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="absolute bottom-4 left-8 right-8 p-3 bg-red-500/10 border border-red-500/20 rounded-xl animate-bounce">
          <p className="text-[10px] text-red-500 font-black text-center uppercase tracking-widest">{error}</p>
        </div>
      )}
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
