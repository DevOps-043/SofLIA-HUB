import { useEffect, useRef, useState } from 'react';
import type { OrganizationRole } from './types';

interface RoleDropdownProps {
  value: OrganizationRole;
  onChange: (val: OrganizationRole) => void;
  disabled?: boolean;
}

const ROLE_OPTIONS: Array<{ value: OrganizationRole; label: string }> = [
  { value: 'admin', label: 'Administrador' },
  { value: 'member', label: 'Miembro' },
];

export const RoleDropdown: React.FC<RoleDropdownProps> = ({ value, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selectedLabel = value === 'owner' ? 'Propietario' : ROLE_OPTIONS.find(option => option.value === value)?.label || value;

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative min-w-32">
      <button
        type="button"
        disabled={disabled || value === 'owner'}
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2 bg-surface-2 border border-border rounded-xl text-gray-900 dark:text-white text-sm font-medium text-left flex items-center justify-between hover:border-accent/40 transition-colors disabled:opacity-50 disabled:cursor-default"
      >
        <span className="truncate">{selectedLabel}</span>
        {!(disabled || value === 'owner') && (
          <svg className={`w-3.5 h-3.5 ${open ? 'rotate-180 text-accent' : 'text-secondary'} transition-all`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full mb-1 left-0 right-0 bg-surface border border-border rounded-xl shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {ROLE_OPTIONS.map(option => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${value === option.value ? 'bg-accent/10 text-accent font-medium' : 'text-secondary hover:bg-black/5 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
