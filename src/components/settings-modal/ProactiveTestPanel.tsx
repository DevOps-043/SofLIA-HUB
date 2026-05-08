import { BellIcon } from './ProactiveBlock';
import type { ProactiveConfigState } from './types';

export function ProactiveTestPanel({ proactive }: { proactive: ProactiveConfigState }) {
  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-white/[0.02] rounded-xl p-3">
      <button
        onClick={proactive.testNotification}
        disabled={proactive.proactiveTesting}
        className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-purple-600/90 text-white text-[9px] font-bold uppercase tracking-widest shadow-lg shadow-purple-600/10 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
      >
        {proactive.proactiveTesting ? (
          <div className="w-3 h-3 border-1.5 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <BellIcon className="w-3.5 h-3.5" />
        )}
        <span>Sincronizar</span>
      </button>
      <div className="flex-1 flex items-center overflow-hidden h-4">
        {proactive.proactiveTestResult && (
          <p className="text-[9px] font-bold text-purple-400 uppercase tracking-widest truncate">{proactive.proactiveTestResult}</p>
        )}
        {!proactive.proactiveTestResult && (
          <p className="text-[8px] text-gray-700 font-medium uppercase tracking-tight">Requiere WhatsApp vinculado.</p>
        )}
      </div>
    </div>
  );
}
