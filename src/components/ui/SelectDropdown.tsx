import { useState, useEffect, useRef } from 'react';

interface SelectDropdownProps {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  /** 'default' para modales de settings, 'compact' para uso inline/compartir */
  size?: 'default' | 'compact';
}

const SelectDropdown: React.FC<SelectDropdownProps> = ({ value, onChange, options, size = 'default' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selected = options.find(o => o.value === value)?.label || value;

  const isCompact = size === 'compact';

  return (
    <div ref={ref} className={isCompact ? 'relative' : 'relative w-full'}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={
          isCompact
            ? 'flex items-center gap-2.5 px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-xs font-medium text-gray-900 dark:text-white hover:border-accent/40 focus:outline-none focus:ring-2 focus:ring-accent/15 transition-all min-w-[110px] justify-between group'
            : 'w-full px-3.5 py-2.5 bg-surface-2 border border-border rounded-xl text-gray-900 dark:text-white text-sm text-left flex items-center justify-between hover:border-accent/40 focus:outline-none focus:ring-2 focus:ring-accent/15 transition-all group'
        }
      >
        <span className={`${isCompact ? 'truncate ' : ''}transition-colors`}>{selected}</span>
        <svg
          className={`${isCompact ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-secondary transition-all duration-300 ${open ? 'rotate-180 text-accent' : 'group-hover:text-accent'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className={`absolute top-full left-0 right-0 mt-2 bg-surface border border-border rounded-xl shadow-lg dark:shadow-[0_10px_40px_rgba(0,0,0,0.5)] ${
            isCompact ? '' : 'max-h-60 overflow-y-auto'
          } z-50 overflow-hidden animate-in slide-in-from-top-2 duration-200`}
        >
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left border-l-2 transition-all ${
                isCompact ? 'px-3.5 py-2.5 text-xs' : 'px-3.5 py-2.5 text-sm'
              } ${
                value === opt.value
                  ? 'bg-accent/10 text-accent font-medium border-accent'
                  : 'text-secondary hover:bg-black/5 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white border-transparent'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SelectDropdown;
