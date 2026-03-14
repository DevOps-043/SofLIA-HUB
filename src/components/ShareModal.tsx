import { useState, useEffect } from 'react';
import { orgService } from '../services/org-service';
import type { OrgMember } from '../services/org-service';
import SelectDropdown from './ui/SelectDropdown';

// ============================================
// Mock Sharing Service
// ============================================

export type ShareTargetType = 'conversation' | 'folder';
export type SharePermission = 'view' | 'edit';

export interface ConversationShare {
  id: string;
  conversation_id: string;
  shared_by_user_id: string;
  shared_with_user_id: string;
  org_id: string;
  permission: SharePermission;
  created_at: string;
}

export interface FolderShare {
  id: string;
  folder_id: string;
  shared_by_user_id: string;
  shared_with_user_id: string;
  org_id: string;
  permission: SharePermission;
  created_at: string;
}

const shareConversation = async (targetId: string, userId: string, targetUserId: string, orgId: string, permission: SharePermission): Promise<ConversationShare> => {
  console.log('[Mock] shareConversation', { targetId, userId, targetUserId, orgId, permission });
  return { id: Math.random().toString(), conversation_id: targetId, shared_by_user_id: userId, shared_with_user_id: targetUserId, org_id: orgId, permission, created_at: new Date().toISOString() };
};

const shareFolder = async (targetId: string, userId: string, targetUserId: string, orgId: string, permission: SharePermission): Promise<FolderShare> => {
  console.log('[Mock] shareFolder', { targetId, userId, targetUserId, orgId, permission });
  return { id: Math.random().toString(), folder_id: targetId, shared_by_user_id: userId, shared_with_user_id: targetUserId, org_id: orgId, permission, created_at: new Date().toISOString() };
};

const generateConversationShareLink = async (targetId: string, userId: string, orgId: string, permission: SharePermission): Promise<string> => {
  console.log('[Mock] generateConversationShareLink', { targetId, userId, orgId, permission });
  return `conv-${targetId}-${Math.random().toString(36).substring(7)}`;
};

const generateFolderShareLink = async (targetId: string, userId: string, orgId: string, permission: SharePermission): Promise<string> => {
  console.log('[Mock] generateFolderShareLink', { targetId, userId, orgId, permission });
  return `fold-${targetId}-${Math.random().toString(36).substring(7)}`;
};

const getConversationShares = async (targetId: string): Promise<ConversationShare[]> => {
  console.log('[Mock] getConversationShares', { targetId });
  return [];
};

const getFolderShares = async (targetId: string): Promise<FolderShare[]> => {
  console.log('[Mock] getFolderShares', { targetId });
  return [];
};

const revokeShare = async (shareId: string, targetType: ShareTargetType): Promise<boolean> => {
  console.log('[Mock] revokeShare', { shareId, targetType });
  return true;
};

// SelectDropdown importado de ./ui/SelectDropdown

// ============================================
// Props
// ============================================

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: string;
  targetType: ShareTargetType;
  targetName: string;
  userId: string;
  orgId: string;
}

