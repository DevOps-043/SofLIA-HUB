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
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-[9px] font-black uppercase tracking-[0.15em] text-accent hover:bg-gray-200 dark:hover:bg-white/10 transition-all min-w-[100px] justify-between group/btn"
      >
        <span>{getPolicyLabel(policy)}</span>
        <svg className={`w-3 h-3 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-32 bg-white dark:bg-sidebar/95 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl z-[100] py-1.5 animate-in fade-in zoom-in-95 duration-200">
          {policyOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => { onSelectPolicy(option.id); onSetOpen(false); }}
              className={`w-full px-4 py-2 text-left text-[9px] font-black uppercase tracking-widest transition-colors ${policy === option.id ? 'bg-accent text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
