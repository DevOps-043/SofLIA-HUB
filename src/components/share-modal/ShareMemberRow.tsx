import type { MemberWithLia, ShareRecord } from './types';

interface ShareMemberRowProps {
  member: MemberWithLia;
  existingShare?: ShareRecord;
  isBusy: boolean;
  onShare: (member: MemberWithLia) => void;
  onRevoke: (shareId: string) => void;
}

export function ShareMemberRow({ member, existingShare, isBusy, onShare, onRevoke }: ShareMemberRowProps) {
  const displayName = member.user_profile?.display_name || member.user_profile?.username || member.user_profile?.email || 'Usuario';
  const avatar = member.user_profile?.profile_picture_url;
  const isAvailable = Boolean(member.liaisonUserId);

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-100/50 dark:hover:bg-white/[0.03] transition-all duration-200">
      {avatar ? (
        <img src={avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent text-[11px] font-bold">
          {displayName.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-gray-900 dark:text-white/80 truncate">{displayName}</p>
        <p className="text-[9.5px] text-gray-400 dark:text-white/30 font-medium">
          {member.role === 'owner' ? 'Propietario' : member.role === 'admin' ? 'Administrador' : 'Miembro'}
          {!isAvailable ? ' • Inactivo en Lia' : ''}
        </p>
      </div>
      {existingShare ? (
        <button
          onClick={() => onRevoke(existingShare.id)}
          className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 dark:text-red-400 rounded-lg text-[10.5px] font-bold transition-all duration-150"
        >
          Revocar
        </button>
      ) : (
        <button
          onClick={() => onShare(member)}
          disabled={!isAvailable || isBusy}
          className="px-2.5 py-1 bg-accent/10 hover:bg-accent/20 text-accent rounded-lg text-[10.5px] font-bold transition-all duration-150 disabled:opacity-30 disabled:hover:bg-accent/10 disabled:cursor-not-allowed"
        >
          {isBusy ? '...' : 'Compartir'}
        </button>
      )}
    </div>
  );
}