// ============================================
// ShareModal
// ============================================

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, targetId, targetType, targetName, userId, orgId }) => {
  const [tab, setTab] = useState<'members' | 'link'>('members');
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [shares, setShares] = useState<(ConversationShare | FolderShare)[]>([]);
  const [loading, setLoading] = useState(true);
  const [permission, setPermission] = useState<SharePermission>('view');
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadData();
      setShareLink(null);
      setLinkCopied(false);
      setSearchTerm('');
    }
  }, [isOpen, targetId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [membersData, sharesData] = await Promise.all([
        orgService.getOrganizationMembers(orgId),
        targetType === 'conversation'
          ? getConversationShares(targetId)
          : getFolderShares(targetId),
      ]);
      setMembers(membersData.filter((m: any) => m.user_id !== userId && m.status === 'active'));
      setShares(sharesData);
    } catch (err) {
      console.error('[ShareModal] Error loading data:', err);
    }
    setLoading(false);
  };

  const handleShare = async (targetUserId: string) => {
    let result;
    if (targetType === 'conversation') {
      result = await shareConversation(targetId, userId, targetUserId, orgId, permission);
    } else {
      result = await shareFolder(targetId, userId, targetUserId, orgId, permission);
    }
    if (result) {
      setShares(prev => [...prev, result!]);
    }
  };

  const handleRevoke = async (shareId: string) => {
    const ok = await revokeShare(shareId, targetType);
    if (ok) setShares(prev => prev.filter((s: any) => s.id !== shareId));
  };

  const handleGenerateLink = async () => {
    let token: string | null;
    if (targetType === 'conversation') {
      token = await generateConversationShareLink(targetId, userId, orgId, 'view');
    } else {
      token = await generateFolderShareLink(targetId, userId, orgId, 'view');
    }
    if (token) {
      setShareLink(token);
    }
  };

  const handleCopyLink = () => {
    if (shareLink) {
      navigator.clipboard.writeText(`soflia://share/${shareLink}`);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const isShared = (memberUserId: string) => {
    return shares.some((s: any) => s.shared_with_user_id === memberUserId);
  };

  const getShareForUser = (memberUserId: string) => {
    return shares.find((s: any) => s.shared_with_user_id === memberUserId);
  };

  const filteredMembers = members.filter((m: any) => {
    if (!searchTerm) return true;
    const name = m.user_profile?.display_name || m.user_profile?.username || m.user_profile?.email || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative bg-white dark:bg-[#1a1b1e]/90 border border-gray-200 dark:border-white/10 rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={(e: any) => e.stopPropagation()}
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-[60px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/5 blur-[60px] pointer-events-none" />

        {/* Close */}
        <div className="absolute top-4 right-4 z-20">
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-all group">
            <svg className="w-4 h-4 transition-transform group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Header */}
        <div className="relative z-10 px-8 pt-10 pb-2">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-1.5 h-6 bg-accent rounded-full shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
            <div>
              <h3 className="text-gray-900 dark:text-white text-lg font-black uppercase tracking-widest leading-none">Compartir</h3>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest mt-1 opacity-60 truncate max-w-[250px]">{targetName}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
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

        {/* Tab content */}
        <div className="relative z-10">
          {tab === 'members' && (
            <div>
              {/* Permission selector */}
              <div className="px-8 pb-3 flex items-center gap-3">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">Permiso</span>
                <SelectDropdown
                  value={permission}
                  onChange={(val: string) => setPermission(val as SharePermission)}
                  options={[
                    { value: 'view', label: 'Solo ver' },
                    { value: 'edit', label: 'Editar' }
                  ]}
                  size="compact"
                />
              </div>

              {/* Search */}
              <div className="px-8 pb-2">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e: any) => setSearchTerm(e.target.value)}
                  placeholder="Buscar miembro..."
                  className="w-full px-4 py-2.5 bg-gray-100/50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-[11px] font-bold text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-700 focus:outline-none focus:border-accent/30 transition-all"
                />
              </div>

              {/* Members list */}
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
                    {filteredMembers.map((member: any) => {
                      const shared = isShared(member.user_id);
                      const existingShare = getShareForUser(member.user_id);
                      const displayName = member.user_profile?.display_name || member.user_profile?.username || member.user_profile?.email || 'Usuario';
                      const avatar = member.user_profile?.profile_picture_url;

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
                            <p className="text-[9px] text-gray-500 dark:text-gray-500 uppercase tracking-widest">{member.role}</p>
                          </div>
                          {shared ? (
                            <button
                              onClick={() => existingShare && handleRevoke(existingShare.id)}
                              className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-all"
                            >
                              Revocar
                            </button>
                          ) : (
                            <button
                              onClick={() => handleShare(member.user_id)}
                              className="px-3 py-1.5 bg-accent/10 text-accent rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-accent/20 transition-all"
                            >
                              Compartir
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
                Genera un enlace para compartir con miembros de tu organizacion. Solo usuarios dentro de la misma organizacion podran acceder.
              </p>

              {!shareLink ? (
                <button
                  onClick={handleGenerateLink}
                  className="w-full py-3 bg-accent/10 text-accent text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-accent/20 transition-all flex items-center justify-center gap-2 border border-accent/10"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-5.07a4.5 4.5 0 00-6.364 0L4.5 11.25a4.5 4.5 0 006.364 6.364l4.5-4.5" />
                  </svg>
                  Generar Enlace
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
                        Copiar Enlace
                      </>
                    )}
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
