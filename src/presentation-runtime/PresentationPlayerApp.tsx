import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  formatDeckValidationError,
  parsePresentationDeck,
  type PresentationDeck,
  type PresentationSlide,
} from '../shared/presentations/deck-schema';
import './presentation-runtime.css';

const ChartSlide = lazy(async () => {
  const module = await import('./components/ChartSlide');
  return { default: module.ChartSlide };
});

const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;

export function PresentationPlayerApp() {
  const embedded = resolveEmbeddedPresentation();
  const [deck, setDeck] = useState<PresentationDeck | null>(() => embedded ? parsePresentationDeck(embedded.deck) : null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(() => resolveInitialSlide());
  const [direction, setDirection] = useState(1);
  const reducedMotion = useReducedMotion();
  const runtime = useMemo(() => resolveRuntimeLocation(), []);
  const scale = useStageScale();
  const wheelLocked = useRef(false);
  const wheelUnlockTimer = useRef<number | null>(null);
  const transitionLocked = useRef(false);
  const transitionUnlockTimer = useRef<number | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    if (embedded?.brandCss) {
      const brandStyle = document.createElement('style');
      brandStyle.dataset.pulseBrand = 'embedded';
      brandStyle.textContent = embedded.brandCss;
      document.head.appendChild(brandStyle);
      return () => brandStyle.remove();
    }
    const brandLink = document.createElement('link');
    brandLink.rel = 'stylesheet';
    brandLink.href = runtime.brandUrl;
    document.head.appendChild(brandLink);
    return () => brandLink.remove();
  }, [embedded?.brandCss, runtime.brandUrl]);

  useEffect(() => {
    if (embedded) return;
    const controller = new AbortController();
    void fetch(runtime.deckUrl, { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error(await response.text() || 'No pude leer deck.json.');
        return response.json() as Promise<unknown>;
      })
      .then((value) => setDeck(parsePresentationDeck(value)))
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(formatDeckValidationError(cause));
      });
    return () => controller.abort();
  }, [embedded, runtime.deckUrl]);

  const move = useCallback((delta: number) => {
    if (!deck || transitionLocked.current) return;
    setIndex((current) => {
      const next = Math.max(0, Math.min(deck.slides.length - 1, current + delta));
      if (next !== current) {
        setDirection(Math.sign(delta) || 1);
        if (!reducedMotion) {
          transitionLocked.current = true;
          setTransitioning(true);
          if (transitionUnlockTimer.current !== null) window.clearTimeout(transitionUnlockTimer.current);
          transitionUnlockTimer.current = window.setTimeout(() => {
            transitionLocked.current = false;
            setTransitioning(false);
          }, 760);
        }
      }
      return next;
    });
  }, [deck, reducedMotion]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(event.key)) {
        event.preventDefault();
        move(1);
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key)) {
        event.preventDefault();
        move(-1);
      } else if (event.key === 'Home') move(Number.NEGATIVE_INFINITY);
      else if (event.key === 'End') move(Number.POSITIVE_INFINITY);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deck, move]);

  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      if (Math.abs(delta) < 18) return;
      event.preventDefault();
      if (wheelLocked.current) return;
      wheelLocked.current = true;
      move(delta > 0 ? 1 : -1);
      if (wheelUnlockTimer.current !== null) window.clearTimeout(wheelUnlockTimer.current);
      wheelUnlockTimer.current = window.setTimeout(() => { wheelLocked.current = false; }, 620);
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      window.removeEventListener('wheel', onWheel);
      if (wheelUnlockTimer.current !== null) window.clearTimeout(wheelUnlockTimer.current);
      if (transitionUnlockTimer.current !== null) window.clearTimeout(transitionUnlockTimer.current);
      wheelLocked.current = false;
      transitionLocked.current = false;
    };
  }, [move]);

  if (error) return <RuntimeError message={error} />;
  if (!deck) return <RuntimeLoading />;
  const safeIndex = Math.min(index, deck.slides.length - 1);
  const slide = deck.slides[safeIndex];
  const themeStyle = resolveDeckThemeStyle(deck);

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#071119] text-white" aria-label={deck.meta.titulo}>
      <div
        className="absolute left-1/2 top-1/2 overflow-hidden bg-[var(--marca-color-fondo,#f7f3e9)] text-[var(--marca-color-texto,#10151c)] shadow-[0_30px_100px_rgba(0,0,0,.38)]"
        style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT, transform: `translate(-50%, -50%) scale(${scale})`, ...themeStyle }}
      >
        <AnimatePresence initial={false} custom={{ direction, continuity: slide.movimiento.continuidad }} mode="sync">
          <SlideFrame
            key={slide.id}
            slide={slide}
            index={safeIndex}
            total={deck.slides.length}
            direction={direction}
            reducedMotion={Boolean(reducedMotion)}
            assetBase={runtime.assetBase}
            embeddedAssets={embedded?.assets}
          />
        </AnimatePresence>
        <div className="absolute bottom-0 left-0 right-0 z-50 h-1.5 bg-black/5" aria-hidden>
          <motion.div
            className="h-full bg-[var(--marca-color-acento)]"
            initial={false}
            animate={{ width: `${((safeIndex + 1) / deck.slides.length) * 100}%` }}
            transition={reducedMotion ? { duration: 0.01 } : { type: 'spring', stiffness: 180, damping: 28 }}
          />
        </div>
        <nav className="absolute bottom-8 right-10 z-50 flex items-center gap-3" aria-label="Navegacion de diapositivas">
          <button className="runtime-nav" onClick={() => move(-1)} disabled={safeIndex === 0 || transitioning} aria-label="Diapositiva anterior">←</button>
          <button className="runtime-nav" onClick={() => move(1)} disabled={safeIndex === deck.slides.length - 1 || transitioning} aria-label="Diapositiva siguiente">→</button>
        </nav>
      </div>
    </main>
  );
}

