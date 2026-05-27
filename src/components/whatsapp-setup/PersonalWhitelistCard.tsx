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
    <div className="bg-white dark:bg-white/3 border border-gray-200 dark:border-white/10 rounded-3xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Whitelist Personal</h4>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <span className="text-[8px] font-black uppercase tracking-widest text-gray-500">{whitelistEnabled ? 'Activa' : 'Global'}</span>
          <input
            type="checkbox"
            checked={whitelistEnabled}
            disabled={allowedNumbers.length === 0}
            onChange={(event) => onWhitelistEnabledChange(event.target.checked)}
            className="sr-only"
          />
          <span className={`w-9 h-5 rounded-full border transition-all relative ${whitelistEnabled ? 'bg-accent border-accent' : 'bg-gray-200 dark:bg-white/5 border-gray-300 dark:border-white/10'}`}>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${whitelistEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </span>
        </label>
      </div>
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={numberInput}
          onChange={(event) => onNumberInputChange(event.target.value)}
          placeholder="521..."
          className="flex-1 pl-3 pr-4 py-2.5 bg-gray-50 dark:bg-background-dark/80 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white text-xs font-mono focus:outline-none focus:border-accent/30 transition-all"
          onKeyDown={(event) => event.key === 'Enter' && onAddNumber()}
        />
        <button onClick={onAddNumber} className="px-4 py-2 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 dark:hover:bg-white/10 transition-all">+</button>
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
        {allowedNumbers.length > 0 ? (
          allowedNumbers.map((number) => (
            <div key={number} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/2 border border-gray-100 dark:border-white/5 group/num">
              <span className="text-[10px] text-gray-600 dark:text-gray-300 font-mono tracking-widest">+{number}</span>
              <button onClick={() => onRemoveNumber(number)} className="p-1.5 text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover/num:opacity-100">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))
        ) : (
          <div className="py-6 text-center border border-dashed border-gray-200 dark:border-white/5 rounded-xl">
            <p className="text-[9px] text-amber-400/60 font-black uppercase tracking-widest">Perfil Global</p>
          </div>
        )}
      </div>
    </div>
  );
}
