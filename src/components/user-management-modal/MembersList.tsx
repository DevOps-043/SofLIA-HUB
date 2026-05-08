import type { OrgMember } from '../../services/org-service';
import type { MembersStateActions } from './types';
import { MemberRow } from './MemberRow';

interface MembersListProps extends MembersStateActions {
  members: OrgMember[];
  loading: boolean;
  isAdmin: boolean;
}

export function MembersList(props: MembersListProps) {
  const { isAdmin, onRoleChange, onRefresh, onStatusChange } = props;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Fuerza de Trabajo</h4>
          <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[9px] font-mono text-gray-400 font-bold">{props.members.length}</span>
        </div>
        {!props.loading && props.members.length > 0 && (
          <button onClick={onRefresh} className="text-[9px] font-black text-accent uppercase tracking-widest hover:underline decoration-accent/30 underline-offset-2">Actualizar Lista</button>
        )}
      </div>

      {props.loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="relative">
            <div className="w-10 h-10 border-2 border-white/5 rounded-full" />
            <div className="absolute inset-0 w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-[9px] font-black text-accent uppercase tracking-[0.3em] animate-pulse">Sincronizando Usuarios...</p>
        </div>
      ) : props.members.length > 0 ? (
        <div className="grid grid-cols-1 gap-3">
          {props.members.map(member => (
            <MemberRow
              key={member.id}
              member={member}
              isAdmin={isAdmin}
              onRoleChange={onRoleChange}
              onStatusChange={onStatusChange}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 bg-white/3 border border-dashed border-white/10 rounded-3xl animate-in fade-in duration-700">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197" />
            </svg>
          </div>
          <p className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] mb-6">Red de Trabajo Desierta</p>
          <button onClick={onRefresh} className="px-6 py-2 rounded-xl bg-white/5 border border-white/10 text-[9px] font-black text-white hover:bg-white/10 transition-all uppercase tracking-widest">Forzar Escaneo</button>
        </div>
      )}
    </div>
  );
}
