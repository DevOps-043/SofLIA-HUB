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
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-all">
      {avatar ? (
        <img src={avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent text-[10px] font-black">
          {displayName.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-gray-900 dark:text-white truncate">{displayName}</p>
        <p className="text-[9px] text-gray-500 dark:text-gray-500 uppercase tracking-widest">
          {member.role}
          {!isAvailable ? ' - Activa Lia primero' : ''}
        </p>
      </div>
      {existingShare ? (
        <button onClick={() => onRevoke(existingShare.id)} className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-all">
          Revocar
        </button>
      ) : (
        <button onClick={() => onShare(member)} disabled={!isAvailable || isBusy} className="px-3 py-1.5 bg-accent/10 text-accent rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-accent/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
          {isBusy ? '...' : 'Compartir'}
        </button>
      )}
    </div>
  );
}
