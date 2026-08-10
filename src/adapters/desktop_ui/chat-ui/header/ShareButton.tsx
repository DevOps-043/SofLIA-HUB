export function ShareButton({ onShare }: { onShare: () => void }) {
  return (
    <button
      type="button"
      onClick={onShare}
      aria-label="Compartir conversación"
      className="flex h-8 items-center gap-1.5 px-3 py-1 rounded-full text-accent hover:bg-accent/10 font-semibold transition-all duration-150 group focus:outline-none active:scale-95"
      style={{ fontFamily: 'var(--font-system-ui)' }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-3.5 w-3.5 transition-transform duration-200 group-hover:scale-110"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"
        />
      </svg>
      <span className="text-[10.5px] font-bold uppercase tracking-[0.1em]" style={{ fontFamily: 'var(--font-system-label)' }}>
        Compartir
      </span>
    </button>
  );
}

