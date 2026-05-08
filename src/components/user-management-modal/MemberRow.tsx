import { RoleDropdown } from './RoleDropdown';
import type { MemberRowProps } from './types';

export function MemberRow({ member, isAdmin, onRoleChange, onStatusChange }: MemberRowProps) {
  const displayName = member.user_profile?.display_name || member.user_profile?.username || 'Eslabon Invitado';

  return (
    <div className="group bg-gray-50/50 dark:bg-white/2 hover:bg-gray-100 dark:hover:bg-white/5 border border-gray-200 dark:border-white/5 hover:border-accent/10 dark:hover:border-white/10 rounded-2xl p-4 flex items-center justify-between transition-all duration-300">
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className={`w-12 h-12 rounded-full border-2 p-0.5 transition-colors duration-500 ${member.status === 'suspended' ? 'border-red-500/20 grayscale' : 'border-accent/30 group-hover:border-accent'}`}>
            <div className="w-full h-full rounded-full bg-background-dark/80 overflow-hidden flex items-center justify-center">
              {member.user_profile?.profile_picture_url ? (
                <img src={member.user_profile.profile_picture_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-accent text-[15px] font-black font-mono">{displayName[0].toUpperCase()}</span>
              )}
            </div>
          </div>
          <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-sidebar z-10 ${member.status === 'active' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[13px] font-bold text-gray-900 dark:text-white truncate max-w-[150px]">{displayName}</span>
            {member.role === 'owner' && <div className="px-1.5 py-0.5 rounded-md bg-accent/10 border border-accent/20 text-accent text-[8px] font-black uppercase tracking-tighter">Owner</div>}
          </div>
          <p className="text-[10px] text-gray-600 font-bold uppercase tracking-tight flex items-center gap-1.5">
            <svg className="w-3 h-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {member.user_profile?.email || 'id_desconocido@soflia.sys'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex flex-col items-end gap-1">
          <span className="text-[8px] font-bold text-gray-700 uppercase tracking-widest leading-none mr-2">Protocolo de Acceso</span>
          <RoleDropdown value={member.role} onChange={(role) => onRoleChange(member.id, role)} disabled={!isAdmin || member.status === 'suspended'} />
        </div>

        {isAdmin && member.role !== 'owner' && (
          <div className="flex items-center gap-2 pl-6 border-l border-white/5">
            <button onClick={() => onStatusChange(member.id, member.status === 'active' ? 'suspended' : 'active')} className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all border ${member.status === 'active' ? 'bg-amber-500/5 border-amber-500/10 text-amber-500/60 hover:text-amber-500 hover:bg-amber-500/10' : 'bg-green-500/5 border-green-500/10 text-green-500/60 hover:text-green-500 hover:bg-green-500/10'}`} title={member.status === 'active' ? 'Revocar Acceso' : 'Restaurar Acceso'}>
              {member.status === 'active' ? <StatusIcon path="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" /> : <StatusIcon path="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />}
            </button>
            <button onClick={() => onStatusChange(member.id, 'removed')} className="w-9 h-9 rounded-xl bg-red-500/5 border border-red-500/10 text-red-500/60 hover:text-red-400 hover:bg-red-500/10 transition-all flex items-center justify-center" title="Eliminar del Sistema">
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
