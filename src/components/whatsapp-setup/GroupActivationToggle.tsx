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
    <div className="flex p-1 bg-surface-2 rounded-xl gap-1">
      {activationOptions.map((mode) => (
        <button
          key={mode.id}
          onClick={() => onSelectActivation(mode.id)}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${activation === mode.id ? 'bg-accent text-on-accent' : 'text-secondary hover:text-gray-900 dark:hover:text-white'}`}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
