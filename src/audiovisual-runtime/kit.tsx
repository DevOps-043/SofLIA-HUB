import type { CSSProperties, ReactNode } from 'react';
import { emphasisWords } from '../shared/audiovisual/text-emphasis';
import type { FilmEntity } from '../shared/audiovisual/film-schema';
export function Icon({ name = 'documento', size = 24 }: { name?: string; size?: number }) {
  const paths: Record<string, string> = { documento: 'M6 3h8l4 4v14H6zM14 3v5h5M9 12h6M9 16h6', chat: 'M4 4h16v12H9l-5 4zM8 8h8M8 12h5', curso: 'm2 8 10-5 10 5-10 5zM6 10v7q6 5 12 0v-7M22 8v8', leccion: 'M4 4h6q2 0 2 2v15q-2-3-8-2zM20 4h-6q-2 0-2 2v15q2-3 8-2z', tablero: 'M3 4h5v16H3zM10 4h5v11h-5zM17 4h4v7h-4z', check: 'm5 12 4 4L19 6', flecha: 'M4 12h16m-6-6 6 6-6 6', red: 'M5 6h14M5 18h14M5 6l14 12M19 6 5 18', usuario: 'M9 12a4 4 0 1 1 6 0M4 21q0-8 8-8t8 8' };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={paths[name] ?? paths.documento} /></svg>;
}
export function Chip({ children, accent = false }: { children: ReactNode; accent?: boolean }) { return <span className={`film-chip${accent ? ' film-chip--accent' : ''}`}>{children}</span>; }
export function Meter({ value, label = 'Evolución de la demostración' }: { value: number; label?: string }) { return <div className="film-meter" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}><i style={{ width: `${Math.round(value * 100)}%` }} /></div>; }
export function Ring({ value, size = 146, label }: { value: number; size?: number; label?: string }) {
  const radius = 54, length = 2 * Math.PI * radius;
  return <div className="film-ring" style={{ width: size, height: size }}><svg viewBox="0 0 128 128"><circle cx="64" cy="64" r={radius} fill="none" stroke="var(--film-line)" strokeWidth="7" /><circle cx="64" cy="64" r={radius} fill="none" stroke="var(--film-accent)" strokeWidth="7" strokeLinecap="round" strokeDasharray={length} strokeDashoffset={length * (1 - value)} transform="rotate(-90 64 64)" /></svg><b style={{fontSize:label?18:undefined}}>{label ?? <>{Math.round(value * 100)}<small>%</small></>}</b></div>;
}
export function Window({ entity, section, children, sidebar = true }: { entity: FilmEntity; section: string; children: ReactNode; sidebar?: boolean }) {
  return <section className="film-window" data-entity={entity.id}>
    <header className="film-window-header"><span className="film-app-icon"><Icon name={entity.tipo} /></span><b>{entity.titulo}</b><span className="film-divider" /><span>{section}</span><div className="film-window-tools"><i /><i /><i /></div></header>
    <div className="film-window-inner">{sidebar && <aside className="film-sidebar"><span className="film-overline">ESPACIO DE TRABAJO</span>{entity.etiquetas.map((label, i) => <div key={label} className={i === 0 ? 'film-sidebar-active' : ''}><Icon name={i === 0 ? entity.tipo : 'documento'} size={21} />{label}</div>)}<footer><span className="film-avatar">S</span><span>Equipo de trabajo<small>Vista conceptual</small></span></footer></aside>}<div className="film-window-content">{children}</div></div>
  </section>;
}
export function Paper({ entity, compact = false }: { entity: FilmEntity; compact?: boolean }) {
  return <article className={`film-paper${compact ? ' film-paper--compact' : ''}`}><div className="film-paper-top"><Icon /><span>DOCUMENTO DE TRABAJO</span><span>01</span></div><h3>{entity.titulo}</h3><p>{entity.detalle}</p><div className="film-rule" />{(entity.filas ?? entity.etiquetas.map((titulo, i) => ({ id: String(i), titulo, detalle: undefined }))).map((item, i) => <section key={item.id}><span className="film-number">0{i + 1}</span><div><h4>{item.titulo}</h4>{item.detalle && <p>{item.detalle}</p>}{'progreso' in item && typeof item.progreso === 'number' && <Meter value={item.progreso} label="Avance declarado del documento" />}</div></section>)}</article>;
}
export function Reveal({ text, frame, fps, className = '', style, accentEnd = false, highlights }: { text: string; frame: number; fps: number; className?: string; style?: CSSProperties; accentEnd?: boolean; highlights?: readonly string[] }) {
  const words = text.split(/\s+/), selected = emphasisWords(text, highlights ?? []);
  return <div className={`film-reveal ${className}`} style={style} aria-label={text}>{words.map((word, i) => {
    const t = Math.max(0, Math.min(1, (frame / fps - .1 - i * .04) / .65)); const eased = 1 - (1 - t) ** 3;
    return <span className={`film-word-mask${(highlights ? selected.has(i) : accentEnd && i === words.length-1) ? ' film-word-mask--accent' : ''}`} key={i}><span style={{ transform: `translateY(${(1 - eased) * 112}%)`, opacity: eased }}>{word}</span></span>;
  })}</div>;
}
