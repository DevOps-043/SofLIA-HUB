import { IconGlyph } from '../../../../components/ui/IconGlyph';

export function ShareButton({ onShare }: { onShare: () => void }) {
  return (
    <button
      type="button"
      onClick={onShare}
      aria-label="Compartir conversación"
      className="flex h-8 items-center gap-1.5 px-3 py-1 rounded-full text-accent hover:bg-accent/10 font-semibold transition-all duration-150 group focus:outline-none active:scale-95"
      style={{ fontFamily: 'var(--font-system-ui)' }}
    >
      <IconGlyph width={17} height={17}>
        <circle cx="18" cy="5" r="3" fill="currentColor" fillOpacity=".16" />
        <circle cx="6" cy="12" r="3" fill="currentColor" fillOpacity=".16" />
        <circle cx="18" cy="19" r="3" fill="currentColor" fillOpacity=".16" />
        <path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" />
      </IconGlyph>
      <span className="text-[10.5px] font-bold uppercase tracking-[0.1em]" style={{ fontFamily: 'var(--font-system-label)' }}>
        Compartir
      </span>
    </button>
  );
}

