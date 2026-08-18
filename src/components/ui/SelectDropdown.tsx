import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from './cn';

export interface SelectDropdownOption {
  value: string;
  label: string;
  /** Linea secundaria dentro de la opcion (§13.3 del sistema de diseño). */
  description?: string;
  disabled?: boolean;
}

interface SelectDropdownProps {
  value: string;
  onChange: (val: string) => void;
  options: SelectDropdownOption[];
  /** 'default' para modales de settings, 'compact' para uso inline/compartir */
  size?: 'default' | 'compact';
  disabled?: boolean;
  /** Texto mostrado cuando el valor no corresponde a ninguna opcion. */
  placeholder?: string;
  id?: string;
  'aria-label'?: string;
  /** Id del elemento que etiqueta el control (label externo). */
  'aria-labelledby'?: string;
  className?: string;
}

interface MenuPosition {
  left: number;
  top: number;
  /** El menu nunca es mas estrecho que el trigger, pero puede crecer (§13.4). */
  minWidth: number;
  maxWidth: number;
  maxHeight: number;
  placement: 'below' | 'above';
}

const MENU_GAP = 6;
const VIEWPORT_MARGIN = 12;
const MAX_MENU_HEIGHT = 288;

/**
 * Select del sistema SOFIA: trigger + popover propio en lugar del menu nativo,
 * que rompe el branding y no admite descripciones (§13.1).
 *
 * Conserva lo que el nativo daba gratis y el sistema exige: patron ARIA
 * combobox+listbox, navegacion completa por teclado, cierre con Escape/click
 * exterior y foco siempre en el trigger. El menu se renderiza en un portal
 * porque estos selects viven dentro de modales con `overflow-y-auto`, que
 * recortaban el desplegable al abrirse cerca del borde inferior (§13.4).
 */