function SlideFrame(props: {
  slide: PresentationSlide;
  index: number;
  total: number;
  direction: number;
  reducedMotion: boolean;
  assetBase: string;
  embeddedAssets?: Record<string, string>;
}) {
  const { slide, direction, reducedMotion } = props;
  const transition = reducedMotion ? { duration: 0.01 } : { duration: 0.72, ease: [0.22, 1, 0.36, 1] as const };
  const states = sceneStates(slide.movimiento.continuidad, direction, reducedMotion);
  return (
    <motion.article
      className="absolute inset-0 isolate overflow-hidden"
      custom={{ direction, continuity: slide.movimiento.continuidad }}
      initial={states.initial}
      animate={states.animate}
      exit={states.exit}
      transition={transition}
    >
      <Atmosphere emphasis={slide.movimiento.enfasis} reducedMotion={reducedMotion} />
      <SlideContent slide={slide} reducedMotion={reducedMotion} assetBase={props.assetBase} embeddedAssets={props.embeddedAssets} />
      <footer className="absolute bottom-12 left-16 right-16 z-30 flex items-end justify-between border-t border-current/15 pt-5 text-[17px] font-semibold uppercase tracking-[.18em] opacity-55">
        <span className="max-w-[75%] truncate">{slide.fuente ?? 'Pulse Hub · Presentacion ejecutiva'}</span>
        <span>{String(props.index + 1).padStart(2, '0')} / {String(props.total).padStart(2, '0')}</span>
      </footer>
    </motion.article>
  );
}

