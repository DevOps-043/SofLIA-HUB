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
            ? 'flex items-center gap-2.5 px-3 py-1.5 bg-gray-100/50 dark:bg-black/40 border border-gray-200/50 dark:border-white/10 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] text-gray-900 dark:text-white hover:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-all min-w-[110px] justify-between group'
            : 'w-full px-5 py-3.5 bg-gray-100/50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-2xl text-gray-900 dark:text-white text-sm text-left flex items-center justify-between hover:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-all group'
        }
      >
        <span className={`${isCompact ? 'truncate ' : ''}group-hover:text-accent transition-colors`}>{selected}</span>
        <svg
          className={`${isCompact ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-gray-${isCompact ? '400' : '500'} transition-all duration-300 ${open ? 'rotate-180 text-accent' : 'group-hover:text-accent'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={isCompact ? 3 : 2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className={`absolute top-full left-0 right-0 mt-2 ${
            isCompact
              ? 'bg-white dark:bg-[#1f2127] border border-gray-100 dark:border-white/10 rounded-2xl shadow-2xl'
              : 'bg-white dark:bg-[#0f1115] border border-gray-100 dark:border-white/10 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.5)] max-h-60 overflow-y-auto'
          } z-50 overflow-hidden backdrop-blur-3xl animate-in slide-in-from-top-2 duration-200`}
        >
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left ${
                isCompact
                  ? `px-4 py-3 text-[9px] font-black uppercase tracking-widest border-l-2`
                  : `px-5 py-3.5 text-sm border-l-4`
              } transition-all ${
                value === opt.value
                  ? `bg-accent/10 text-accent ${isCompact ? 'font-black' : 'font-bold'} border-accent`
                  : `text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white border-transparent`
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
