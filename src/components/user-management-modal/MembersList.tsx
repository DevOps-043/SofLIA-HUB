import type { OrgMember } from '../../services/org-service';
import type { MembersStateActions } from './types';
import { Button } from '../ui/Button';
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
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Fuerza de Trabajo</h4>
          <span className="px-2 py-0.5 rounded-full bg-surface-2 border border-border text-xs font-mono text-secondary">{props.members.length}</span>
        </div>
        {!props.loading && props.members.length > 0 && (
          <button onClick={onRefresh} className="text-xs font-medium text-accent hover:underline decoration-accent/30 underline-offset-2">Actualizar Lista</button>
        )}
      </div>

      {props.loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="relative">
            <div className="w-10 h-10 border-2 border-border rounded-full" />
            <div className="absolute inset-0 w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-sm font-medium text-accent animate-pulse">Sincronizando Usuarios...</p>
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
        <div className="flex flex-col items-center justify-center py-16 bg-surface border border-dashed border-border rounded-2xl animate-in fade-in duration-500">
          <div className="w-16 h-16 rounded-full bg-surface-2 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197" />
            </svg>
          </div>
          <p className="text-sm font-medium text-secondary mb-6">Red de Trabajo Desierta</p>
          <Button variant="secondary" size="sm" onClick={onRefresh}>Forzar Escaneo</Button>
        </div>
      )}
    </div>
  );
}