function SlideContent(props: { slide: PresentationSlide; reducedMotion: boolean; assetBase: string; embeddedAssets?: Record<string, string> }) {
  const { slide } = props;
  const item = contentVariants(slide.movimiento.entrada, props.reducedMotion);
  const group = { hidden: {}, visible: { transition: { delayChildren: 0.18, staggerChildren: props.reducedMotion ? 0 : 0.1 } } };
  const common = { variants: item, initial: 'hidden', animate: 'visible' } as const;
  const hoverLift = interactiveHover(props.reducedMotion);
  const variante = slide.variante ?? 'editorial';
  const composicion = `runtime-composition runtime-composition--${variante}`;
  const header = (
    <>
      {slide.antetitulo ? <motion.p {...common} className="runtime-eyebrow">{slide.antetitulo}</motion.p> : null}
      <motion.h1 {...common} className="runtime-title">{slide.titulo}</motion.h1>
    </>
  );

  if (slide.tipo === 'portada') {
    return <motion.div variants={group} initial="hidden" animate="visible" className={`${composicion} runtime-pad grid h-full items-center gap-20 pb-40 ${variante === 'visual-dominante' ? 'grid-cols-[.78fr_1.22fr]' : 'grid-cols-[1.05fr_.95fr]'}`}>
      <div className="relative z-20">{header}{slide.subtitulo ? <motion.p {...common} className="runtime-lead mt-9">{slide.subtitulo}</motion.p> : null}{slide.texto ? <motion.p {...common} className="mt-7 max-w-[900px] text-[23px] leading-relaxed opacity-60">{slide.texto}</motion.p> : null}</div>
      <motion.div {...common} {...hoverLift} className="runtime-media runtime-surface runtime-interactive relative h-[720px] overflow-hidden rounded-[54px] shadow-2xl">
        {slide.imagen ? <RuntimeImage image={slide.imagen} assetBase={props.assetBase} embeddedAssets={props.embeddedAssets} /> : <GraphicField />}
      </motion.div>
    </motion.div>;
  }

  if (slide.tipo === 'declaracion') {
    const copy = <div className="max-w-[1500px]">{header}{slide.texto ? <motion.p {...common} className="runtime-lead mt-10 max-w-[1100px]">{slide.texto}</motion.p> : null}<RuntimePoints points={slide.puntos} common={common} />{slide.acento ? <motion.div {...common} className="mt-12 inline-flex w-fit border-l-[10px] border-[var(--marca-color-acento)] pl-7 text-[34px] font-bold">{slide.acento}</motion.div> : null}</div>;
    return <motion.div variants={group} initial="hidden" animate="visible" className={`${composicion} runtime-pad grid h-full items-center gap-20 pb-36 ${slide.imagen ? (variante === 'visual-dominante' ? 'grid-cols-[.78fr_1.22fr]' : 'grid-cols-[1.1fr_.9fr]') : 'grid-cols-1'}`}>{copy}{slide.imagen ? <motion.div {...common} {...hoverLift} className="runtime-media runtime-surface runtime-interactive h-[650px] overflow-hidden rounded-[48px]"><RuntimeImage image={slide.imagen} assetBase={props.assetBase} embeddedAssets={props.embeddedAssets} /></motion.div> : null}</motion.div>;
  }

  if (slide.tipo === 'division') {
    const text = <div className="self-center">{header}<motion.p {...common} className="runtime-lead mt-9">{slide.texto}</motion.p></div>;
    const visual = 'bloques' in slide && slide.bloques
      ? <motion.div {...common} className="grid grid-cols-2 gap-5">{slide.bloques.map((block) => <CompareBlock key={block.titulo} block={block} item={item} reducedMotion={props.reducedMotion} />)}</motion.div>
      : <motion.div {...common} {...hoverLift} className="runtime-media runtime-surface runtime-interactive h-[690px] overflow-hidden rounded-[44px] shadow-xl"><RuntimeImage image={slide.imagen} assetBase={props.assetBase} embeddedAssets={props.embeddedAssets} /></motion.div>;
    return <motion.div variants={group} initial="hidden" animate="visible" className={`${composicion} runtime-pad grid h-full items-center gap-24 pb-36 ${variante === 'visual-dominante' ? 'grid-cols-[.65fr_1.35fr]' : 'grid-cols-[.9fr_1.1fr]'}`}>{slide.ladoImagen === 'izquierda' ? <>{visual}{text}</> : <>{text}{visual}</>}</motion.div>;
  }

  if (slide.tipo === 'comparacion') {
    const compacta = variante === 'compacta' || variante === 'secuencial';
    const content = 'filas' in slide && slide.filas
      ? <div className={`grid gap-5 ${compacta ? 'grid-cols-1' : 'grid-cols-2'}`}>{slide.filas.map((row, index) => <motion.div {...common} {...hoverLift} key={row.proyecto} className={`runtime-interactive border-t-[7px] p-7 ${index % 2 ? 'border-[var(--marca-color-acento)] bg-[var(--marca-color-primario)] text-[var(--deck-on-primary)]' : 'runtime-surface border-current/25'}`}><h2 className="text-[31px] font-black">{row.proyecto}</h2><p className="mt-3 text-[21px] leading-snug opacity-75">{row.enfoque}</p></motion.div>)}</div>
      : <div className={`grid gap-8 ${compacta ? 'grid-cols-1' : 'grid-cols-2'}`}><CompareBlock block={slide.izquierda} item={item} compact={compacta} reducedMotion={props.reducedMotion} /><CompareBlock block={slide.derecha} item={item} compact={compacta} primary reducedMotion={props.reducedMotion} /></div>;
    return <motion.div variants={group} initial="hidden" animate="visible" className={`${composicion} runtime-pad h-full pb-36 pt-24`}>{header}{slide.texto ? <motion.p {...common} className="runtime-lead mt-5">{slide.texto}</motion.p> : null}<div className={`mt-10 grid items-stretch gap-7 ${slide.imagen ? (variante === 'visual-dominante' ? 'grid-cols-[.8fr_1.2fr]' : 'grid-cols-[1.38fr_.62fr]') : 'grid-cols-1'}`}><div>{content}</div>{slide.imagen ? <motion.div {...common} {...hoverLift} className="runtime-media runtime-surface runtime-interactive min-h-[420px] overflow-hidden rounded-[34px]"><RuntimeImage image={slide.imagen} assetBase={props.assetBase} embeddedAssets={props.embeddedAssets} /></motion.div> : null}</div>{slide.pie ? <motion.p {...common} className="mt-6 text-[20px] font-semibold opacity-60">{slide.pie}</motion.p> : null}</motion.div>;
  }

  if (slide.tipo === 'proceso') {
    const tarjetas = variante === 'compacta' || variante === 'inmersiva';
    return <motion.div variants={group} initial="hidden" animate="visible" className={`${composicion} runtime-pad h-full pb-36 pt-24`}><div className={slide.imagen ? `grid items-center gap-12 ${variante === 'visual-dominante' ? 'grid-cols-[.8fr_1.2fr]' : 'grid-cols-[1.35fr_.65fr]'}` : ''}><div>{header}{slide.introduccion || slide.texto ? <motion.p {...common} className="runtime-lead mt-5">{slide.introduccion ?? slide.texto}</motion.p> : null}</div>{slide.imagen ? <motion.div {...common} {...hoverLift} className={`runtime-media runtime-surface runtime-interactive overflow-hidden rounded-[30px] ${variante === 'visual-dominante' ? 'h-[360px]' : 'h-[250px]'}`}><RuntimeImage image={slide.imagen} assetBase={props.assetBase} embeddedAssets={props.embeddedAssets} /></motion.div> : null}</div><div className="relative mt-14 grid gap-6" style={{ gridTemplateColumns: `repeat(${tarjetas ? Math.min(slide.pasos.length, 3) : slide.pasos.length}, minmax(0,1fr))` }}>{tarjetas ? null : <div className="absolute left-[8%] right-[8%] top-11 h-1 bg-[var(--marca-color-secundario)]/30" />}{slide.pasos.map((paso, i) => <motion.div {...common} {...hoverLift} key={paso.titulo} className={`runtime-interactive relative z-10 rounded-[24px] p-3 ${tarjetas ? 'runtime-surface border border-current/10 px-7 py-6' : ''}`}><span className="grid h-24 w-24 place-items-center rounded-full border-[5px] border-[var(--marca-color-primario)] bg-[var(--marca-color-fondo)] text-[30px] font-black">{paso.numero ?? String(i + 1).padStart(2, '0')}</span><h2 className="mt-6 text-[31px] font-black leading-tight">{paso.titulo}</h2>{paso.texto ? <p className="mt-3 text-[22px] leading-snug opacity-70">{paso.texto}</p> : null}</motion.div>)}</div></motion.div>;
  }

  if (slide.tipo === 'metricas') {
    const columnasMetricas = variante === 'compacta' ? slide.metricas.length : Math.min(slide.metricas.length, 2);
    return <motion.div variants={group} initial="hidden" animate="visible" className={`${composicion} runtime-pad h-full pb-36 pt-24`}>{header}{slide.introduccion || slide.texto ? <motion.p {...common} className="runtime-lead mt-5">{slide.introduccion ?? slide.texto}</motion.p> : null}<div className={`mt-12 grid gap-6 ${slide.imagen ? (variante === 'visual-dominante' ? 'grid-cols-[.8fr_1.2fr]' : 'grid-cols-[1.45fr_.55fr]') : 'grid-cols-1'}`}><div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${columnasMetricas}, minmax(0,1fr))` }}>{slide.metricas.map((metric) => <motion.div {...common} {...hoverLift} key={metric.etiqueta} className="runtime-surface runtime-interactive border-t-[8px] border-[var(--marca-color-acento)] px-8 py-8"><strong className="block text-[68px] font-black tracking-[-.06em] text-[var(--marca-color-primario)]">{metric.valor}</strong><h2 className="mt-4 text-[28px] font-black">{metric.etiqueta}</h2>{metric.detalle || metric.nota ? <p className="mt-3 text-[20px] leading-snug opacity-65">{metric.detalle ?? metric.nota}</p> : null}</motion.div>)}</div>{slide.imagen ? <motion.div {...common} {...hoverLift} className="runtime-media runtime-surface runtime-interactive overflow-hidden rounded-[34px]"><RuntimeImage image={slide.imagen} assetBase={props.assetBase} embeddedAssets={props.embeddedAssets} /></motion.div> : null}</div></motion.div>;
  }

  if (slide.tipo === 'grafica') {
    return <Suspense fallback={<div className="runtime-pad grid h-full place-items-center text-[24px] font-bold opacity-60">Preparando visualizacion…</div>}><ChartSlide slide={slide} reducedMotion={props.reducedMotion} header={header} common={common} group={group} visual={slide.imagen ? <RuntimeImage image={slide.imagen} assetBase={props.assetBase} embeddedAssets={props.embeddedAssets} /> : undefined} /></Suspense>;
  }

  if (slide.tipo === 'cita') {
    if ('citas' in slide && slide.citas) return <motion.div variants={group} initial="hidden" animate="visible" className={`${composicion} runtime-pad h-full pb-36 pt-24`}>{header}<div className={`mt-12 grid gap-6 ${variante === 'secuencial' ? 'grid-cols-1' : 'grid-cols-3'}`}>{slide.citas.map((quote) => <motion.blockquote {...common} {...hoverLift} key={quote.texto} className="runtime-surface runtime-interactive border-t-[8px] border-[var(--marca-color-acento)] p-8"><p className="text-[28px] font-black leading-tight">“{quote.texto}”</p><footer className="mt-6 text-[18px] font-semibold opacity-60">{quote.atribucion}</footer></motion.blockquote>)}</div></motion.div>;
    return <motion.div variants={group} initial="hidden" animate="visible" className={`${composicion} runtime-pad grid h-full items-center gap-20 pb-36 ${variante === 'visual-dominante' ? 'grid-cols-[.75fr_1.25fr]' : 'grid-cols-[1.25fr_.75fr]'}`}><div>{slide.antetitulo ? <motion.p {...common} className="runtime-eyebrow">{slide.antetitulo}</motion.p> : null}<motion.blockquote {...common} className="text-[68px] font-black leading-[1.06] tracking-[-.045em]">“{slide.cita}”</motion.blockquote><motion.p {...common} className="mt-10 text-[26px] font-bold">{slide.autor}{slide.cargo ? <span className="font-normal opacity-60"> · {slide.cargo}</span> : null}</motion.p></div><motion.div {...common} {...hoverLift} className="runtime-media runtime-surface runtime-interactive h-[620px] overflow-hidden rounded-full border-[14px] border-[var(--deck-color-superficie)]">{slide.imagen ? <RuntimeImage image={slide.imagen} assetBase={props.assetBase} embeddedAssets={props.embeddedAssets} /> : <GraphicField />}</motion.div></motion.div>;
  }

  return <motion.div variants={group} initial="hidden" animate="visible" className={`${composicion} runtime-pad grid h-full items-center gap-20 pb-36 ${variante === 'visual-dominante' ? 'grid-cols-[.78fr_1.22fr]' : 'grid-cols-[1.05fr_.95fr]'}`}><div>{header}{slide.texto ? <motion.p {...common} className="runtime-lead mt-8">{slide.texto}</motion.p> : null}<RuntimePoints points={slide.puntos} common={common} /><motion.div {...common} whileHover={props.reducedMotion ? undefined : { scale: 1.035, x: 8 }} transition={{ type: 'spring', stiffness: 320, damping: 24 }} className="runtime-interactive mt-12 inline-flex rounded-full bg-[var(--marca-color-primario)] px-10 py-6 text-[27px] font-black text-[var(--deck-on-primary)]">{slide.accion} →</motion.div></div><motion.div {...common} {...hoverLift} className="runtime-media runtime-surface runtime-interactive h-[650px] overflow-hidden rounded-[54px]">{slide.imagen ? <RuntimeImage image={slide.imagen} assetBase={props.assetBase} embeddedAssets={props.embeddedAssets} /> : <GraphicField />}</motion.div></motion.div>;
}

function RuntimePoints(props: { points?: string[]; common: Record<string, unknown> }) {
  if (!props.points?.length) return null;
  return <motion.ul {...props.common} className="mt-8 grid max-w-[1100px] grid-cols-2 gap-x-8 gap-y-3 text-[22px] font-semibold leading-snug">{props.points.map((point) => <li key={point} className="flex gap-3"><span className="text-[var(--marca-color-acento)]">●</span><span>{point}</span></li>)}</motion.ul>;
}

function CompareBlock(props: { block: { etiqueta?: string; titulo: string; texto?: string; puntos?: string[] }; item: ReturnType<typeof contentVariants>; primary?: boolean; compact?: boolean; reducedMotion: boolean }) {
  return <motion.section variants={props.item} {...interactiveHover(props.reducedMotion)} className={`runtime-interactive border-t-[8px] p-10 ${props.compact ? 'min-h-[210px]' : 'min-h-[430px]'} ${props.primary ? 'border-[var(--marca-color-acento)] bg-[var(--marca-color-primario)] text-[var(--deck-on-primary)]' : 'runtime-surface border-current/25'}`}>
    {props.block.etiqueta ? <p className="text-[18px] font-bold uppercase tracking-[.17em] opacity-65">{props.block.etiqueta}</p> : null}
    <h2 className="mt-5 text-[42px] font-black leading-tight">{props.block.titulo}</h2>
    {props.block.texto ? <p className="mt-5 text-[24px] leading-snug opacity-75">{props.block.texto}</p> : null}
    {props.block.puntos ? <ul className="mt-7 space-y-4 text-[23px] leading-snug">{props.block.puntos.map((point) => <li key={point} className="flex gap-4"><span aria-hidden>—</span><span>{point}</span></li>)}</ul> : null}
  </motion.section>;
}

function RuntimeImage(props: { image: { src: string; alt: string; ajuste: 'cubrir' | 'contener'; posicion: string }; assetBase: string; embeddedAssets?: Record<string, string> }) {
  const source = props.embeddedAssets?.[props.image.src] ?? `${props.assetBase}${props.image.src.replace(/^assets\//, '')}`;
  if (props.image.ajuste === 'cubrir') {
    return <img src={source} alt={props.image.alt} className={`runtime-image--cover h-full w-full object-cover ${positionClass(props.image.posicion)}`} />;
  }
  return <div className="runtime-image-stack h-full w-full">
    <img src={source} alt="" aria-hidden className={`runtime-image-backdrop absolute inset-0 h-full w-full object-cover ${positionClass(props.image.posicion)}`} />
    <div className="runtime-image-veil absolute inset-0" aria-hidden />
    <img src={source} alt={props.image.alt} className={`runtime-image-foreground relative z-10 h-full w-full object-contain p-[3%] ${positionClass(props.image.posicion)}`} />
  </div>;
}

function Atmosphere({ emphasis, reducedMotion }: { emphasis: PresentationSlide['movimiento']['enfasis']; reducedMotion: boolean }) {
  return <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, scale: .72, x: -70 }}
      animate={{ opacity: .15, scale: emphasis === 'pulso' ? 1.12 : 1, x: emphasis === 'recorrido' ? 80 : 0 }}
      transition={reducedMotion ? { duration: .01 } : { duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
      className="absolute -left-40 -top-52 h-[680px] w-[680px] rounded-full bg-[var(--marca-color-secundario)] blur-[90px]"
    />
    <div className="absolute -bottom-80 right-0 h-[760px] w-[760px] rounded-full bg-[var(--marca-color-acento)] opacity-10 blur-[110px]" />
    <div className="runtime-grid absolute inset-0 opacity-[.07]" />
  </div>;
}

function GraphicField() {
  return <svg viewBox="0 0 800 800" className="h-full w-full" aria-hidden><g fill="none" stroke="var(--marca-color-primario)" strokeWidth="5" opacity=".65"><circle cx="400" cy="400" r="250"/><circle cx="400" cy="400" r="150"/><path d="M80 400h640M400 80v640M180 180l440 440M620 180 180 620"/></g><circle cx="400" cy="400" r="72" fill="var(--marca-color-acento)" opacity=".9"/></svg>;
}

function sceneStates(continuity: PresentationSlide['movimiento']['continuidad'], direction: number, reduced: boolean) {
  if (reduced) return { initial: { opacity: 0, pointerEvents: 'none' as const }, animate: { opacity: 1, pointerEvents: 'auto' as const }, exit: { opacity: 0, pointerEvents: 'none' as const } };
  if (continuity === 'zoom') return { initial: { opacity: 0, scale: direction > 0 ? .9 : 1.1, filter: 'blur(12px)', pointerEvents: 'none' as const }, animate: { opacity: 1, scale: 1, filter: 'blur(0px)', pointerEvents: 'auto' as const }, exit: { opacity: 0, scale: direction > 0 ? 1.1 : .9, filter: 'blur(10px)', pointerEvents: 'none' as const } };
  if (continuity === 'empuje') return { initial: { opacity: 0, x: direction * 220, pointerEvents: 'none' as const }, animate: { opacity: 1, x: 0, pointerEvents: 'auto' as const }, exit: { opacity: 0, x: direction * -180, pointerEvents: 'none' as const } };
  if (continuity === 'corte') return { initial: { opacity: 0, pointerEvents: 'none' as const }, animate: { opacity: 1, pointerEvents: 'auto' as const }, exit: { opacity: 0, pointerEvents: 'none' as const } };
  return { initial: { opacity: 0, y: direction * 80, scale: .985, pointerEvents: 'none' as const }, animate: { opacity: 1, y: 0, scale: 1, pointerEvents: 'auto' as const }, exit: { opacity: 0, y: direction * -60, scale: 1.012, pointerEvents: 'none' as const } };
}

function interactiveHover(reduced: boolean) {
  return {
    whileHover: reduced ? undefined : { y: -9, scale: 1.012 },
    transition: { type: 'spring' as const, stiffness: 300, damping: 25 },
  };
}

function contentVariants(entrance: PresentationSlide['movimiento']['entrada'], reduced: boolean) {
  if (reduced) return { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: .01 } } };
  const hidden = entrance === 'foco' ? { opacity: 0, filter: 'blur(18px)', scale: .985 } : entrance === 'revelado' ? { opacity: 0, clipPath: 'inset(0 100% 0 0)' } : entrance === 'trazo' ? { opacity: 0, x: -42 } : { opacity: 0, y: 42 };
  return { hidden, visible: { opacity: 1, x: 0, y: 0, scale: 1, filter: 'blur(0px)', clipPath: 'inset(0 0% 0 0)', transition: { duration: .68, ease: [0.22, 1, 0.36, 1] as const } } };
}

