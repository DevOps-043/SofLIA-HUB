import SelectDropdown from '../ui/SelectDropdown';
import type { SharePermission } from '../../services/share-service';
import type { MemberWithLia, ShareRecord } from './types';
import { ShareMemberRow } from './ShareMemberRow';

interface ShareMembersTabProps {
  loading: boolean;
  permission: SharePermission;
  searchTerm: string;
  filteredMembers: MemberWithLia[];
  pendingMemberId: string | null;
  sharesByUserId: Map<string, ShareRecord>;
  onPermissionChange: (permission: SharePermission) => void;
  onSearchChange: (term: string) => void;
  onShare: (member: MemberWithLia) => void;
  onRevoke: (shareId: string) => void;
}

export function ShareMembersTab(props: ShareMembersTabProps) {
  return (
    <div>
      <div className="px-8 pb-3 flex items-center gap-3">
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">Permiso</span>
        <SelectDropdown
          value={props.permission}
          onChange={(value: string) => props.onPermissionChange(value as SharePermission)}
          options={[{ value: 'view', label: 'Solo ver' }, { value: 'edit', label: 'Editar' }]}
          size="compact"
        />
      </div>

      <div className="px-8 pb-2">
        <input
          type="text"
          value={props.searchTerm}
          onChange={(event: any) => props.onSearchChange(event.target.value)}
          placeholder="Buscar miembro..."
          className="w-full px-4 py-2.5 bg-gray-100/50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-[11px] font-bold text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-700 focus:outline-none focus:border-accent/30 transition-all"
        />
      </div>

      <div className="px-4 py-1 max-h-64 overflow-y-auto custom-scrollbar mb-6">
        {props.loading ? <ShareMembersLoading /> : props.filteredMembers.length === 0 ? <ShareMembersEmpty /> : (
          <div className="space-y-1">
            {props.filteredMembers.map(member => (
              <ShareMemberRow
                key={member.id}
                member={member}
                existingShare={props.sharesByUserId.get(member.shareTargetUserId || '') || (member.liaisonUserId ? props.sharesByUserId.get(member.liaisonUserId) : undefined)}
                isBusy={props.pendingMemberId === member.id}
                onShare={props.onShare}
                onRevoke={props.onRevoke}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ShareMembersLoading() {
  return <div className="py-12 flex items-center justify-center"><div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" /></div>;
}

function ShareMembersEmpty() {
  return <div className="py-12 text-center opacity-30"><p className="text-[10px] font-black uppercase tracking-widest">Sin miembros disponibles</p></div>;
}
