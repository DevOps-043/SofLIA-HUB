import { useState, useEffect, useCallback } from 'react';

declare global {
  interface Window {
    autodev?: {
      getConfig: () => Promise<any>;
      updateConfig: (updates: any) => Promise<any>;
      runNow: () => Promise<any>;
      abort: () => Promise<any>;
      getStatus: () => Promise<any>;
      getHistory: () => Promise<any>;
      onRunStarted: (cb: (run: any) => void) => void;
      onRunCompleted: (cb: (run: any) => void) => void;
      onStatusChanged: (cb: (data: any) => void) => void;
      removeListeners: () => void;
    };
  }
}

interface AutoDevPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORY_INFO: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  security: { label: 'Seguridad', icon: '🔒', color: 'text-red-400', bg: 'border-red-500/30 bg-red-500/10' },
  quality: { label: 'Calidad', icon: '✨', color: 'text-blue-400', bg: 'border-blue-500/30 bg-blue-500/10' },
  performance: { label: 'Rendimiento', icon: '⚡', color: 'text-amber-400', bg: 'border-amber-500/30 bg-amber-500/10' },
  dependencies: { label: 'Dependencias', icon: '📦', color: 'text-emerald-400', bg: 'border-emerald-500/30 bg-emerald-500/10' },
  tests: { label: 'Tests', icon: '🧪', color: 'text-purple-400', bg: 'border-purple-500/30 bg-purple-500/10' },
};

const QUICK_TIMES = [
  { label: '12:00 AM', hour: 0 },
  { label: '3:00 AM', hour: 3 },
  { label: '6:00 AM', hour: 6 },
  { label: '9:00 AM', hour: 9 },
  { label: '12:00 PM', hour: 12 },
  { label: '3:00 PM', hour: 15 },
  { label: '6:00 PM', hour: 18 },
  { label: '9:00 PM', hour: 21 },
];

const DAYS_OF_WEEK = [
  { label: 'L', cron: '1', name: 'Lunes' },
  { label: 'M', cron: '2', name: 'Martes' },
  { label: 'X', cron: '3', name: 'Miércoles' },
  { label: 'J', cron: '4', name: 'Jueves' },
  { label: 'V', cron: '5', name: 'Viernes' },
  { label: 'S', cron: '6', name: 'Sábado' },
  { label: 'D', cron: '0', name: 'Domingo' },
];

const STATUS_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  researching: { label: 'Investigando...', color: 'text-blue-400', icon: '🔍' },
  analyzing: { label: 'Analizando código...', color: 'text-cyan-400', icon: '📊' },
  planning: { label: 'Planificando mejoras...', color: 'text-indigo-400', icon: '📋' },
  coding: { label: 'Programando...', color: 'text-emerald-400', icon: '💻' },
  verifying: { label: 'Verificando build...', color: 'text-amber-400', icon: '🔄' },
  pushing: { label: 'Creando PR...', color: 'text-purple-400', icon: '📤' },
  completed: { label: 'Completado', color: 'text-emerald-400', icon: '✅' },
  failed: { label: 'Falló', color: 'text-red-400', icon: '❌' },
  aborted: { label: 'Abortado', color: 'text-gray-400', icon: '⏹️' },
};

const STATUS_PROGRESS: Record<string, number> = {
  researching: 15,
  analyzing: 35,
  planning: 50,
  coding: 70,
  verifying: 85,
  pushing: 95,
  completed: 100,
  failed: 100,
  aborted: 100,
};

/** Parse a cron schedule "M H * * DOW" into {hour, minute, days} */
function parseCron(cron: string): { hour: number; minute: number; days: string[] } {
  const parts = cron.split(' ');
  const minute = parseInt(parts[0]) || 0;
  const hour = parseInt(parts[1]) || 0;
  const dowPart = parts[4] || '*';
  const days = dowPart === '*' ? ['*'] : dowPart.split(',');
  return { hour, minute, days };
}

