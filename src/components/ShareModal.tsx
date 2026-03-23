import { useState, useEffect, useMemo } from 'react';
import { orgService } from '../services/org-service';
import type { OrgMember } from '../services/org-service';
import SelectDropdown from './ui/SelectDropdown';
import {
  generateConversationShareLink,
  generateFolderShareLink,
  loadConversationShares,
  loadFolderShares,
  resolveLiaProfilesByEmails,
  revokeShare,
  shareConversationWithUserId,
  shareFolderWithUserId,
  type ConversationShare,
  type FolderShare,
  type SharePermission,
  type ShareTargetType,
} from '../services/share-service';

type MemberWithLia = OrgMember & {
  shareTargetUserId?: string;
  liaisonUserId?: string;
  liaisonEmail?: string;
};

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: string;
  targetType: ShareTargetType;
  targetName: string;
  userId: string;
  orgId: string;
  currentSofiaUserId?: string | null;
  currentUserEmail?: string | null;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  targetId,
  targetType,
  targetName,
  userId,
  orgId,
  currentSofiaUserId,
  currentUserEmail,
}) => {
  const [tab, setTab] = useState<'members' | 'link'>('members');
  const [members, setMembers] = useState<MemberWithLia[]>([]);
  const [shares, setShares] = useState<(ConversationShare | FolderShare)[]>([]);
  const [loading, setLoading] = useState(true);
  const [permission, setPermission] = useState<SharePermission>('view');
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    void (async () => {
      setLoading(true);
      setErrorMessage(null);
      setLinkCopied(false);
      setSearchTerm('');

      try {
        const [membersData, sharesData] = await Promise.all([
          orgService.getOrganizationMembers(orgId),
          targetType === 'conversation'
            ? loadConversationShares(targetId)
            : loadFolderShares(targetId),
        ]);

        const normalizedCurrentEmail = currentUserEmail?.trim().toLowerCase() || null;
        const availableMembers = membersData.filter((member: any) => {
          const memberEmail =
            member.user_profile?.email?.trim().toLowerCase() ||
            member.user_profile?.username?.trim().toLowerCase() ||
            null;
          return (
            member.status === 'active' &&
            member.user_id !== currentSofiaUserId &&
            (!normalizedCurrentEmail || memberEmail !== normalizedCurrentEmail)
          );
        });
        const profilesByEmail = await resolveLiaProfilesByEmails(
          availableMembers.map((member: any) => member.user_profile?.email || member.user_profile?.username || null),
        );

        setMembers(
          availableMembers.map((member: any) => {
            const email = member.user_profile?.email?.trim().toLowerCase() || null;
            const profile = email ? profilesByEmail.get(email) : undefined;
            return {
              ...member,
              shareTargetUserId: member.user_id || profile?.id,
              liaisonUserId: profile?.id,
              liaisonEmail: profile?.email || email || undefined,
            };
          }),
        );
        setShares(sharesData);
        setShareLink(
          sharesData.find((share) => !share.shared_with_user_id && share.share_token)?.share_token || null,
        );
      } catch (error) {
        console.error('[ShareModal] Error loading share data:', error);
        setErrorMessage('No pude cargar los permisos de comparticion.');
      } finally {
        setLoading(false);
      }
    })();
  }, [currentSofiaUserId, currentUserEmail, isOpen, orgId, targetId, targetType, userId]);

  const sharesByUserId = useMemo(
    () => new Map(shares.filter((share) => share.shared_with_user_id).map((share) => [share.shared_with_user_id!, share])),
    [shares],
  );

  const filteredMembers = useMemo(
    () =>
      members.filter((member) => {
        if (!searchTerm) return true;
        const name =
          member.user_profile?.display_name ||
          member.user_profile?.username ||
          member.user_profile?.email ||
          '';
        return name.toLowerCase().includes(searchTerm.toLowerCase());
      }),
    [members, searchTerm],
  );

  const handleShare = async (member: MemberWithLia) => {
    const targetUserId = member.shareTargetUserId || member.user_id || member.liaisonUserId;
    if (!targetUserId) {
      setErrorMessage('Ese miembro no tiene un identificador valido para compartir.');
      return;
    }

    setPendingMemberId(member.id);
    setErrorMessage(null);

    try {
      const result =
        targetType === 'conversation'
          ? await shareConversationWithUserId(targetId, userId, targetUserId, orgId, permission)
          : await shareFolderWithUserId(targetId, userId, targetUserId, orgId, permission);

      setShares((prev) => [
        result,
        ...prev.filter((share) => share.id !== result.id),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No pude compartir este elemento.';
      setErrorMessage(message);
    } finally {
      setPendingMemberId(null);
    }
  };

  const handleRevoke = async (shareId: string) => {
    setErrorMessage(null);
    const ok = await revokeShare(shareId, targetType);
    if (ok) {
      const revoked = shares.find((share) => share.id === shareId);
      setShares((prev) => prev.filter((share) => share.id !== shareId));
      if (revoked && !revoked.shared_with_user_id) {
        setShareLink(null);
      }
      return;
    }

    setErrorMessage('No pude revocar este acceso.');
  };

  const handleGenerateLink = async () => {
    setLinkBusy(true);
    setErrorMessage(null);

    try {
      const token =
        targetType === 'conversation'
          ? await generateConversationShareLink(targetId, userId, orgId, 'view')
          : await generateFolderShareLink(targetId, userId, orgId, 'view');

      setShareLink(token);
      const refreshedShares =
        targetType === 'conversation'
          ? await loadConversationShares(targetId)
          : await loadFolderShares(targetId);
      setShares(refreshedShares);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No pude generar el enlace.';
      setErrorMessage(message);
    } finally {
      setLinkBusy(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(`soflia://share/${shareLink}`);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      setErrorMessage('No pude copiar el enlace al portapapeles.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative bg-white dark:bg-[#1a1b1e]/90 border border-gray-200 dark:border-white/10 rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={(e: any) => e.stopPropagation()}
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-[60px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/5 blur-[60px] pointer-events-none" />

        <div className="absolute top-4 right-4 z-20">
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-all group">
            <svg className="w-4 h-4 transition-transform group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="relative z-10 px-8 pt-10 pb-2">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-1.5 h-6 bg-accent rounded-full shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
            <div>
              <h3 className="text-gray-900 dark:text-white text-lg font-black uppercase tracking-widest leading-none">Compartir</h3>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest mt-1 opacity-60 truncate max-w-[250px]">{targetName}</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 px-8 pb-3 flex gap-2">
          <button
            onClick={() => setTab('members')}
            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              tab === 'members' ? 'bg-accent/10 text-accent border border-accent/20' : 'text-gray-500 dark:text-gray-400 border border-transparent hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            Miembros
          </button>
          <button
            onClick={() => setTab('link')}
            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              tab === 'link' ? 'bg-accent/10 text-accent border border-accent/20' : 'text-gray-500 dark:text-gray-400 border border-transparent hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            Enlace
          </button>
        </div>

        {errorMessage && (
          <div className="mx-8 mb-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[11px] font-medium text-red-500">
            {errorMessage}
          </div>
        )}

        <div className="relative z-10">
          {tab === 'members' && (
            <div>
              <div className="px-8 pb-3 flex items-center gap-3">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">Permiso</span>
                <SelectDropdown
                  value={permission}
                  onChange={(value: string) => setPermission(value as SharePermission)}
                  options={[
                    { value: 'view', label: 'Solo ver' },
                    { value: 'edit', label: 'Editar' },
                  ]}
                  size="compact"
                />
              </div>

              <div className="px-8 pb-2">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e: any) => setSearchTerm(e.target.value)}
                  placeholder="Buscar miembro..."
                  className="w-full px-4 py-2.5 bg-gray-100/50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-[11px] font-bold text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-700 focus:outline-none focus:border-accent/30 transition-all"
                />
              </div>

              <div className="px-4 py-1 max-h-64 overflow-y-auto custom-scrollbar mb-6">
                {loading ? (
                  <div className="py-12 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                  </div>
                ) : filteredMembers.length === 0 ? (
                  <div className="py-12 text-center opacity-30">
                    <p className="text-[10px] font-black uppercase tracking-widest">Sin miembros disponibles</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredMembers.map((member) => {
                      const existingShare =
                        sharesByUserId.get(member.shareTargetUserId || '') ||
                        (member.liaisonUserId ? sharesByUserId.get(member.liaisonUserId) : undefined);
                      const displayName =
                        member.user_profile?.display_name ||
                        member.user_profile?.username ||
                        member.user_profile?.email ||
                        'Usuario';
                      const avatar = member.user_profile?.profile_picture_url;
                      const isAvailable = Boolean(member.shareTargetUserId || member.liaisonUserId);
                      const isBusy = pendingMemberId === member.id;

                      return (
                        <div
                          key={member.id}
                          className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                        >
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
                              {!isAvailable ? ' · Activa Lia primero' : ''}
                            </p>
                          </div>
                          {existingShare ? (
                            <button
                              onClick={() => handleRevoke(existingShare.id)}
                              className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-all"
                            >
                              Revocar
                            </button>
                          ) : (
                            <button
                              onClick={() => handleShare(member)}
                              disabled={!isAvailable || isBusy}
                              className="px-3 py-1.5 bg-accent/10 text-accent rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-accent/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {isBusy ? '...' : 'Compartir'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'link' && (
            <div className="px-8 pb-8">
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
                Genera un enlace interno para que cualquier miembro activo de esta organizacion pueda abrir este elemento desde cualquier dispositivo.
              </p>

              {!shareLink ? (
                <button
                  onClick={handleGenerateLink}
                  disabled={linkBusy}
                  className="w-full py-3 bg-accent/10 text-accent text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-accent/20 transition-all flex items-center justify-center gap-2 border border-accent/10 disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-5.07a4.5 4.5 0 00-6.364 0L4.5 11.25a4.5 4.5 0 006.364 6.364l4.5-4.5" />
                  </svg>
                  {linkBusy ? 'Generando...' : 'Generar enlace'}
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="px-4 py-3 bg-gray-100/50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl">
                    <p className="text-[10px] font-mono text-gray-700 dark:text-gray-300 break-all">soflia://share/{shareLink}</p>
                  </div>
                  <button
                    onClick={handleCopyLink}
                    className={`w-full py-3 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all flex items-center justify-center gap-2 ${
                      linkCopied
                        ? 'bg-accent/10 text-accent border border-accent/20'
                        : 'bg-accent text-white shadow-xl shadow-accent/10 hover:scale-[1.02] active:scale-[0.98]'
                    }`}
                  >
                    {linkCopied ? (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        Copiado
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                        </svg>
                        Copiar enlace
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      const orgWideShare = shares.find((share) => !share.shared_with_user_id && share.share_token);
                      if (orgWideShare) void handleRevoke(orgWideShare.id);
                    }}
                    className="w-full py-3 rounded-2xl border border-red-500/15 bg-red-500/5 text-[10px] font-black uppercase tracking-[0.2em] text-red-400 transition-all hover:bg-red-500/10"
                  >
                    Revocar enlace
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
