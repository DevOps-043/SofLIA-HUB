interface GroupAllowlistEditorProps {
  allowedGroups: string[];
  groupInput: string;
  onAddGroup: () => void;
  onGroupInputChange: (value: string) => void;
  onRemoveGroup: (jid: string) => void;
}

export function GroupAllowlistEditor(props: GroupAllowlistEditorProps) {
  const { allowedGroups, groupInput, onAddGroup, onGroupInputChange, onRemoveGroup } = props;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest px-1">JID Whitelist</label>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={groupInput}
            onChange={(event) => onGroupInputChange(event.target.value)}
            placeholder="12345...@g.us"
            className="flex-1 px-3 py-2 bg-gray-50 dark:bg-background-dark/80 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white text-[9px] font-mono focus:outline-none focus:border-accent/30"
            onKeyDown={(event) => event.key === 'Enter' && onAddGroup()}
          />
          <button onClick={onAddGroup} className="px-3 py-2 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-[10px] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all">+</button>
        </div>
      </div>
      <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar pr-1">
        {allowedGroups.length > 0 ? (
          allowedGroups.map((jid) => (
            <div key={jid} className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/2 border border-gray-100 dark:border-white/5 group/jid">
              <span className="text-[9px] text-gray-600 dark:text-gray-400 font-mono truncate max-w-30">{jid}</span>
              <button onClick={() => onRemoveGroup(jid)} className="p-1 text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover/jid:opacity-100">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))
        ) : (
          <div className="py-4 text-center border border-dashed border-gray-200 dark:border-white/5 rounded-xl">
            <p className="text-[8px] text-gray-600 font-black uppercase tracking-widest">Sin grupos filtrados</p>
          </div>
        )}
      </div>
    </div>
  );
}
