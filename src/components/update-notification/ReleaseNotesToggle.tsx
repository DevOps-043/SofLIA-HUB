type ReleaseNotesToggleProps = {
  releaseNotes: string;
  showNotes: boolean;
  onToggle: () => void;
};

export function ReleaseNotesToggle({ releaseNotes, showNotes, onToggle }: ReleaseNotesToggleProps) {
  return (
    <button onClick={onToggle} className="w-full text-left mb-3">
      <p className="text-[10px] text-accent font-bold uppercase tracking-widest flex items-center gap-1">
        Ver novedades
        <svg
          className={`w-3 h-3 transition-transform ${showNotes ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </p>
      {showNotes && (
        <div className="mt-2 p-2.5 bg-white/5 rounded-lg border border-white/5 max-h-32 overflow-y-auto custom-scrollbar">
          <div className="text-[11px] release-notes" dangerouslySetInnerHTML={{ __html: releaseNotes }} />
        </div>
      )}
    </button>
  );
}