function resolveDeckThemeStyle(deck: PresentationDeck): CSSProperties {
  const base = {
    '--deck-color-superficie': 'color-mix(in srgb,var(--marca-color-fondo) 88%,var(--marca-color-texto) 12%)',
    '--deck-on-primary': '#ffffff',
  } as CSSProperties;
  const tema = deck.meta.tema;
  if (!tema || tema.origen === 'organizacion') return base;
  return {
    ...base,
    '--marca-color-fondo': tema.fondo,
    '--marca-color-texto': tema.texto,
    '--marca-color-texto-tenue': `color-mix(in srgb,${tema.texto} 68%,transparent)`,
    '--marca-color-primario': tema.primario,
    '--marca-color-secundario': tema.secundario,
    '--marca-color-acento': tema.acento,
    '--deck-color-superficie': tema.superficie,
    '--deck-on-primary': readableForeground(tema.primario),
  } as CSSProperties;
}

function readableForeground(hex: string): '#08121c' | '#ffffff' {
  const [r, g, b] = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const luminance = (0.2126 * (r ?? 0)) + (0.7152 * (g ?? 0)) + (0.0722 * (b ?? 0));
  return luminance > 0.62 ? '#08121c' : '#ffffff';
}

function useStageScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const measure = () => setScale(Math.min(window.innerWidth / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT));
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  return scale;
}

