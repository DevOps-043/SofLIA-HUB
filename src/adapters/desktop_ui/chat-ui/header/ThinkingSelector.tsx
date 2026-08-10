import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { useModelSelector } from '../../../../hooks/useModelSelector';

export function ThinkingSelector({ model }: { model: ReturnType<typeof useModelSelector> }) {
  const options = useMemo(
    () => model.currentModel?.thinkingOptions || [],
    [model.currentModel?.thinkingOptions],
  );
  const activeIndex = options.findIndex((opt) => opt.id === model.thinkingMode);
  const safeIndex = activeIndex >= 0 ? activeIndex : 0;
  const currentOption = options[safeIndex] || options[0];

  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const updateFromPointer = useCallback((clientX: number) => {
    if (!trackRef.current || options.length <= 1) return;
    const rect = trackRef.current.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, relativeX / rect.width));
    const stepIndex = Math.round(ratio * (options.length - 1));
    const targetOption = options[stepIndex];
    if (targetOption && targetOption.id !== model.thinkingMode) {
      model.setThinkingMode(targetOption.id);
    }
  }, [model, options]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    updateFromPointer(e.clientX);
  };

  useEffect(() => {
    if (!isDragging) return undefined;

    const handlePointerMove = (e: PointerEvent) => {
      updateFromPointer(e.clientX);
    };

    const handlePointerUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, updateFromPointer]);

  const stepRatio = options.length > 1 ? safeIndex / (options.length - 1) : 0;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (options.length <= 1) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      const nextIndex = Math.min(options.length - 1, safeIndex + 1);
      model.setThinkingMode(options[nextIndex].id);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      const prevIndex = Math.max(0, safeIndex - 1);
      model.setThinkingMode(options[prevIndex].id);
    }
  };

  return (
    <div
      className="border-t border-gray-200/80 dark:border-white/10 bg-gray-50/70 dark:bg-[#12161f]/70 px-4 py-3 select-none"
      style={{ fontFamily: 'var(--font-system-ui)' }}
    >
      {/* Encabezado */}
      <div className="mb-2 flex items-center justify-between px-0.5">
        <span
          className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-white/40"
          style={{ fontFamily: 'var(--font-system-label)' }}
        >
          Nivel de Razonamiento
        </span>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-accent/15 border border-accent/25">
          <svg className="w-3 h-3 text-accent animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-[11px] font-bold text-accent" style={{ fontFamily: 'var(--font-system-label)' }}>
            {currentOption?.name}
          </span>
        </div>
      </div>

      {/* Slider Pista de Razonamiento */}
      <div
        ref={trackRef}
        role="slider"
        aria-label="Nivel de razonamiento"
        aria-valuenow={safeIndex + 1}
        aria-valuemin={1}
        aria-valuemax={options.length}
        aria-valuetext={currentOption?.name}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        className="relative my-2.5 h-7 w-full rounded-full bg-gray-200/80 dark:bg-[#1e2329] border border-gray-300/60 dark:border-white/10 cursor-pointer touch-none flex items-center focus:outline-none focus:ring-2 focus:ring-accent/40"
        title="Arrastra o haz clic para ajustar el nivel de razonamiento"
      >
        {/* Barra de progreso de color acento */}
        <div
          className="absolute left-1 top-1 bottom-1 rounded-full bg-accent transition-all duration-150 ease-out shadow-2xs"
          style={{ width: `calc(10px + (100% - 20px) * ${stepRatio})` }}
        />

        {/* Puntos discretos de cada paso */}
        <div className="absolute inset-0 px-3.5 flex items-center justify-between pointer-events-none z-10">
          {options.map((opt, index) => {
            const isReached = index <= safeIndex;
            return (
              <span
                key={opt.id}
                className={`h-1.5 w-1.5 rounded-full transition-all ${
                  isReached ? 'bg-white shadow-xs scale-110' : 'bg-gray-400/40 dark:bg-white/20'
                }`}
              />
            );
          })}
        </div>

        {/* Perilla Deslizante (Thumb Knob) */}
        <div
          className="absolute z-20 h-5.5 w-5.5 rounded-full bg-white shadow-md border border-black/10 dark:border-white/20 transition-all duration-150 ease-out transform -translate-x-1/2 flex items-center justify-center cursor-grab active:cursor-grabbing hover:scale-110"
          style={{ left: `calc(12px + (100% - 24px) * ${stepRatio})` }}
        >
          <div className="h-2 w-2 rounded-full bg-accent" />
        </div>
      </div>

      {/* Descripción del nivel activo */}
      <div className="mt-1 px-0.5 flex items-center justify-between text-[11px] text-gray-500 dark:text-white/45">
        <span className="truncate font-medium">{currentOption?.desc}</span>
        <span
          className="text-[10px] text-gray-400 dark:text-white/35 font-semibold ml-2 shrink-0"
          style={{ fontFamily: 'var(--font-system-label)' }}
        >
          {safeIndex + 1}/{options.length}
        </span>
      </div>
    </div>
  );
}

