import { GroupActivationToggle } from './GroupActivationToggle';
import { GroupAllowlistEditor } from './GroupAllowlistEditor';
import { GroupPolicyDropdown } from './GroupPolicyDropdown';
import type { WhatsAppStatus } from './types';

interface GroupSupportCardProps {
  groupInput: string;
  isPolicyDropdownOpen: boolean;
  status: WhatsAppStatus;
  onAddGroup: () => void;
  onGroupInputChange: (value: string) => void;
  onRemoveGroup: (jid: string) => void;
  onPreviewGroupPrefix: (groupPrefix: string) => void;
  onSetPolicyDropdownOpen: (open: boolean) => void;
  onUpdateGroupConfig: (updates: Partial<WhatsAppStatus>) => void;
}

export function GroupSupportCard(props: GroupSupportCardProps) {
  const { groupInput, isPolicyDropdownOpen, status, onUpdateGroupConfig } = props;

  return (
    <div className="bg-white dark:bg-white/3 border border-gray-200 dark:border-white/10 rounded-3xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Soporte de Grupos</h4>
        <GroupPolicyDropdown
          isOpen={isPolicyDropdownOpen}
          policy={status.groupPolicy}
          onSelectPolicy={(groupPolicy) => onUpdateGroupConfig({ groupPolicy })}
          onSetOpen={props.onSetPolicyDropdownOpen}
        />
      </div>
      {status.groupPolicy !== 'disabled' && (
        <div className="space-y-5 animate-in fade-in duration-300">
          <GroupActivationToggle
            activation={status.groupActivation}
            onSelectActivation={(groupActivation) => onUpdateGroupConfig({ groupActivation })}
          />
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest px-1">Comando Global / Trigger</label>
            <input
              type="text"
              value={status.groupPrefix}
              onChange={(event) => props.onPreviewGroupPrefix(event.target.value)}
              onBlur={(event) => props.onUpdateGroupConfig({ groupPrefix: event.target.value })}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-background-dark/80 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white text-[10px] font-mono focus:outline-none focus:border-accent/30 transition-all"
            />
          </div>
          {status.groupPolicy === 'allowlist' && (
            <GroupAllowlistEditor
              allowedGroups={status.allowedGroups}
              groupInput={groupInput}
              onAddGroup={props.onAddGroup}
              onGroupInputChange={props.onGroupInputChange}
              onRemoveGroup={props.onRemoveGroup}
            />
          )}
        </div>
      )}
    </div>
  );
}
