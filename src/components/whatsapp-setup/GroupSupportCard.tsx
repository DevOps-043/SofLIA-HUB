import { Card } from '../ui/Card';
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
    <Card>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Soporte de Grupos</h3>
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
            <label className="block text-xs font-medium text-secondary">Comando Global / Trigger</label>
            <input
              type="text"
              value={status.groupPrefix}
              onChange={(event) => props.onPreviewGroupPrefix(event.target.value)}
              onBlur={(event) => props.onUpdateGroupConfig({ groupPrefix: event.target.value })}
              className="w-full px-3.5 py-2.5 bg-surface-2 border border-border rounded-xl text-gray-900 dark:text-white text-sm font-mono focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-colors"
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
    </Card>
  );
}
