import { nodeConnector } from '../../shared/presentations/geometry';
import { motion } from 'framer-motion';
import type { PresentationSlide } from '../../shared/presentations/deck-schema';

export function SemanticSlide({ slide, reduced }: { slide: Extract<PresentationSlide, { tipo: 'tabla' | 'diagrama' }>; reduced: boolean }) {
  const cols = slide.tipo === 'diagrama' ? Math.min(3, slide.nodos.length) : 1;
  const point = (i: number) => ({ x: 120 + i % cols * 560, y: 60 + Math.floor(i / cols) * 260 });
  return <section className="runtime-pad flex h-full flex-col pt-[100px] pb-[140px]">
    {slide.antetitulo && <p className="runtime-eyebrow">{slide.antetitulo}</p>}
    <h1 className="max-w-[1600px] text-[54px] font-black leading-tight">{slide.titulo}</h1>
    <div className="mt-[55px] min-h-0 flex-1">
      {slide.tipo === 'tabla' ? <table className="w-full table-fixed border-collapse text-left text-[24px] leading-[30px]"><thead><tr>{slide.columnas.map((c, i) => <th key={i} className="border-b-4 border-[var(--marca-color-acento)] px-5 py-4">{c}</th>)}</tr></thead><tbody>{slide.filas.map((f, i) => <motion.tr key={i} initial={reduced ? false : { opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduced ? 0 : i * .08 }}>{f.map((c, j) => <td key={j} className="border-b border-current/20 px-5 py-3 align-top break-words">{c}</td>)}</motion.tr>)}</tbody></table> : <svg viewBox="0 0 1700 590" className="h-full w-full" role="img" aria-label={slide.titulo}>
        <defs><marker id="flecha" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="var(--marca-color-acento)" /></marker></defs>
        {slide.conexiones.map((c, i) => { const a = point(slide.nodos.findIndex(n => n.id === c.desde)), b = point(slide.nodos.findIndex(n => n.id === c.hasta)); const line = nodeConnector(a, b, 420, 205, 12); return <motion.path key={i} d={`M${line.x1} ${line.y1}L${line.x2} ${line.y2}`} stroke="var(--marca-color-acento)" strokeWidth="4" markerEnd="url(#flecha)" initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: .8 }} />; })}
        {slide.nodos.map((n, i) => { const p = point(i); return <g key={n.id}><rect {...p} width="420" height="205" rx="18" fill="var(--marca-color-fondo)" stroke="var(--marca-color-acento)" strokeWidth="2" /><foreignObject x={p.x + 24} y={p.y + 20} width="372" height="170"><div className="text-[27px] leading-tight"><strong className="block">{n.titulo}</strong><p className="mt-4 text-[23px] opacity-80">{n.texto}</p></div></foreignObject></g>; })}
      </svg>}
    </div>
  </section>;
}
