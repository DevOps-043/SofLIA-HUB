/** Indicador compartido: conserva exactamente los estados visuales del sidebar. */
export function PanelResizeGrip({ resizing }: { resizing: boolean }) {
  return <div aria-hidden="true" className={`w-1 rounded-full transition-all duration-200 ${resizing
    ? 'h-24 bg-accent shadow-[0_0_12px_rgba(0,212,179,0.7)]'
    : 'h-8 bg-gray-300/40 group-hover:h-16 group-hover:bg-accent/80 dark:bg-white/10 dark:group-hover:bg-accent/80 group-focus-visible:h-16 group-focus-visible:bg-accent/80'}`} />;
}
