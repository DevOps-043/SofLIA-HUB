import type { FormEvent } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import SelectDropdown from '../ui/SelectDropdown';

interface InvitationCardProps {
  inviteEmail: string;
  inviteRole: 'admin' | 'member';
  inviting: boolean;
  error: string | null;
  success: string | null;
  onEmailChange: (value: string) => void;
  onRoleChange: (value: 'admin' | 'member') => void;
  onSubmit: (event: FormEvent) => void;
}

export function InvitationCard(props: InvitationCardProps) {
  return (
    <Card className="mb-8">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-1 h-4 bg-accent rounded-full" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Desplegar Invitacion</h3>
      </div>

      <form onSubmit={props.onSubmit} className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={props.inviteEmail}
          onChange={event => props.onEmailChange(event.target.value)}
          placeholder="Email corporativo o nombre de usuario"
          className="flex-1 px-3.5 py-2.5 bg-surface-2 border border-border rounded-xl text-gray-900 dark:text-white text-sm placeholder-secondary/70 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-colors"
          required
        />
        <div className="sm:w-40">
          <SelectDropdown
            value={props.inviteRole}
            onChange={(role) => props.onRoleChange(role as 'admin' | 'member')}
            options={[{ value: 'member', label: 'Miembro' }, { value: 'admin', label: 'Admin' }]}
          />
        </div>
        <Button type="submit" variant="primary" size="md" loading={props.inviting} disabled={!props.inviteEmail.trim()}>
          {props.inviting ? 'Procesando...' : 'Autorizar'}
        </Button>
      </form>

      {(props.error || props.success) && (
        <div className="mt-4 flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
          <div className={`w-1 h-1 rounded-full ${props.error ? 'bg-danger' : 'bg-accent'} animate-pulse`} />
          <p className={`text-xs font-medium ${props.error ? 'text-danger' : 'text-accent'}`}>
            {props.error || props.success}
          </p>
        </div>
      )}
    </Card>
  );
}
