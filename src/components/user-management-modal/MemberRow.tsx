import { Badge } from '../ui/Badge';
import { RoleDropdown } from './RoleDropdown';
import type { MemberRowProps } from './types';

export function MemberRow({ member, isAdmin, onRoleChange, onStatusChange }: MemberRowProps) {
  const displayName = member.user_profile?.display_name || member.user_profile?.username || 'Eslabon Invitado';

  return (
    <div className="group bg-surface hover:border-accent/20 border border-border rounded-2xl p-4 flex items-center justify-between transition-colors">
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className={`w-12 h-12 rounded-full border-2 p-0.5 transition-colors ${member.status === 'suspended' ? 'border-danger/20 grayscale' : 'border-accent/30 group-hover:border-accent'}`}>
            <div className="w-full h-full rounded-full bg-surface-2 overflow-hidden flex items-center justify-center">
              {member.user_profile?.profile_picture_url ? (
                <img src={member.user_profile.profile_picture_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-accent text-base font-semibold font-mono">{displayName[0].toUpperCase()}</span>
              )}
            </div>
          </div>
          <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-surface z-10 ${member.status === 'active' ? 'bg-success' : 'bg-danger'}`} />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold text-gray-900 dark:text-white truncate max-w-[150px]">{displayName}</span>
            {member.role === 'owner' && <Badge tone="accent">Owner</Badge>}
          </div>
          <p className="text-xs text-secondary flex items-center gap-1.5">
            <svg className="w-3 h-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {member.user_profile?.email || 'id_desconocido@soflia.sys'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex flex-col items-end gap-1.5">
          <span className="text-xs text-secondary leading-none mr-1">Protocolo de Acceso</span>
          <RoleDropdown value={member.role} onChange={(role) => onRoleChange(member.id, role)} disabled={!isAdmin || member.status === 'suspended'} />
        </div>

        {isAdmin && member.role !== 'owner' && (
          <div className="flex items-center gap-2 pl-6 border-l border-border">
            <button onClick={() => onStatusChange(member.id, member.status === 'active' ? 'suspended' : 'active')} className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors border ${member.status === 'active' ? 'bg-warning/5 border-warning/15 text-warning/70 hover:text-warning hover:bg-warning/10' : 'bg-success/5 border-success/15 text-success/70 hover:text-success hover:bg-success/10'}`} title={member.status === 'active' ? 'Revocar Acceso' : 'Restaurar Acceso'}>
              {member.status === 'active' ? <StatusIcon path="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" /> : <StatusIcon path="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />}
            </button>
            <button onClick={() => onStatusChange(member.id, 'removed')} className="w-9 h-9 rounded-xl bg-danger/5 border border-danger/15 text-danger/70 hover:text-danger hover:bg-danger/10 transition-colors flex items-center justify-center" title="Eliminar del Sistema">
              <StatusIcon path="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusIcon({ path }: { path: string }) {
  return (
    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}
