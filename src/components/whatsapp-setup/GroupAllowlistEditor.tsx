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
        <label className="block text-xs font-medium text-secondary">JID Whitelist</label>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={groupInput}
            onChange={(event) => onGroupInputChange(event.target.value)}
            placeholder="12345...@g.us"
            className="flex-1 px-3.5 py-2.5 bg-surface-2 border border-border rounded-xl text-gray-900 dark:text-white text-sm font-mono placeholder-secondary/70 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            onKeyDown={(event) => event.key === 'Enter' && onAddGroup()}
          />
          <button onClick={onAddGroup} className="px-3.5 py-2 bg-surface-2 border border-border rounded-xl text-lg leading-none text-secondary hover:text-accent hover:border-accent/40 transition-colors">+</button>
        </div>
      </div>
      <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar pr-1">
        {allowedGroups.length > 0 ? (
          allowedGroups.map((jid) => (
            <div key={jid} className="flex items-center justify-between px-3 py-2 rounded-xl bg-surface-2 border border-border group/jid">
              <span className="text-xs text-secondary font-mono truncate max-w-30">{jid}</span>
              <button onClick={() => onRemoveGroup(jid)} className="p-1 text-secondary hover:text-danger transition-colors opacity-0 group-hover/jid:opacity-100">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))
        ) : (
          <div className="py-4 text-center border border-dashed border-border rounded-xl">
            <p className="text-xs text-secondary">Sin grupos filtrados</p>
          </div>
        )}
      </div>
    </div>
  );
}
