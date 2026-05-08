import type { FormEvent } from 'react';

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
    <div className="mb-10 bg-white/3 border border-white/10 rounded-3xl p-6 relative overflow-hidden group">
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-accent/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="flex items-center gap-3 mb-6">
        <div className="w-1.5 h-4 bg-accent rounded-full" />
        <h4 className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-[0.2em]">Desplegar Invitacion</h4>
      </div>

      <form onSubmit={props.onSubmit} className="flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          value={props.inviteEmail}
          onChange={event => props.onEmailChange(event.target.value)}
          placeholder="Email corporativo o nombre de usuario"
          className="flex-1 px-4 py-3 bg-gray-100 dark:bg-background-dark/80 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:border-accent/30 transition-all placeholder-gray-400 dark:placeholder-gray-700"
          required
        />
        <select
          value={props.inviteRole}
          onChange={event => props.onRoleChange(event.target.value as 'admin' | 'member')}
          className="sm:w-40 px-4 py-3 bg-gray-100 dark:bg-background-dark/80 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:border-accent/30 appearance-none cursor-pointer"
        >
          <option value="member" className="bg-white dark:bg-background-dark">Miembro</option>
          <option value="admin" className="bg-white dark:bg-background-dark">Admin</option>
        </select>
        <button
          type="submit"
          disabled={props.inviting || !props.inviteEmail.trim()}
          className="group relative px-8 py-3 rounded-xl bg-accent text-white text-[11px] font-black uppercase tracking-[0.2em] shadow-lg shadow-accent/5 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 overflow-hidden"
        >
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          <span className="relative z-10">{props.inviting ? 'Procesando...' : 'Autorizar'}</span>
        </button>
      </form>

      {(props.error || props.success) && (
        <div className="mt-4 flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
          <div className={`w-1 h-1 rounded-full ${props.error ? 'bg-red-500' : 'bg-accent'} animate-pulse`} />
          <p className={`text-[10px] font-bold uppercase tracking-tight ${props.error ? 'text-red-400' : 'text-accent'}`}>
            {props.error || props.success}
          </p>
        </div>
      )}
    </div>
  );
}