const SelectDropdown: React.FC<SelectDropdownProps> = ({
  value,
  onChange,
  options,
  size = 'default',
  disabled = false,
  placeholder,
  id,
  className,
  ...aria
}) => {
  const [requestedOpen, setRequestedOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const reactId = useId();
  const listboxId = `${id ?? 'select'}-${reactId}-listbox`;
  const optionId = (index: number) => `${listboxId}-option-${index}`;

  const isCompact = size === 'compact';
  // Derivado en lugar de un efecto que cierre al deshabilitar: si el control se
  // apaga con el menu abierto, este simplemente deja de renderizarse.
  const open = requestedOpen && !disabled;
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedLabel = selectedIndex >= 0
    ? options[selectedIndex].label
    : (placeholder ?? value);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - MENU_GAP - VIEWPORT_MARGIN;
    // Se abre hacia arriba solo si abajo no cabe y arriba hay mas sitio.
    const placement = spaceBelow < Math.min(MAX_MENU_HEIGHT, 160) && spaceAbove > spaceBelow
      ? 'above'
      : 'below';
    const available = placement === 'below' ? spaceBelow : spaceAbove;
    const maxHeight = Math.max(120, Math.min(MAX_MENU_HEIGHT, available));
    const width = rect.width;
    const left = Math.min(
      Math.max(VIEWPORT_MARGIN, rect.left),
      Math.max(VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN),
    );
    setPosition({
      left,
      top: placement === 'below' ? rect.bottom + MENU_GAP : rect.top - MENU_GAP - maxHeight,
      minWidth: width,
      // Solo puede crecer hacia la derecha: se limita a lo que queda de viewport.
      maxWidth: Math.max(width, window.innerWidth - left - VIEWPORT_MARGIN),
      maxHeight,
      placement,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    // `true` en captura: el scroll ocurre en el contenedor del modal, no en window.
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setRequestedOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const active = menuRef.current?.querySelector('[data-active="true"]');
    // scrollIntoView no existe en jsdom ni en algunos WebView embebidos.
    active?.scrollIntoView?.({ block: 'nearest' });
  }, [open, activeIndex]);

  function openMenu(startIndex: number) {
    if (disabled || options.length === 0) return;
    setActiveIndex(startIndex);
    setRequestedOpen(true);
  }

  function commit(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    setRequestedOpen(false);
    triggerRef.current?.focus();
  }

  /** Salta las opciones deshabilitadas y da la vuelta en ambos sentidos. */
  function nextEnabled(from: number, step: 1 | -1): number {
    const total = options.length;
    if (total === 0) return -1;
    // Sin seleccion previa: bajar entra por la primera y subir por la ultima.
    const start = from < 0 ? (step === 1 ? -1 : 0) : from;
    for (let offset = 1; offset <= total; offset += 1) {
      const index = (((start + step * offset) % total) + total) % total;
      if (!options[index]?.disabled) return index;
    }
    return from;
  }

  function firstEnabled(step: 1 | -1): number {
    const start = step === 1 ? 0 : options.length - 1;
    if (!options[start]?.disabled) return start;
    return nextEnabled(start, step);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        if (!open) {
          openMenu(selectedIndex >= 0 ? selectedIndex : firstEnabled(step));
          return;
        }
        setActiveIndex((current) => nextEnabled(current < 0 ? selectedIndex : current, step));
        return;
      }
      case 'Home':
      case 'End': {
        if (!open) return;
        event.preventDefault();
        setActiveIndex(firstEnabled(event.key === 'Home' ? 1 : -1));
        return;
      }
      case 'Enter':
      case ' ': {
        event.preventDefault();
        if (!open) { openMenu(selectedIndex >= 0 ? selectedIndex : firstEnabled(1)); return; }
        commit(activeIndex >= 0 ? activeIndex : selectedIndex);
        return;
      }
      case 'Escape': {
        if (!open) return;
        event.preventDefault();
        setRequestedOpen(false);
        return;
      }
      case 'Tab': {
        // Tab sale del control: el menu no debe quedar huerfano sobre la pagina.
        if (open) setRequestedOpen(false);
        return;
      }
      default:
    }
  }

  return (
    <div className={cn(isCompact ? 'relative' : 'relative w-full', className)}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        aria-label={aria['aria-label']}
        aria-labelledby={aria['aria-labelledby']}
        disabled={disabled}
        onClick={() => (open ? setRequestedOpen(false) : openMenu(selectedIndex >= 0 ? selectedIndex : firstEnabled(1)))}
        onKeyDown={handleKeyDown}
        className={cn(
          'group flex items-center justify-between gap-2.5 bg-surface-2 border text-left text-gray-900 dark:text-white transition-colors',
          'focus:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/15 focus-visible:border-accent/50',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border',
          open ? 'border-accent/50 ring-[3px] ring-accent/15' : 'border-border hover:border-accent/40',
          isCompact
            ? 'min-w-[110px] px-3 py-1.5 rounded-lg text-xs font-medium'
            : 'w-full px-3.5 py-2.5 rounded-xl text-sm',
        )}
      >
        <span className={cn('truncate', selectedIndex < 0 && placeholder ? 'text-secondary' : undefined)}>
          {selectedLabel}
        </span>
        <ChevronIcon
          className={cn(
            'shrink-0 transition-transform duration-200',
            isCompact ? 'w-3.5 h-3.5' : 'w-4 h-4',
            open ? 'rotate-180 text-accent' : 'text-secondary group-hover:text-accent',
          )}
        />
      </button>

      {open && position && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          id={listboxId}
          aria-label={aria['aria-label']}
          tabIndex={-1}
          style={{
            position: 'fixed',
            left: position.left,
            top: position.top,
            minWidth: position.minWidth,
            maxWidth: position.maxWidth,
            maxHeight: position.maxHeight,
          }}
          className={cn(
            'z-[1000] overflow-y-auto overscroll-contain p-1.5 rounded-2xl',
            'bg-surface border border-border backdrop-blur-xl',
            'shadow-[0_18px_50px_rgba(10,37,64,0.16)] dark:shadow-[0_18px_50px_rgba(0,0,0,0.55)]',
            position.placement === 'below'
              ? 'animate-in fade-in slide-in-from-top-1 duration-150'
              : 'animate-in fade-in slide-in-from-bottom-1 duration-150',
          )}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isActive = index === activeIndex;
            return (
              <div
                key={option.value}
                id={optionId(index)}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled || undefined}
                data-active={isActive}
                onMouseEnter={() => !option.disabled && setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => commit(index)}
                className={cn(
                  'flex items-start gap-2.5 px-2.5 py-2 rounded-[10px] text-sm cursor-pointer transition-colors',
                  option.disabled && 'opacity-40 cursor-not-allowed',
                  isActive && !option.disabled && 'bg-accent/[0.07]',
                  isSelected ? 'text-accent font-medium' : 'text-gray-900 dark:text-white',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate', isCompact && 'text-xs')}>{option.label}</span>
                  {option.description && (
                    <span className="block text-[11px] leading-snug text-secondary mt-0.5">
                      {option.description}
                    </span>
                  )}
                </span>
                {isSelected && <CheckIcon className="w-4 h-4 shrink-0 mt-0.5 text-accent" />}
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
};

function ChevronIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function CheckIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export default SelectDropdown;
