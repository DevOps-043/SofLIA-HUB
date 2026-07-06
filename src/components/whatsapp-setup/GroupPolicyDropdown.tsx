import type { WhatsAppGroupPolicy } from './types';

interface GroupPolicyDropdownProps {
  isOpen: boolean;
  policy: WhatsAppGroupPolicy;
  onSelectPolicy: (policy: WhatsAppGroupPolicy) => void;
  onSetOpen: (open: boolean) => void;
}

const policyOptions: Array<{ id: WhatsAppGroupPolicy; label: string }> = [
  { id: 'open', label: 'Abierto' },
  { id: 'allowlist', label: 'Filtro' },
  { id: 'disabled', label: 'Inhibido' },
];

function getPolicyLabel(policy: WhatsAppGroupPolicy): string {
  return policyOptions.find((option) => option.id === policy)?.label || 'Abierto';
}

export function GroupPolicyDropdown(props: GroupPolicyDropdownProps) {
  const { isOpen, policy, onSelectPolicy, onSetOpen } = props;

  return (
    <div className="relative dropdown-group">
      <button
        onClick={() => onSetOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-xs font-medium text-accent hover:border-accent/40 transition-colors min-w-[100px] justify-between group/btn"
      >
        <span>{getPolicyLabel(policy)}</span>
        <svg className={`w-3.5 h-3.5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-32 bg-surface border border-border rounded-xl shadow-lg z-[100] py-1.5 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
          {policyOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => { onSelectPolicy(option.id); onSetOpen(false); }}
              className={`w-full px-4 py-2 text-left text-sm transition-colors ${policy === option.id ? 'bg-accent/10 text-accent font-medium' : 'text-secondary hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
