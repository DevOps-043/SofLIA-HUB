export function ShareButton({ onShare }: { onShare: () => void }) {
  return (
    <button
      onClick={onShare}
      className="px-3 py-1.5 bg-gray-100/50 dark:bg-white/5 hover:bg-accent/10 dark:hover:bg-accent/10 text-gray-700 dark:text-gray-300 hover:text-accent border border-gray-200 dark:border-white/10 rounded-xl transition-all flex items-center gap-2 group"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
      </svg>
      <span className="text-[11px] font-black uppercase tracking-widest">Compartir</span>
    </button>
  );
}
