import {
  useAutoDevPanel,
  CATEGORY_INFO, QUICK_TIMES, DAYS_OF_WEEK,
  STATUS_LABELS, STATUS_PROGRESS,
  formatDuration, formatTime,
} from '../hooks/useAutoDevPanel';

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
  embedded?: boolean;
}

export default function AutoDevPanel({ isOpen, onClose, embedded = false }: AutoDevPanelProps) {
  const {
    config, status, history, loading, saving,
    expandedRun, setExpandedRun,
    activeTab, setActiveTab,
    customHour, customMinute, selectedDays,
    updateConfig, handleTimeChange, handleDayToggle,
    handleRunNow, handleAbort, toggleCategory, nextRunText,
  } = useAutoDevPanel(isOpen);

  const renderStatusIcon = (status: string) => {
    const iconClass = "w-4 h-4";
    switch (status) {
      case 'researching':
        return <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
      case 'analyzing':
        return <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
      case 'planning':
        return <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>;
      case 'coding':
        return <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>;
      case 'verifying':
        return <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>;
      case 'pushing':
        return <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>;
      case 'completed':
        return <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
      case 'failed':
        return <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
      case 'aborted':
        return <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9 10h6v4H9z" /></svg>;
      default:
        return null;
    }
  };

  const renderCategoryIcon = (category: string) => {
    const iconClass = "w-5 h-5";
    switch (category) {
      case 'security':
        return <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>;
      case 'quality':
        return <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-7.714 2.143L11 21l-2.286-6.857L1 12l7.714-2.143L11 3z" /></svg>;
      case 'performance':
        return <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
      case 'dependencies':
        return <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>;
      case 'tests':
        return <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a2 2 0 00-1.96 1.414l-.727 2.903a2 2 0 01-3.564 0l-.727-2.903a2 2 0 00-1.96-1.414l-2.387.477a2 2 0 00-1.022.547l-2.387 2.387a2 2 0 01-2.828 0l-.707-.707a2 2 0 010-2.828l2.387-2.387a2 2 0 00.547-1.022l.477-2.387a2 2 0 00-1.414-1.96L4.053 7.032a2 2 0 010-3.564l2.903-.727a2 2 0 001.414-1.96L8.847.428a2 2 0 012.828 0l.707.707a2 2 0 010 2.828l-2.387 2.387a2 2 0 00-.547 1.022l-.477 2.387a2 2 0 001.414 1.96l2.387.477a2 2 0 010 3.564l-2.903.727a2 2 0 00-1.414 1.96l-.477 2.387a2 2 0 01-2.828 0l-.707-.707a2 2 0 010-2.828l2.387-2.387a2 2 0 00.547-1.022l.477-2.387a2 2 0 00-1.414-1.96l-2.387-.477a2 2 0 010-3.564l2.903-.727a2 2 0 001.414-1.96l.477-2.387a2 2 0 012.828 0l.707.707a2 2 0 010 2.828l-2.387 2.387z" /></svg>;
      default:
        return null;
    }
  };

  if (!isOpen && !embedded) return null;

  const content = (
    <div
      className={`flex flex-col overflow-hidden ${embedded ? 'w-full h-full' : 'w-175 max-h-[85vh] bg-white dark:bg-sidebar rounded-2xl border border-black/5 dark:border-white/10 shadow-2xl animate-fade-in'}`}
      onClick={e => e.stopPropagation()}
    >

      {/* Header */}
      {!embedded && (
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
              <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
              </svg>
            </div>
            <div>
              <h2 className="text-gray-900 dark:text-white text-lg font-semibold">AutoDev</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Programación autónoma con IA multi-agente</p>
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
      )}

      {/* Status Banner (always visible when running) */}
      {status?.running && status.currentRun && (
        <div className="px-6 py-3 bg-accent/5 border-b border-white/5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
              <span className={`text-sm font-medium flex items-center gap-2 ${STATUS_LABELS[status.currentRun.status]?.color || 'text-gray-900 dark:text-white'}`}>
                {renderStatusIcon(status.currentRun.status)}
                {STATUS_LABELS[status.currentRun.status]?.label || status.currentRun.status}
              </span>
            </div>

            <button
              onClick={handleAbort}
              className="px-3 py-1.5 text-xs font-medium text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors"
            >
              Abortar
            </button>
          </div>
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
      <div className="flex px-8 pt-2 gap-8 border-b border-white/5 bg-white/2">
        {[
          { key: 'schedule' as const, label: 'Programar', icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          )},
          { key: 'config' as const, label: 'Configuración', icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          )},
          { key: 'history' as const, label: `Historial (${history.length})`, icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          )},
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all relative ${
              activeTab === tab.key
                ? 'text-accent'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >

            {tab.icon}
            {tab.label}
            {activeTab === tab.key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
            )}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className={`flex-1 overflow-y-auto no-scrollbar px-6 py-5`}>
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
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Master Control Card */}
                <div className="bg-gray-50/50 dark:bg-white/3 border border-gray-100 dark:border-white/10 rounded-3xl p-6 shadow-xl relative overflow-hidden group">

                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-accent/5 rounded-full blur-3xl group-hover:bg-accent/10 transition-all duration-700"></div>
                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => updateConfig({ enabled: !config.enabled })}
                        className={`relative inline-flex h-7 w-14 items-center rounded-full transition-all duration-300 shadow-inner ${
                          config.enabled ? 'bg-accent shadow-accent/20' : 'bg-black/10 dark:bg-white/10'
                        }`}

                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-all duration-300 shadow-lg ${
                          config.enabled ? 'translate-x-8' : 'translate-x-1'
                        }`} />
                      </button>
                      <div>
                        <span className="text-sm text-gray-900 dark:text-white font-black uppercase tracking-widest">
                          {config.enabled ? 'Agente Activo' : 'Agente en Pausa'}
                        </span>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter mt-0.5">
                          {config.enabled ? `Próxima ejecución: ${nextRunText()}` : 'El sistema no realizará mejoras automáticas'}
                        </p>

                      </div>
                    </div>
                    <button
                      onClick={handleRunNow}
                      disabled={status?.running}
                      className="group/btn relative overflow-hidden px-6 py-3 rounded-2xl bg-accent text-primary text-xs font-black uppercase tracking-widest transition-all hover:scale-[1.02] hover:shadow-2xl hover:shadow-accent/40 active:scale-[0.98] disabled:opacity-50"
                    >
                      <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300"></div>
                      <span className="relative z-10">
                        {status?.running ? 'En ejecución...' : 'Ejecutar ahora'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Time & Days Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Time Picker Card */}
                  <div className="bg-gray-50/50 dark:bg-white/3 border border-gray-100 dark:border-white/10 rounded-3xl p-6 shadow-lg shadow-black/5">

                    <div className="flex items-center justify-between mb-6">
                      <h4 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em]">Horario</h4>

                      <div className="px-3 py-1 bg-accent/10 border border-accent/20 rounded-xl">
                        <span className="text-xs font-black text-accent font-mono">{formatTime(customHour, customMinute)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-center gap-6 mb-8">
                       {/* Hour */}
                       <div className="flex flex-col items-center gap-2">
                        <button
                          onClick={() => handleTimeChange((customHour + 1) % 24, customMinute)}
                          className="w-10 h-10 rounded-xl bg-black/[0.02] dark:bg-white/5 border border-black/[0.05] dark:border-white/10 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/10 transition-all flex items-center justify-center"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg>
                        </button>

                        <div className="w-16 h-16 bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl flex items-center justify-center shadow-inner">
                          <span className="text-2xl font-black text-gray-900 dark:text-white font-mono">{customHour.toString().padStart(2, '0')}</span>
                        </div>

                        <button
                          onClick={() => handleTimeChange((customHour - 1 + 24) % 24, customMinute)}
                          className="w-10 h-10 rounded-xl bg-black/[0.02] dark:bg-white/5 border border-black/[0.05] dark:border-white/10 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/10 transition-all flex items-center justify-center"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                        </button>

                       </div>

                       <div className="text-3xl font-black text-gray-900/10 dark:text-white/20 mt-2">:</div>


                       {/* Minute */}
                       <div className="flex flex-col items-center gap-2">
                        <button
                          onClick={() => handleTimeChange(customHour, (customMinute + 15) % 60)}
                          className="w-10 h-10 rounded-xl bg-black/[0.02] dark:bg-white/5 border border-black/[0.05] dark:border-white/10 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/10 transition-all flex items-center justify-center"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg>
                        </button>

                        <div className="w-16 h-16 bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl flex items-center justify-center shadow-inner">
                          <span className="text-2xl font-black text-gray-900 dark:text-white font-mono">{customMinute.toString().padStart(2, '0')}</span>
                        </div>

                        <button
                          onClick={() => handleTimeChange(customHour, (customMinute - 15 + 60) % 60)}
                          className="w-10 h-10 rounded-xl bg-black/[0.02] dark:bg-white/5 border border-black/[0.05] dark:border-white/10 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/10 transition-all flex items-center justify-center"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                        </button>

                       </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      {QUICK_TIMES.map(qt => (
                        <button
                          key={qt.hour}
                          onClick={() => handleTimeChange(qt.hour, 0)}
                          className={`px-2 py-2.5 text-[9px] font-black uppercase tracking-tighter rounded-xl border transition-all ${
                            customHour === qt.hour && customMinute === 0
                              ? 'bg-accent/10 border-accent/40 text-accent shadow-lg shadow-accent/10 scale-105'
                              : 'bg-black/[0.02] dark:bg-white/2 border-black/[0.05] dark:border-white/5 text-gray-400 dark:text-gray-500 hover:border-gray-300 dark:hover:border-white/20 hover:text-gray-900 dark:hover:text-gray-300'
                          }`}

                        >
                          {qt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Days Selector Card */}
                  <div className="bg-gray-50/50 dark:bg-white/3 border border-gray-100 dark:border-white/10 rounded-3xl p-6 shadow-lg shadow-black/5">

                    <h4 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em] mb-6">Frecuencia Semanal</h4>

                    <div className="flex flex-col gap-4">
                      <button
                        onClick={() => handleDayToggle('*')}
                        className={`w-full py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl border transition-all ${
                          selectedDays.includes('*')
                            ? 'bg-accent/10 border-accent/40 text-accent shadow-lg shadow-accent/10'
                            : 'bg-black/[0.02] dark:bg-white/2 border-black/[0.05] dark:border-white/5 text-gray-400 dark:text-gray-500 hover:border-gray-300 dark:hover:border-white/20'
                        }`}

                      >
                        Diario (Todos los Días)
                      </button>
                      <div className="grid grid-cols-7 gap-2">
                        {DAYS_OF_WEEK.map(day => (
                          <button
                            key={day.cron}
                            onClick={() => handleDayToggle(day.cron)}
                            title={day.name}
                            className={`aspect-square text-[10px] font-black rounded-xl border transition-all flex items-center justify-center ${
                              !selectedDays.includes('*') && selectedDays.includes(day.cron)
                                ? 'bg-accent/10 border-accent/40 text-accent shadow-lg shadow-accent/10'
                                : 'bg-black/[0.02] dark:bg-white/2 border-black/[0.05] dark:border-white/5 text-gray-400 dark:text-gray-500 hover:border-gray-300 dark:hover:border-white/20'
                            }`}

                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-black/[0.03] dark:border-white/5">

                      <div className="flex justify-between items-end">
                        <div className="space-y-1">
                          <p className="text-[9px] font-black text-gray-400 dark:text-gray-600 uppercase tracking-widest leading-none">Configuración actual</p>
                          <code className="text-[10px] text-gray-500 dark:text-gray-400 bg-black/[0.02] dark:bg-white/5 px-2 py-1 rounded-lg font-mono tracking-widest">{config.cronSchedule}</code>
                        </div>

                        <div className="text-right">
                          <p className="text-[9px] font-black text-gray-400 dark:text-gray-600 uppercase tracking-widest leading-none mb-1">Ejecuciones Hoy</p>
                          <p className="text-xl font-black text-gray-900 dark:text-white font-mono leading-none">
                            {status?.todayRunCount || 0}<span className="text-xs text-gray-400 dark:text-gray-600 ml-1">/ {config.maxDailyRuns}</span>
                          </p>
                        </div>

                      </div>
                    </div>
                  </div>
                </div>

                {/* Categories Selection */}
                <div className="bg-white/3 border border-white/10 rounded-3xl p-8 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-opacity">
                     <svg className="w-16 h-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a2 2 0 00-1.96 1.414l-.727 2.903a2 2 0 01-3.564 0l-.727-2.903a2 2 0 00-1.96-1.414l-2.387.477a2 2 0 00-1.022.547l-2.387 2.387a2 2 0 01-2.828 0l-.707-.707a2 2 0 010-2.828l2.387-2.387a2 2 0 00.547-1.022l.477-2.387a2 2 0 00-1.414-1.96L4.053 7.032a2 2 0 010-3.564l2.903-.727a2 2 0 001.414-1.96L8.847.428a2 2 0 012.828 0l.707.707a2 2 0 010 2.828l-2.387 2.387a2 2 0 00-.547 1.022l-.477 2.387a2 2 0 001.414 1.96l2.387.477a2 2 0 010 3.564l-2.903.727a2 2 0 00-1.414 1.96l-.477 2.387a2 2 0 01-2.828 0l-.707-.707a2 2 0 010-2.828l2.387-2.387a2 2 0 00.547-1.022l.477-2.387a2 2 0 00-1.414-1.96l-2.387-.477a2 2 0 010-3.564l2.903-.727a2 2 0 001.414-1.96l.477-2.387a2 2 0 012.828 0l.707.707a2 2 0 010 2.828l-2.387 2.387z" />
                     </svg>
                  </div>
                  <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-6">Categorías de Enfoque</h4>
                  <div className="flex flex-wrap gap-4">
                    {Object.entries(CATEGORY_INFO).map(([key, info]) => (
                      <button
                        key={key}
                        onClick={() => toggleCategory(key)}
                        className={`flex-1 min-w-[140px] p-4 rounded-2xl border transition-all group/cat relative overflow-hidden ${
                          config.categories?.includes(key)
                            ? `${info.bg} ${info.color} scale-105 shadow-xl`
                            : 'bg-white/2 border-white/5 text-gray-500 hover:border-white/20'
                        }`}
                      >
                        <div className="relative z-10 flex flex-col items-center gap-2">
                          <span className="transition-transform duration-300 group-hover/cat:scale-110">
                            {renderCategoryIcon(key)}
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-widest">{info.label}</span>
                        </div>
                        {config.categories?.includes(key) && (
                           <div className="absolute inset-0 bg-white/5 animate-pulse" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ═══ CONFIG TAB ═══ */}
            {activeTab === 'config' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* limits Card */}
                <div className="bg-white/3 border border-white/10 rounded-3xl p-8 relative overflow-hidden group">
                  <div className="absolute -top-10 -left-10 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-all duration-700"></div>
                  <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-8 relative z-10">Límites de Seguridad</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Max Archivos</label>
                        <span className="text-[10px] font-mono text-accent">{config.maxFilesPerRun}</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={1000}
                        value={config.maxFilesPerRun}
                        onChange={e => updateConfig({ maxFilesPerRun: parseInt(e.target.value) })}
                        className="w-full h-1.5 bg-white/5 rounded-full appearance-none cursor-pointer accent-accent"
                      />
                      <p className="text-[9px] text-gray-600 font-bold uppercase">Archivos por iteración</p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Max Líneas</label>
                        <span className="text-[10px] font-mono text-accent">{config.maxLinesChanged}</span>
                      </div>
                      <input
                        type="number"
                        value={config.maxLinesChanged}
                        onChange={e => updateConfig({ maxLinesChanged: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 bg-background-dark/80 border border-white/10 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-accent/50"
                      />
                      <p className="text-[9px] text-gray-600 font-bold uppercase">Límite de cambios</p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Max Queries Web</label>
                        <span className="text-[10px] font-mono text-accent">{config.maxQueriesWeb}</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={500}
                        value={config.maxQueriesWeb}
                        onChange={e => updateConfig({ maxQueriesWeb: parseInt(e.target.value) })}
                        className="w-full h-1.5 bg-white/5 rounded-full appearance-none cursor-pointer accent-accent"
                      />
                      <p className="text-[9px] text-gray-600 font-bold uppercase">Análisis web por agente</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10 mt-8 pt-8 border-t border-white/5">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Max Runs / Día</label>
                        <span className="text-[10px] font-mono text-accent">{config.maxDailyRuns}</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={100}
                        value={config.maxDailyRuns}
                        onChange={e => updateConfig({ maxDailyRuns: parseInt(e.target.value) })}
                        className="w-full h-1.5 bg-white/5 rounded-full appearance-none cursor-pointer accent-accent"
                      />
                      <p className="text-[9px] text-gray-600 font-bold uppercase">Límite de ejecuciones diarias</p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Agentes Paralelos</label>
                        <span className="text-[10px] font-mono text-accent">{config.maxParallelAgents}</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={30}
                        value={config.maxParallelAgents}
                        onChange={e => updateConfig({ maxParallelAgents: parseInt(e.target.value) })}
                        className="w-full h-1.5 bg-white/5 rounded-full appearance-none cursor-pointer accent-accent"
                      />
                      <p className="text-[9px] text-gray-600 font-bold uppercase">Hilos de ejecución simultáneos</p>
                    </div>
                  </div>
                </div>

                {/* Git Source Card */}
                <div className="bg-white/3 border border-white/10 rounded-3xl p-8 relative overflow-hidden group">
                  <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl group-hover:bg-purple-500/10 transition-all duration-700"></div>
                  <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-8 relative z-10">Entorno Git</h4>
                  <div className="relative z-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Branch Objetivo</label>
                        <div className="relative">
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600">
                             <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path d="M6 3v12M6 15a3 3 0 103 3M6 15a3 3 0 013 3M18 9a3 3 0 11-6 0 3 3 0 016 0zM18 9V6a3 3 0 00-3-3H9" /></svg>
                          </div>
                          <input
                            type="text"
                            value={config.targetBranch}
                            onChange={e => updateConfig({ targetBranch: e.target.value })}
                            placeholder="main"
                            className="w-full pl-9 pr-4 py-3 bg-background-dark/80 border border-white/10 rounded-2xl text-white text-xs font-mono focus:outline-none focus:border-accent/50 transition-all"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Prefijo de Branch</label>
                        <div className="relative">
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600">
                             <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5h2M11 19h2M7 7v10M17 7v10" /></svg>
                          </div>
                          <input
                            type="text"
                            value={config.branchPrefix}
                            onChange={e => updateConfig({ branchPrefix: e.target.value })}
                            placeholder="autodev/"
                            className="w-full pl-9 pr-4 py-3 bg-background-dark/80 border border-white/10 rounded-2xl text-white text-xs font-mono focus:outline-none focus:border-accent/50 transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-8 px-1">
                      <label className="flex items-center gap-3 cursor-pointer group/check">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={config.verifyBuild}
                            onChange={e => updateConfig({ verifyBuild: e.target.checked })}
                            className="peer sr-only"
                          />
                          <div className="w-5 h-5 border-2 border-white/10 rounded-md bg-white/5 transition-all peer-checked:bg-accent peer-checked:border-accent"></div>
                          <svg className="absolute inset-0 w-5 h-5 text-primary scale-0 transition-transform peer-checked:scale-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover/check:text-white transition-colors">Verificar build antes de PR</span>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer group/check">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={config.autoMerge}
                            onChange={e => updateConfig({ autoMerge: e.target.checked })}
                            className="peer sr-only"
                          />
                          <div className="w-5 h-5 border-2 border-white/10 rounded-md bg-white/5 transition-all peer-checked:bg-accent peer-checked:border-accent"></div>
                          <svg className="absolute inset-0 w-5 h-5 text-primary scale-0 transition-transform peer-checked:scale-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover/check:text-white transition-colors">Auto-merge PR</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* WhatsApp Section */}
                <div className="bg-white/3 border border-white/10 rounded-3xl p-8 relative overflow-hidden group">
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/10 transition-all duration-700"></div>
                  <div className="flex items-center justify-between mb-8 relative z-10">
                    <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Notificaciones WhatsApp</h4>
                    <button
                      onClick={() => updateConfig({ whatsappNotify: !config.whatsappNotify })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 ${
                        config.whatsappNotify ? 'bg-emerald-500' : 'bg-white/10'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-all duration-300 ${
                        config.whatsappNotify ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                  <div className="relative z-10">
                     <div className="max-w-md space-y-4">
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Número de Teléfono</label>
                           <div className="relative">
                              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600">
                                 <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                              </div>
                              <input
                                 type="text"
                                 value={config.whatsappNumber || ''}
                                 onChange={e => updateConfig({ whatsappNumber: e.target.value })}
                                 placeholder="+52 1..."
                                 className={`w-full pl-10 pr-4 py-3 bg-background-dark/80 border rounded-2xl text-white text-xs font-mono focus:outline-none transition-all ${
                                    config.whatsappNotify ? 'border-emerald-500/30 focus:border-emerald-500/50' : 'border-white/10 opacity-50'
                                 }`}
                                 disabled={!config.whatsappNotify}
                              />
                           </div>
                        </div>
                        <p className="text-[9px] text-gray-600 font-bold uppercase px-1 leading-relaxed">
                           Recibe reportes de mejoras y alertas de seguridad directamente en tu WhatsApp.
                        </p>
                     </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ HISTORY TAB ═══ */}
            {activeTab === 'history' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
                {history.length === 0 ? (
                  <div className="py-20 flex flex-col items-center justify-center text-center opacity-40">
                    <svg className="w-12 h-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em]">Sin ejecuciones registradas</p>
                  </div>
                ) : (
                  [...history].reverse().map(run => (
                    <div
                      key={run.id}
                      className={`group relative overflow-hidden p-5 rounded-3xl border transition-all duration-300 ${
                        expandedRun === run.id
                          ? 'bg-white/5 border-white/20 shadow-2xl scale-[1.01]'
                          : 'bg-white/2 border-white/5 hover:bg-white/4 hover:border-white/10'
                      }`}
                      onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                    >
                      <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-4">
                           <div className={`p-3 rounded-2xl ${STATUS_LABELS[run.status]?.color?.replace('text-', 'bg-')}/10`}>
                             {renderStatusIcon(run.status)}
                           </div>
                           <div>
                             <p className={`text-xs font-black uppercase tracking-widest ${STATUS_LABELS[run.status]?.color}`}>
                               {STATUS_LABELS[run.status]?.label || run.status}
                             </p>
                             <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter mt-0.5">
                               {new Date(run.startedAt).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                             </p>
                           </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-black text-white font-mono">{run.improvements?.length || 0} mejoras</p>
                          <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">{formatDuration(run.startedAt, run.completedAt)}</p>
                        </div>
                      </div>

                      {expandedRun === run.id && (
                        <div className="mt-6 pt-6 border-t border-white/5 grid grid-cols-3 gap-4 animate-in fade-in zoom-in-95 duration-300">
                           <div className="bg-white/2 p-3 rounded-2xl border border-white/5 text-center">
                             <p className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-1">Agentes</p>
                             <p className="text-lg font-black text-white">{run.agentTasks?.length || 0}</p>
                           </div>
                           <div className="bg-white/2 p-3 rounded-2xl border border-white/5 text-center">
                             <p className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-1">Hallazgos</p>
                             <p className="text-lg font-black text-white">{run.researchFindings?.length || 0}</p>
                           </div>
                           <div className="bg-white/2 p-3 rounded-2xl border border-white/5 text-center">
                             <p className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-1">Archivos</p>
                             <p className="text-lg font-black text-white">{run.filesProcessed?.length || 0}</p>
                           </div>
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
  );

  if (embedded) return content;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      {content}
    </div>
  );
}