/** Build a cron string from hour, minute, days */
function buildCron(hour: number, minute: number, days: string[]): string {
  const dow = days.includes('*') || days.length === 0 || days.length === 7 ? '*' : days.join(',');
  return `${minute} ${hour} * * ${dow}`;
}

function formatDuration(startedAt: string, completedAt?: string): string {
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const mins = Math.round((end - start) / 60000);
  if (mins < 1) return '<1 min';
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function AutoDevPanel({ isOpen, onClose }: AutoDevPanelProps) {
  const [config, setConfig] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'schedule' | 'config' | 'history'>('schedule');

  // Custom time picker state
  const [customHour, setCustomHour] = useState(3);
  const [customMinute, setCustomMinute] = useState(0);
  const [selectedDays, setSelectedDays] = useState<string[]>(['*']);

  const loadData = useCallback(async () => {
    if (!window.autodev) return;
    try {
      const [configRes, statusRes, historyRes] = await Promise.all([
        window.autodev.getConfig(),
        window.autodev.getStatus(),
        window.autodev.getHistory(),
      ]);
      if (configRes.success) {
        setConfig(configRes.config);
        const parsed = parseCron(configRes.config.cronSchedule);
        setCustomHour(parsed.hour);
        setCustomMinute(parsed.minute);
        setSelectedDays(parsed.days);
      }
      if (statusRes.success) setStatus(statusRes);
      if (historyRes.success) setHistory(historyRes.history || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    loadData();

    window.autodev?.onRunStarted(() => loadData());
    window.autodev?.onRunCompleted(() => loadData());
    window.autodev?.onStatusChanged(() => loadData());

    return () => {
      window.autodev?.removeListeners();
    };
  }, [isOpen, loadData]);

  const updateConfig = async (updates: any) => {
    if (!window.autodev) return;
    setSaving(true);
    try {
      const res = await window.autodev.updateConfig(updates);
      if (res.success) setConfig(res.config);
    } catch { /* ignore */ }
    setTimeout(() => setSaving(false), 500);
  };

  const handleTimeChange = (hour: number, minute: number, days?: string[]) => {
    const d = days || selectedDays;
    setCustomHour(hour);
    setCustomMinute(minute);
    const cron = buildCron(hour, minute, d);
    updateConfig({ cronSchedule: cron });
  };

  const handleDayToggle = (day: string) => {
    let newDays: string[];
    if (day === '*') {
      newDays = ['*'];
    } else {
      const current = selectedDays.filter(d => d !== '*');
      if (current.includes(day)) {
        newDays = current.filter(d => d !== day);
        if (newDays.length === 0) newDays = ['*'];
      } else {
        newDays = [...current, day];
        if (newDays.length === 7) newDays = ['*'];
      }
    }
    setSelectedDays(newDays);
    handleTimeChange(customHour, customMinute, newDays);
  };

  const handleRunNow = async () => {
    if (!window.autodev) return;
    await window.autodev.runNow();
    setTimeout(loadData, 1000);
  };

  const handleAbort = async () => {
    if (!window.autodev) return;
    await window.autodev.abort();
    setTimeout(loadData, 1000);
  };

  const toggleCategory = (cat: string) => {
    if (!config) return;
    const cats = config.categories || [];
    const updated = cats.includes(cat) ? cats.filter((c: string) => c !== cat) : [...cats, cat];
    updateConfig({ categories: updated });
  };

  if (!isOpen) return null;

  const formatTime = (h: number, m: number) => {
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
  };

  const nextRunText = () => {
    if (!config?.enabled) return 'Deshabilitado';
    const parsed = parseCron(config.cronSchedule);
    const daysText = parsed.days.includes('*')
      ? 'Todos los días'
      : parsed.days.map((d: string) => DAYS_OF_WEEK.find(dw => dw.cron === d)?.name || d).join(', ');
    return `${formatTime(parsed.hour, parsed.minute)} — ${daysText}`;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center" onClick={onClose}>
      <div
        className="w-[700px] max-h-[85vh] bg-sidebar rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
              <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
              </svg>
            </div>
            <div>
              <h2 className="text-white text-lg font-semibold">AutoDev</h2>
              <p className="text-xs text-gray-400">Programación autónoma con IA multi-agente</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {saving && (
              <span className="text-xs text-accent animate-pulse">Guardando...</span>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Status Banner (always visible when running) */}
        {status?.running && status.currentRun && (
          <div className="px-6 py-3 bg-accent/5 border-b border-white/5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
                <span className={`text-sm font-medium ${STATUS_LABELS[status.currentRun.status]?.color || 'text-white'}`}>
                  {STATUS_LABELS[status.currentRun.status]?.icon} {STATUS_LABELS[status.currentRun.status]?.label || status.currentRun.status}
                </span>
              </div>
              <button
                onClick={handleAbort}
                className="px-3 py-1.5 text-xs font-medium text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors"
              >
                Abortar
              </button>
            </div>
            {/* Progress bar */}
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${STATUS_PROGRESS[status.currentRun.status] || 0}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-500 mt-1.5">
              {status.currentRun.agentTasks?.length || 0} agentes · {status.currentRun.improvements?.length || 0} mejoras · {status.currentRun.researchFindings?.length || 0} hallazgos · {formatDuration(status.currentRun.startedAt)}
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex px-6 pt-2 gap-1 border-b border-white/5">
          {[
            { key: 'schedule' as const, label: 'Programar' },
            { key: 'config' as const, label: 'Configuración' },
            { key: 'history' as const, label: `Historial (${history.length})` },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
                <div className="w-2 h-2 bg-accent rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                <div className="w-2 h-2 bg-accent rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          ) : config ? (
            <>
              {/* ═══ SCHEDULE TAB ═══ */}
              {activeTab === 'schedule' && (
                <div className="space-y-6">
                  {/* Enable + Run Now */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => updateConfig({ enabled: !config.enabled })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          config.enabled ? 'bg-accent' : 'bg-white/10'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          config.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                      <div>
                        <span className="text-sm text-white font-medium">
                          {config.enabled ? 'Habilitado' : 'Deshabilitado'}
                        </span>
                        {config.enabled && (
                          <p className="text-[11px] text-gray-500">{nextRunText()}</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={handleRunNow}
                      disabled={status?.running}
                      className="px-4 py-2 text-sm font-medium bg-accent text-primary rounded-lg hover:bg-accent/90 disabled:opacity-60 transition-colors"
                    >
                      {status?.running ? 'Ejecutando...' : 'Ejecutar ahora'}
                    </button>
                  </div>

                  {/* Time Picker */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-xs font-medium text-gray-400">Hora de ejecución</label>
                      <span className="text-xs text-accent font-mono bg-accent/10 px-2 py-0.5 rounded-md">
                        {formatTime(customHour, customMinute)}
                      </span>
                    </div>

                    {/* Hour + Minute inputs */}
                    <div className="flex items-center gap-4 mb-4">
                      <div className="flex-1">
                        <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 block">Hora</label>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { const h = (customHour - 1 + 24) % 24; setCustomHour(h); handleTimeChange(h, customMinute); }}
                            className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-all flex items-center justify-center"
                          >−</button>
                          <input
                            type="number"
                            min={0}
                            max={23}
                            value={customHour}
                            onChange={e => { const h = Math.max(0, Math.min(23, parseInt(e.target.value) || 0)); setCustomHour(h); handleTimeChange(h, customMinute); }}
                            className="w-16 text-center px-2 py-2 bg-background-dark/80 border border-white/10 rounded-lg text-white text-sm font-mono focus:border-accent/50 focus:outline-none transition-colors"
                          />
                          <button
                            onClick={() => { const h = (customHour + 1) % 24; setCustomHour(h); handleTimeChange(h, customMinute); }}
                            className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-all flex items-center justify-center"
                          >+</button>
                        </div>
                      </div>

                      <span className="text-xl text-gray-600 mt-5">:</span>

                      <div className="flex-1">
                        <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 block">Minuto</label>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { const m = (customMinute - 15 + 60) % 60; setCustomMinute(m); handleTimeChange(customHour, m); }}
                            className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-all flex items-center justify-center"
                          >−</button>
                          <input
                            type="number"
                            min={0}
                            max={59}
                            value={customMinute.toString().padStart(2, '0')}
                            onChange={e => { const m = Math.max(0, Math.min(59, parseInt(e.target.value) || 0)); setCustomMinute(m); handleTimeChange(customHour, m); }}
                            className="w-16 text-center px-2 py-2 bg-background-dark/80 border border-white/10 rounded-lg text-white text-sm font-mono focus:border-accent/50 focus:outline-none transition-colors"
                          />
                          <button
                            onClick={() => { const m = (customMinute + 15) % 60; setCustomMinute(m); handleTimeChange(customHour, m); }}
                            className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-all flex items-center justify-center"
                          >+</button>
                        </div>
                      </div>
                    </div>

                    {/* Quick time presets */}
                    <div className="mb-4">
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 block">Horas rápidas</label>
                      <div className="grid grid-cols-8 gap-1.5">
                        {QUICK_TIMES.map(qt => (
                          <button
                            key={qt.hour}
                            onClick={() => { setCustomHour(qt.hour); setCustomMinute(0); handleTimeChange(qt.hour, 0); }}
                            className={`px-2 py-2 text-[11px] rounded-lg border transition-colors ${
                              customHour === qt.hour && customMinute === 0
                                ? 'bg-accent/10 border-accent/40 text-accent'
                                : 'bg-white/[0.02] border-white/10 text-gray-500 hover:text-gray-400 hover:bg-white/5'
                            }`}
                          >
                            {qt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Days of week */}
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 block">Días de ejecución</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDayToggle('*')}
                          className={`px-3 py-2 text-[11px] rounded-lg border transition-colors ${
                            selectedDays.includes('*')
                              ? 'bg-accent/10 border-accent/40 text-accent'
                              : 'bg-white/[0.02] border-white/10 text-gray-500 hover:text-gray-400'
                          }`}
                        >
                          Todos
                        </button>
                        {DAYS_OF_WEEK.map(day => (
                          <button
                            key={day.cron}
                            onClick={() => handleDayToggle(day.cron)}
                            title={day.name}
                            className={`w-9 h-9 text-[11px] rounded-lg border transition-colors font-medium ${
                              !selectedDays.includes('*') && selectedDays.includes(day.cron)
                                ? 'bg-accent/10 border-accent/40 text-accent'
                                : 'bg-white/[0.02] border-white/10 text-gray-500 hover:text-gray-400'
                            }`}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Cron info */}
                    <p className="text-[10px] text-gray-600 mt-3">
                      Cron: <code className="text-gray-400 bg-background-dark/80 px-1.5 py-0.5 rounded font-mono">{config.cronSchedule}</code>
                      {' · '}Ejecuciones hoy: {status?.todayRunCount || 0}/{config.maxDailyRuns}
                    </p>
                  </div>

                  {/* Categories */}
                  <div className="pt-4 border-t border-white/5">
                    <label className="text-xs font-medium text-gray-400 mb-3 block">Categorías de mejora</label>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(CATEGORY_INFO).map(([key, info]) => (
                        <button
                          key={key}
                          onClick={() => toggleCategory(key)}
                          className={`px-3 py-2 text-xs rounded-lg border transition-colors ${
                            config.categories?.includes(key)
                              ? `${info.color} ${info.bg}`
                              : 'border-white/10 text-gray-500'
                          }`}
                        >
                          {info.icon} {info.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ═══ CONFIG TAB ═══ */}
              {activeTab === 'config' && (
                <div className="space-y-6">
                  {/* Limits */}
                  <div>
                    <h4 className="text-white text-[15px] font-semibold mb-4">Límites por ejecución</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-2">Max archivos</label>
                        <input
                          type="number"
                          value={config.maxFilesPerRun}
                          onChange={e => updateConfig({ maxFilesPerRun: parseInt(e.target.value) || 15 })}
                          className="w-full px-3 py-2.5 bg-background-dark/80 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent/50 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-2">Max líneas</label>
                        <input
                          type="number"
                          value={config.maxLinesChanged}
                          onChange={e => updateConfig({ maxLinesChanged: parseInt(e.target.value) || 500 })}
                          className="w-full px-3 py-2.5 bg-background-dark/80 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent/50 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-2">Max queries web</label>
                        <input
                          type="number"
                          value={config.maxResearchQueries}
                          onChange={e => updateConfig({ maxResearchQueries: parseInt(e.target.value) || 30 })}
                          className="w-full px-3 py-2.5 bg-background-dark/80 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent/50 transition-colors"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-2">Max runs/día</label>
                        <input
                          type="number"
                          value={config.maxDailyRuns}
                          onChange={e => updateConfig({ maxDailyRuns: parseInt(e.target.value) || 3 })}
                          className="w-full px-3 py-2.5 bg-background-dark/80 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent/50 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-2">Max agentes paralelos</label>
                        <input
                          type="number"
                          value={config.maxParallelAgents}
                          onChange={e => updateConfig({ maxParallelAgents: parseInt(e.target.value) || 6 })}
                          className="w-full px-3 py-2.5 bg-background-dark/80 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent/50 transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Git/PR */}
                  <div className="pt-4 border-t border-white/5">
                    <h4 className="text-white text-[15px] font-semibold mb-4">Git & Pull Requests</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-2">Branch objetivo</label>
                        <input
                          type="text"
                          value={config.targetBranch}
                          onChange={e => updateConfig({ targetBranch: e.target.value })}
                          className="w-full px-3 py-2.5 bg-background-dark/80 border border-white/10 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-accent/50 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-2">Prefijo de branch</label>
                        <input
                          type="text"
                          value={config.workBranchPrefix}
                          onChange={e => updateConfig({ workBranchPrefix: e.target.value })}
                          className="w-full px-3 py-2.5 bg-background-dark/80 border border-white/10 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-accent/50 transition-colors"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-6 mt-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.requireBuildPass}
                          onChange={e => updateConfig({ requireBuildPass: e.target.checked })}
                          className="w-4 h-4 rounded border-white/20 bg-white/5 accent-accent"
                        />
                        <span className="text-xs text-gray-400">Verificar build antes de PR</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.autoMerge}
                          onChange={e => updateConfig({ autoMerge: e.target.checked })}
                          className="w-4 h-4 rounded border-white/20 bg-white/5 accent-accent"
                        />
                        <span className="text-xs text-gray-400">Auto-merge PR</span>
                      </label>
                    </div>
                  </div>

                  {/* Notifications */}
                  <div className="pt-4 border-t border-white/5">
                    <h4 className="text-white text-[15px] font-semibold mb-4">Notificaciones WhatsApp</h4>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => updateConfig({ notifyWhatsApp: !config.notifyWhatsApp })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          config.notifyWhatsApp ? 'bg-emerald-500' : 'bg-white/10'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          config.notifyWhatsApp ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                      <input
                        type="text"
                        value={config.notifyPhone || ''}
                        onChange={e => updateConfig({ notifyPhone: e.target.value })}
                        placeholder="Número de teléfono (ej: 5215512345678)"
                        className="flex-1 px-3 py-2.5 bg-background-dark/80 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-accent/50 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Agents Info */}
                  <div className="pt-4 border-t border-white/5">
                    <h4 className="text-white text-[15px] font-semibold mb-4">Agentes IA</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {config.agents && Object.entries(config.agents).map(([key, agent]: [string, any]) => (
                        <div key={key} className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                          <div className="text-[11px] text-white font-semibold capitalize mb-1">{key}</div>
                          <div className="text-[10px] text-gray-500 truncate font-mono" title={agent.model}>{agent.model}</div>
                          <div className="text-[10px] text-gray-600 mt-1">{agent.description?.slice(0, 60)}...</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ═══ HISTORY TAB ═══ */}
              {activeTab === 'history' && (
                <div className="space-y-2">
                  {history.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-12">Sin ejecuciones aún</p>
                  ) : (
                    [...history].reverse().map(run => (
                      <div
                        key={run.id}
                        className="p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-pointer"
                        onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium ${STATUS_LABELS[run.status]?.color || 'text-gray-400'}`}>
                              {STATUS_LABELS[run.status]?.icon} {STATUS_LABELS[run.status]?.label || run.status}
                            </span>
                            <span className="text-[10px] text-gray-600">
                              {new Date(run.startedAt).toLocaleDateString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-[10px] text-gray-700">·</span>
                            <span className="text-[10px] text-gray-600">
                              {formatDuration(run.startedAt, run.completedAt)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {run.agentTasks?.length > 0 && (
                              <span className="px-2 py-0.5 text-[10px] font-medium text-accent bg-accent/10 rounded-full">
                                {run.agentTasks.length} agentes
                              </span>
                            )}
                            {run.improvements?.filter((i: any) => i.applied).length > 0 && (
                              <span className="px-2 py-0.5 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 rounded-full">
                                {run.improvements.filter((i: any) => i.applied).length} mejoras
                              </span>
                            )}
                            {run.prUrl && (
                              <a
                                href={run.prUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="px-2 py-0.5 text-[10px] font-medium text-accent bg-accent/10 rounded-full hover:bg-accent/20"
                              >
                                Ver PR
                              </a>
                            )}
                          </div>
                        </div>

                        {expandedRun === run.id && (
                          <div className="mt-3 space-y-2 border-t border-white/5 pt-3">
                            {run.summary && (
                              <p className="text-xs text-gray-300 whitespace-pre-wrap">{run.summary}</p>
                            )}
                            {run.error && (
                              <p className="text-xs text-red-400">Error: {run.error}</p>
                            )}

                            {/* Agent tasks */}
                            {run.agentTasks?.length > 0 && (
                              <div>
                                <p className="text-[10px] font-medium text-gray-500 uppercase mb-1">Agentes</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {run.agentTasks.map((t: any, i: number) => (
                                    <span
                                      key={i}
                                      className={`px-2 py-1 text-[10px] rounded-md border ${
                                        t.status === 'completed'
                                          ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
                                          : 'border-red-500/20 bg-red-500/5 text-red-400'
                                      }`}
                                    >
                                      {t.description}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Research findings */}
                            {run.researchFindings?.length > 0 && (
                              <div>
                                <p className="text-[10px] font-medium text-gray-500 uppercase mb-1">Investigación</p>
                                {run.researchFindings.slice(0, 5).map((f: any, i: number) => (
                                  <div key={i} className="text-xs text-gray-400 mb-1">
                                    <span className={CATEGORY_INFO[f.category]?.color || 'text-gray-400'}>
                                      [{f.category}]
                                    </span>{' '}
                                    {f.findings?.slice(0, 120)}{f.findings?.length > 120 ? '...' : ''}
                                    {f.sources?.length > 0 && (
                                      <span className="text-gray-600"> ({f.sources.length} fuentes)</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Improvements */}
                            {run.improvements?.filter((i: any) => i.applied).length > 0 && (
                              <div>
                                <p className="text-[10px] font-medium text-gray-500 uppercase mb-1">Mejoras aplicadas</p>
                                {run.improvements.filter((i: any) => i.applied).map((imp: any, i: number) => (
                                  <div key={i} className="text-xs text-gray-400 mb-1">
                                    <span className={CATEGORY_INFO[imp.category]?.color || 'text-gray-400'}>
                                      [{imp.category}]
                                    </span>{' '}
                                    <span className="text-gray-300">{imp.file}</span>: {imp.description?.slice(0, 100)}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">AutoDev no disponible</p>
          )}
        </div>
      </div>
    </div>
  );
}
