import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from './cn';
import { activeOptionIndex, findPrefixOption, nextEnabledOption, normalizeOptionPrefix, type SelectDropdownOption } from './select-dropdown-navigation';
export type { SelectDropdownOption } from './select-dropdown-navigation';

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
  /** Un diálogo nativo necesita que sus opciones pertenezcan a la capa modal. */
  portalContainer: HTMLElement;
}

const MENU_GAP = 6;
const VIEWPORT_MARGIN = 12;
const MAX_MENU_HEIGHT = 288;
const TYPEAHEAD_WINDOW_MS = 500;

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
  const unavailable = disabled || options.length === 0;
  const [requestedOpen, setRequestedOpen] = useState(false);
  const [activeValue, setActiveValue] = useState<string | null>(null);
  const [previousUnavailable, setPreviousUnavailable] = useState(unavailable);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const typeahead = useRef({ text: '', at: 0 });
  const reactId = useId();
  const triggerId = id ?? `select-${reactId}`;
  const listboxId = `${id ?? 'select'}-${reactId}-listbox`;
  const optionId = (index: number) => `${listboxId}-option-${index}`;

  const isCompact = size === 'compact';
  // Ajustar sólo el propio estado durante la transición evita una apertura
  // latente al habilitar de nuevo, sin un efecto que publique primero el menú.
  if (previousUnavailable !== unavailable) {
    setPreviousUnavailable(unavailable);
    if (unavailable) setRequestedOpen(false);
  }
  const open = requestedOpen && !unavailable;
  const activeIndex = open ? activeOptionIndex(options, activeValue, value) : -1;
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
    const maxHeight = Math.max(0, Math.min(MAX_MENU_HEIGHT, available));
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
      portalContainer: trigger.closest('dialog') ?? document.body,
    });
  }, []);

  const closeMenu = useCallback(() => {
    setRequestedOpen(false);
    typeahead.current = { text: '', at: 0 };
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const handleScroll = (event: Event) => {
      // Desplazar las opciones no cambia la posición del trigger ni debe
      // devolver al usuario a la opción activa mientras explora con la rueda.
      if (event.target !== menuRef.current) updatePosition();
    };
    // `true` en captura: el scroll ocurre en el contenedor del modal, no en window.
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      closeMenu();
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open, closeMenu]);

  useLayoutEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    const active = menu?.querySelector<HTMLElement>('[data-active="true"]');
    if (!menu || !active) return;
    // Desplazar sólo la lista evita mover ancestros del diálogo. Medir el
    // rectángulo actual también cubre zoom y cambios de altura del popup.
    const bounds = menu.getBoundingClientRect();
    const item = active.getBoundingClientRect();
    const top = bounds.top + menu.clientTop;
    const bottom = top + menu.clientHeight;
    if (item.top < top || item.height > menu.clientHeight) menu.scrollTop += item.top - top;
    else if (item.bottom > bottom) menu.scrollTop += item.bottom - bottom;
  }, [open, activeIndex, position]);

  function openMenu(startIndex: number) {
    if (unavailable) return;
    setActiveValue(options[startIndex]?.value ?? null);
    typeahead.current = { text: '', at: 0 };
    setRequestedOpen(true);
  }

  function commit(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    closeMenu();
    triggerRef.current?.focus();
  }

  function firstEnabled(step: 1 | -1): number {
    return nextEnabledOption(options, -1, step);
  }

  function explorePrefix(key: string, now: number) {
    const previous = typeahead.current;
    const prefix = normalizeOptionPrefix(key);
    const maxPrefix = options.reduce((longest, option) => Math.max(longest, option.label.length), 1);
    const text = open && now - previous.at < TYPEAHEAD_WINDOW_MS && previous.text.length < maxPrefix
      ? previous.text + prefix : prefix;
    const repeated = Array.from(text).every(character => character === text[0]);
    const query = repeated ? text[0] : text;
    const current = open ? activeIndex : selectedIndex;
    const match = findPrefixOption(options, query, current, current < 0 || (!repeated && text.length > 1));
    if (match >= 0) {
      if (!open) openMenu(match);
      else setActiveValue(options[match].value);
    }
    typeahead.current = { text, at: now };
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (unavailable || event.nativeEvent.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        if (!open) {
          openMenu(selectedIndex >= 0 && !options[selectedIndex].disabled ? selectedIndex : firstEnabled(step));
          return;
        }
        setActiveValue(options[nextEnabledOption(options, activeIndex, step)]?.value ?? null);
        return;
      }
      case 'Home':
      case 'End': {
        if (!open) return;
        event.preventDefault();
        setActiveValue(options[firstEnabled(event.key === 'Home' ? 1 : -1)]?.value ?? null);
        return;
      }
      case 'Enter':
      case ' ': {
        event.preventDefault();
        if (!open) { openMenu(activeOptionIndex(options, null, value)); return; }
        commit(activeIndex);
        return;
      }
      case 'Escape': {
        if (!open) return;
        event.preventDefault();
        event.stopPropagation();
        closeMenu();
        return;
      }
      case 'Tab': {
        // Tab sale del control: el menu no debe quedar huerfano sobre la pagina.
        if (open) closeMenu();
        return;
      }
      default:
        if (event.key.length === 1) {
          event.preventDefault();
          explorePrefix(event.key, event.timeStamp);
        }
    }
  }

  return (
    <div className={cn(isCompact ? 'relative' : 'relative w-full', className)}>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={open && position && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        aria-label={aria['aria-label']}
        aria-labelledby={aria['aria-labelledby']}
        disabled={disabled}
        onClick={() => (open ? closeMenu() : openMenu(activeOptionIndex(options, null, value)))}
        onKeyDown={handleKeyDown}
        onBlur={event => {
          const target = event.relatedTarget;
          if (!(target instanceof Node) || !menuRef.current?.contains(target)) closeMenu();
        }}
        className={cn(
          'group flex items-center justify-between gap-2.5 bg-surface-2 border text-left text-gray-900 dark:text-white transition-colors motion-reduce:transition-none',
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
            'shrink-0 transition-transform duration-200 motion-reduce:transition-none',
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
          aria-labelledby={aria['aria-labelledby'] ?? (aria['aria-label'] ? undefined : triggerId)}
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
            'z-[1000] overflow-y-auto overscroll-contain p-1.5 rounded-2xl transition-none [animation-duration:150ms] motion-reduce:animate-none',
            'bg-surface border border-border backdrop-blur-xl',
            'shadow-[0_18px_50px_rgba(10,37,64,0.16)] dark:shadow-[0_18px_50px_rgba(0,0,0,0.55)]',
            position.placement === 'below'
              ? 'animate-in fade-in slide-in-from-top-1'
              : 'animate-in fade-in slide-in-from-bottom-1',
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
                onMouseEnter={() => {
                  if (!option.disabled) setActiveValue(option.value);
                  typeahead.current = { text: '', at: 0 };
                }}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => commit(index)}
                className={cn(
                  'flex items-start gap-2.5 px-2.5 py-2 rounded-[10px] text-sm cursor-pointer transition-colors motion-reduce:transition-none',
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
        position.portalContainer,
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
