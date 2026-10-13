import { useCallback, useEffect, useRef, useState } from 'react';
import { displayMediaPicker } from '../../services/display-media-picker';
import type { DisplayMediaKind, DisplayMediaPickerSnapshot } from '../../shared/display-media';
import './display-media-picker.css';

const categories: { kind: DisplayMediaKind; label: string; hint: string }[] = [
  { kind: 'screen', label: 'Pantallas', hint: 'Se compartirá todo lo que aparezca en la pantalla seleccionada.' },
  { kind: 'window', label: 'Ventanas', hint: 'Comparte una aplicación y conserva el resto de tu escritorio privado.' },
  { kind: 'tab', label: 'Pestañas', hint: 'Pestañas del navegador del Hub. Para Chrome o Edge externos, elige su ventana.' },
];
function SourceIcon({ kind }: { kind: DisplayMediaKind }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    {kind === 'screen' ? <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>
      : <><rect x="3" y="4" width="18" height="16" rx="2" /><path d={kind === 'tab' ? 'M3 9h18M7 4v5M15 4v5' : 'M3 9h18M6 6.5h1M9 6.5h1'} /></>}
  </svg>;
}

export function DisplayMediaPicker() {
  const [snapshot, setSnapshot] = useState<DisplayMediaPickerSnapshot | null>(null);
  const [kind, setKind] = useState<DisplayMediaKind>('screen');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [audio, setAudio] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  const requestRef = useRef<{ cancelled: boolean } | null>(null);

  const load = useCallback((request: { cancelled: boolean }) => {
    return displayMediaPicker.list().then((result) => {
      if (!mounted.current || request.cancelled) return;
      if (!result.success) { setError(result.error); return; }
      setSnapshot(result.snapshot);
      setSelected((previous) => result.snapshot.sources.some((source) => source.id === previous) ? previous : null);
      if (!result.snapshot.audioAvailable) setAudio(false);
      document.documentElement.classList.toggle('dark', result.snapshot.dark);
    }).catch(() => { if (mounted.current && !request.cancelled) setError('El selector no está disponible. Cierra esta ventana y vuelve a intentar.'); })
      .finally(() => { if (mounted.current && !request.cancelled) setLoading(false); });
  }, []);
  async function refresh() {
    if (requestRef.current) requestRef.current.cancelled = true;
    const request = { cancelled: false };
    requestRef.current = request;
    setLoading(true); setError(null);
    await load(request);
  }
  useEffect(() => {
    mounted.current = true;
    const request = { cancelled: false };
    requestRef.current = request;
    void load(request);
    return () => { mounted.current = false; request.cancelled = true; };
  }, [load]);

  async function cancel() {
    try { await displayMediaPicker.cancel(); }
    catch { if (mounted.current) setError('No pudimos cerrar el selector. Pulsa Escape para cancelar.'); }
  }
  async function share() {
    if (!selected || sharing || loading) return;
    setSharing(true); setError(null);
    try {
      const result = await displayMediaPicker.select(selected, audio);
      if (mounted.current && !result.success) setError(result.error || 'No pudimos compartir esta fuente.');
    } catch { if (mounted.current) setError('No pudimos compartir esta fuente. Vuelve a intentar.'); }
    finally { if (mounted.current) setSharing(false); }
  }
  const sources = snapshot?.sources ?? [];
  const visible = sources.filter((source) => source.kind === kind && source.name.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es').trim()));
  const choice = sources.find((source) => source.id === selected);
  const category = categories.find((item) => item.kind === kind)!;
  const binding = snapshot?.purpose === 'bind';

  return <main className="share-picker" aria-labelledby="share-title" onKeyDown={(event) => { if (event.key === 'Escape') void cancel(); }}>
    <header className="share-heading">
      <div className="share-brand"><span className="share-brand-mark"><SourceIcon kind="screen" /></span><span>SOFLIA HUB <span className="share-brand-dot">·</span> PRESENTAR</span></div>
      <button className="share-close" aria-label="Cerrar selector" onClick={() => void cancel()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg></button>
      <h1 id="share-title">{binding ? 'Elige la fuente de tu escena' : 'Elige qué compartir'}</h1>
      <p>{binding ? 'Prepara el vínculo. La transmisión comienza cuando pulses Compartir.' : 'Tu espacio, bajo tu control. Solo se verá la fuente que elijas.'}</p>
    </header>
    <section className="share-content" aria-label="Fuentes disponibles">
      <div className="share-toolbar">
        <div className="share-categories" role="tablist" aria-label="Tipo de fuente">
          {categories.map((item, index) => <button key={item.kind} id={`share-tab-${item.kind}`} role="tab" aria-selected={kind === item.kind} aria-controls="share-sources" tabIndex={kind === item.kind ? 0 : -1}
            onKeyDown={(event) => {
              const next = event.key === 'ArrowRight' ? (index + 1) % categories.length : event.key === 'ArrowLeft' ? (index + categories.length - 1) % categories.length : event.key === 'Home' ? 0 : event.key === 'End' ? categories.length - 1 : -1;
              if (next < 0) return;
              event.preventDefault(); setKind(categories[next].kind); setSelected(null); setQuery('');
              document.getElementById(`share-tab-${categories[next].kind}`)?.focus();
            }}
            onClick={() => { setKind(item.kind); setSelected(null); setQuery(''); }}><SourceIcon kind={item.kind} />{item.label}<span>{sources.filter((source) => source.kind === item.kind).length}</span></button>)}
        </div>
        <button className="share-refresh" disabled={loading || sharing} aria-label="Actualizar vistas previas" onClick={() => void refresh()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M20 12a8 8 0 1 0-2 5" /></svg></button>
      </div>
      <div className="share-list-meta"><p>{category.hint}</p><label className="share-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg><input type="search" aria-label="Buscar fuente" placeholder="Buscar…" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
      {error && <div className="share-error" role="alert"><span>{error}</span><button disabled={loading || sharing} onClick={() => void refresh()}>Reintentar</button></div>}
      <div id="share-sources" className="share-sources" role="tabpanel" aria-labelledby={`share-tab-${kind}`} aria-busy={loading}>
        {loading ? <div className="share-skeletons" role="status" aria-label="Cargando vistas previas">{[0, 1, 2, 3, 4, 5].map((id) => <div key={id} className="share-skeleton" />)}</div>
          : visible.length ? <div className="share-grid" role="group" aria-label="Selecciona una fuente">{visible.map((source) => <button className={`share-card ${source.id === selected ? 'is-selected' : ''}`} key={source.id} aria-pressed={source.id === selected} disabled={sharing} onClick={() => setSelected(source.id)}>
            <span className="share-thumbnail">{source.thumbnail ? <img src={source.thumbnail} alt={`Vista previa de ${source.name}`} draggable={false} /> : <span className="share-no-preview"><SourceIcon kind={source.kind} /><span>Vista previa no disponible</span></span>}<span className="share-selected-check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m6 12 4 4 8-8" /></svg></span></span>
            <span className="share-card-label">{source.appIcon ? <img src={source.appIcon} alt="" /> : <SourceIcon kind={source.kind} />}<span title={source.name}>{source.name}</span></span>
          </button>)}</div>
          : <div className="share-empty"><SourceIcon kind={kind} /><strong>{query ? 'No encontramos esa fuente' : `No hay ${category.label.toLocaleLowerCase('es')} disponibles`}</strong><p>{query ? 'Prueba con otro nombre.' : kind === 'tab' ? 'Abre una pestaña en el navegador del Hub y actualiza las vistas previas.' : 'Abre la aplicación que quieras compartir y actualiza las vistas previas.'}</p></div>}
      </div>
    </section>
    <footer className="share-footer">
      <div className="share-footer-info">{snapshot?.audioAvailable ? <label className="share-audio"><input type="checkbox" checked={audio} disabled={sharing} onChange={(event) => setAudio(event.target.checked)} /><span>Compartir audio del sistema<small>Incluye el sonido de todas las aplicaciones.</small></span></label> : <span className="share-privacy"><SourceIcon kind="window" /><span>La transmisión comienza al pulsar Compartir.</span></span>}<p className="share-selection" aria-live="polite">{choice ? choice.name : 'Selecciona una fuente para continuar'}</p></div>
      <div className="share-actions"><button className="share-cancel" onClick={() => void cancel()}>Cancelar</button><button className="share-confirm" disabled={!choice || loading || sharing} onClick={() => void share()}><SourceIcon kind="screen" />{sharing ? 'Conectando…' : binding ? 'Vincular fuente' : 'Compartir'}</button></div>
    </footer>
  </main>;
}
