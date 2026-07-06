import { Card } from '../ui/Card';
import { Toggle } from '../ui/Toggle';

interface PersonalWhitelistCardProps {
  allowedNumbers: string[];
  numberInput: string;
  whitelistEnabled: boolean;
  onAddNumber: () => void;
  onNumberInputChange: (value: string) => void;
  onRemoveNumber: (number: string) => void;
  onWhitelistEnabledChange: (enabled: boolean) => void;
}

export function PersonalWhitelistCard(props: PersonalWhitelistCardProps) {
  const { allowedNumbers, numberInput, whitelistEnabled, onAddNumber, onNumberInputChange, onRemoveNumber, onWhitelistEnabledChange } = props;

  return (
    <Card>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Whitelist Personal</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-secondary">{whitelistEnabled ? 'Activa' : 'Global'}</span>
          <Toggle
            checked={whitelistEnabled}
            onChange={onWhitelistEnabledChange}
            disabled={allowedNumbers.length === 0}
            aria-label="Activar whitelist personal"
          />
        </div>
      </div>
      <div className="flex gap-2 mb-5">
        <input
          type="text"
          value={numberInput}
          onChange={(event) => onNumberInputChange(event.target.value)}
          placeholder="521..."
          className="flex-1 px-3.5 py-2.5 bg-surface-2 border border-border rounded-xl text-gray-900 dark:text-white text-sm font-mono placeholder-secondary/70 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-colors"
          onKeyDown={(event) => event.key === 'Enter' && onAddNumber()}
        />
        <button onClick={onAddNumber} className="px-4 py-2 bg-surface-2 border border-border text-gray-900 dark:text-white rounded-xl text-lg leading-none hover:border-accent/40 hover:text-accent transition-colors">+</button>
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
        {allowedNumbers.length > 0 ? (
          allowedNumbers.map((number) => (
            <div key={number} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-surface-2 border border-border group/num">
              <span className="text-xs text-gray-700 dark:text-gray-300 font-mono">+{number}</span>
              <button onClick={() => onRemoveNumber(number)} className="p-1.5 text-secondary hover:text-danger transition-colors opacity-0 group-hover/num:opacity-100">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))
        ) : (
          <div className="py-6 text-center border border-dashed border-border rounded-xl">
            <p className="text-xs text-secondary">Perfil Global</p>
          </div>
        )}
      </div>
    </Card>
  );
}