function resolveRuntimeLocation() {
  const query = new URLSearchParams(window.location.search);
  const root = window.location.pathname.endsWith('/') ? window.location.pathname : `${window.location.pathname}/`;
  const deckUrl = query.get('deck') ?? `${root}deck.json`;
  const assetBase = query.get('assets') ?? `${root}assets/`;
  const brandUrl = query.get('brand') ?? `${root}estilos/marca.css`;
  return { deckUrl, assetBase, brandUrl };
}

function resolveInitialSlide() {
  const value = Number(new URLSearchParams(window.location.search).get('slide') ?? 0);
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function resolveEmbeddedPresentation() {
  return (window as Window & { __PULSE_PRESENTATION__?: { deck: unknown; brandCss?: string; assets?: Record<string, string> } }).__PULSE_PRESENTATION__;
}

function positionClass(position: string) {
  return position === 'arriba' ? 'object-top' : position === 'derecha' ? 'object-right' : position === 'izquierda' ? 'object-left' : 'object-center';
}

function RuntimeLoading() { return <div className="fixed inset-0 grid place-items-center bg-[#071119] text-white"><div className="h-14 w-14 animate-spin rounded-full border-4 border-white/20 border-t-[var(--marca-color-acento,#00d4b3)]" /></div>; }
function RuntimeError({ message }: { message: string }) { return <div className="fixed inset-0 grid place-items-center bg-[#071119] p-10 text-white"><section className="max-w-3xl border-l-4 border-amber-400 bg-white/5 p-8"><p className="text-sm font-bold uppercase tracking-widest text-amber-300">Presentacion invalida</p><h1 className="mt-3 text-3xl font-black">No se puede reproducir deck.json</h1><pre className="mt-5 whitespace-pre-wrap font-sans text-base leading-relaxed text-white/70">{message}</pre></section></div>; }
