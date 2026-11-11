import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { MODEL_OPTIONS, useModelSelector } from '../../hooks/useModelSelector';
import '../../styles/floating-soflia-chat.css';
import { useFloatingChatPosition } from './useFloatingChatPosition';
import type { FloatingBounds } from './floating-chat-position';

interface Props {
  title?: string;
  children: ReactNode;
  navigation?: ReactNode;
  openRequest?: unknown;
  onPrepare?: () => Promise<void>;
  onHeightChange?: (height: number) => void;
  onNewChat?: () => Promise<void>;
  onBoundsChange?: (bounds: FloatingBounds) => void;
}

/** Panel del renderer: no abre ventanas ni activa el orbe externo. */
export function FloatingSofliaChat({ children, navigation, openRequest, onPrepare, onHeightChange, onNewChat, onBoundsChange }: Props) {
  const [open, setOpen] = useState(false), [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const root = useRef<HTMLDivElement>(null), launcher = useRef<HTMLButtonElement>(null);
  const live = useRef(true), pending = useRef(false);
  const focusInput = useRef(false);
  const placement = useFloatingChatPosition(root, onBoundsChange);
  const prepare = useRef(onPrepare);
  useLayoutEffect(() => { prepare.current = onPrepare; }, [onPrepare]);
  const model = useModelSelector();
  const show = useCallback(async () => {
    if (pending.current) return;
    pending.current = true; setOpen(true); setBusy(true); setError('');
    try { await prepare.current?.(); if (live.current) setMounted(true); }
    catch { if (live.current) setError('No se pudo preparar el chat. Vuelve a intentarlo.'); }
    finally { if (live.current) { setBusy(false); pending.current = false; } }
  }, []);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  useEffect(() => {
    if (!openRequest) return;
    let active = true;
    queueMicrotask(() => { if (active) void show(); });
    return () => { active = false; };
  }, [openRequest, show]);
  useLayoutEffect(() => {
    const element = root.current;
    if (!element || !onHeightChange) return;
    const update = () => onHeightChange(Math.ceil(element.getBoundingClientRect().height) + 24);
    const observer = new ResizeObserver(update); observer.observe(element); update();
    return () => { observer.disconnect(); onHeightChange(0); };
  }, [onHeightChange, open, busy, mounted]);
  useEffect(() => {
    if (!open) { if (mounted) launcher.current?.focus(); return; }
    if (busy) return;
    if (!focusInput.current) return;
    const frame = requestAnimationFrame(() => { root.current?.querySelector<HTMLElement>('textarea:not(:disabled), [role="alert"] button')?.focus(); focusInput.current = false; });
    return () => cancelAnimationFrame(frame);
  }, [open, busy, mounted]);
  const minimize = () => { setOpen(false); model.setIsModelSelectorOpen(false); };
  const newChat = async () => {
    if (pending.current || !onNewChat) return;
    pending.current = true; setBusy(true); setError(''); model.setIsModelSelectorOpen(false);
    try { await onNewChat(); }
    catch { if (live.current) setError('No se pudo crear el chat. Inténtalo de nuevo.'); }
    finally { if (live.current) { pending.current = false; setBusy(false); } }
  };
  return <div ref={root} className="soflia-floating-dock" data-soflia-floating="true" data-dragging={placement.dragging || undefined} data-native-browser-overlay={placement.dragging ? 'true' : undefined} style={placement.style} onKeyDown={event => {
    if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); if (model.isModelSelectorOpen) model.setIsModelSelectorOpen(false); else minimize(); }
  }}>
    <section className="soflia-floating-card" hidden={!open} aria-label="Chat flotante con Soflia">
      <header className="soflia-floating-header">
        <button type="button" className="soflia-floating-grip" aria-label="Mover chat flotante" title="Arrastra para mover · Flechas para ajustar" {...placement.grip}><svg viewBox="0 0 24 16" aria-hidden="true"><path d="M7 5h.01M12 5h.01M17 5h.01M7 11h.01M12 11h.01M17 11h.01" /></svg></button>
        {onNewChat && <button type="button" className="soflia-floating-new" disabled={busy} onClick={() => void newChat()} aria-label="Nuevo chat" title="Nuevo chat"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></button>}
        <div className="relative">
          <button type="button" className="soflia-floating-model" aria-label="Modelo del chat flotante" title={`Elegir modelo · ${model.currentModel.name}`} aria-expanded={model.isModelSelectorOpen} onClick={() => model.setIsModelSelectorOpen(!model.isModelSelectorOpen)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5" /></svg><span aria-hidden="true">⌄</span></button>
        </div>
        <button type="button" className="soflia-floating-minimize" title="Minimizar" aria-label="Minimizar chat flotante" onClick={minimize}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /></svg></button>
      </header>
      {model.isModelSelectorOpen && <div role="menu" aria-label="Modelos de Soflia" className="soflia-floating-model-menu">
        {MODEL_OPTIONS.map(option => <button key={option.id} type="button" role="menuitemradio" aria-checked={model.preferredPrimaryModel === option.id} onClick={() => model.handleModelChange(option.id)}><span><strong>{option.name}</strong><small>{option.desc}</small></span><span aria-hidden="true">{model.preferredPrimaryModel === option.id ? '✓' : ''}</span></button>)}
        {model.currentModel.thinkingOptions.length > 1 && <label className="soflia-floating-thinking">Razonamiento<select aria-label="Nivel de razonamiento" value={model.thinkingMode} onChange={event => model.setThinkingMode(event.target.value)}>{model.currentModel.thinkingOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>}
      </div>}
      {navigation && <div className="soflia-floating-navigation">{navigation}</div>}
      {busy && <p role="status" className="soflia-floating-notice">Preparando conversación…</p>}
      {error && <div className="soflia-floating-notice" role="alert">{error} <button type="button" onClick={() => void show()}>Reintentar</button></div>}
      {mounted && <div className="soflia-floating-content" hidden={busy || !!error}>{children}</div>}
    </section>
    <button ref={launcher} type="button" className="soflia-floating-launcher" hidden={open} title="Hablar con Soflia" aria-label="Abrir chat flotante con Soflia" aria-expanded={open} disabled={busy} onClick={event => { focusInput.current = event.detail === 0; void show(); }}><img src="./assets/Icono.png" alt="Icono de Soflia" width="28" height="28" /></button>
  </div>;
}
