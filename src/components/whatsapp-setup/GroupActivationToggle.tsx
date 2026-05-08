import type { WhatsAppGroupActivation } from './types';

interface GroupActivationToggleProps {
  activation: WhatsAppGroupActivation;
  onSelectActivation: (activation: WhatsAppGroupActivation) => void;
}

const activationOptions: Array<{ id: WhatsAppGroupActivation; label: string }> = [
  { id: 'mention', label: 'Mencion' },
  { id: 'always', label: 'Continuo' },
];

export function GroupActivationToggle({ activation, onSelectActivation }: GroupActivationToggleProps) {
  return (
    <div className="flex p-1 bg-gray-100 dark:bg-white/5 rounded-xl gap-1">
      {activationOptions.map((mode) => (
        <button
          key={mode.id}
          onClick={() => onSelectActivation(mode.id)}
          className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activation === mode.id ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
