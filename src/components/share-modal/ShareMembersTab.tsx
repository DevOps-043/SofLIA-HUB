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
      <div className="px-6 pb-3 flex items-center gap-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-white/30">Permiso</span>
        <SelectDropdown
          value={props.permission}
          onChange={(value: string) => props.onPermissionChange(value as SharePermission)}
          options={[{ value: 'view', label: 'Solo ver' }, { value: 'edit', label: 'Editar' }]}
          size="compact"
        />
      </div>

      <div className="px-6 pb-3">
        <input
          type="text"
          value={props.searchTerm}
          onChange={(event: any) => props.onSearchChange(event.target.value)}
          placeholder="Buscar miembro..."
          className="w-full px-3.5 py-2 bg-gray-100/50 dark:bg-white/[0.04] border border-gray-200/50 dark:border-white/[0.06] rounded-xl text-[12px] font-medium text-gray-950 dark:text-white placeholder-gray-400 dark:placeholder-white/20 focus:outline-none focus:border-accent/30 focus:ring-1 focus:ring-accent/30 transition-all duration-200"
        />
      </div>

      <div className="px-3.5 py-1 max-h-60 overflow-y-auto custom-scrollbar mb-4">
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
