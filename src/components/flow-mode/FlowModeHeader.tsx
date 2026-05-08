type FlowModeHeaderProps = {
  canClear: boolean;
  panelLabel: string;
  resetResult: () => void;
  resetTranscript: () => void;
};

export function FlowModeHeader({
  canClear,
  panelLabel,
  resetResult,
  resetTranscript,
}: FlowModeHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="rounded-full border border-[#214841] bg-[#0b1c19] px-3 py-1 text-[10px] uppercase tracking-[0.26em] text-[#9de7d6]">
        {panelLabel}
      </span>
      {canClear && (
        <button
          onClick={() => {
            resetTranscript();
            resetResult();
          }}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 text-[11px] uppercase tracking-[0.22em] text-[#8ea3a0] transition hover:text-white"
          aria-label="Limpiar respuesta y transcripcion"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18" />
            <path d="M8 6V4h8v2" />
            <path d="m19 6-1 14H6L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
          </svg>
          <span>Limpiar</span>
        </button>
      )}
    </div>
  );
}
