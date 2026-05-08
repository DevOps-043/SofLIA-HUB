import { useEffect, useMemo, useState } from 'react';
import {
  generateConversationShareLink,
  generateFolderShareLink,
  loadConversationShares,
  loadFolderShares,
  revokeShare,
  shareConversationWithUserId,
  shareFolderWithUserId,
} from '../../services/share-service';
import type { MemberWithLia, ShareModalProps, SharePermissionState, ShareRecord, ShareTab } from './types';
import { filterMembers, loadShareData } from './shareDataLoader';

export function useShareModalData(props: ShareModalProps) {
  const [tab, setTab] = useState<ShareTab>('members');
  const [members, setMembers] = useState<MemberWithLia[]>([]);
  const [shares, setShares] = useState<ShareRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [permission, setPermission] = useState<SharePermissionState>('view');
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);

  useEffect(() => {
    if (!props.isOpen) return;
    void loadShareData(props, setMembers, setShares, setShareLink, setLoading, setErrorMessage, setLinkCopied, setSearchTerm);
  }, [props.currentSofiaUserId, props.currentUserEmail, props.isOpen, props.orgId, props.targetId, props.targetType]);

  const sharesByUserId = useMemo(
    () => new Map(shares.filter(share => share.shared_with_user_id).map(share => [share.shared_with_user_id!, share])),
    [shares],
  );
  const filteredMembers = useMemo(() => filterMembers(members, searchTerm), [members, searchTerm]);

  const handleShare = async (member: MemberWithLia) => {
    const targetUserId = member.shareTargetUserId || member.liaisonUserId;
    if (!targetUserId) return setErrorMessage('Ese miembro no tiene un identificador valido para compartir.');
    setPendingMemberId(member.id);
    setErrorMessage(null);
    try {
      const result = props.targetType === 'conversation'
        ? await shareConversationWithUserId(props.targetId, props.userId, targetUserId, props.orgId, permission)
        : await shareFolderWithUserId(props.targetId, props.userId, targetUserId, props.orgId, permission);
      setShares(prev => [result, ...prev.filter(share => share.id !== result.id)]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No pude compartir este elemento.');
    } finally {
      setPendingMemberId(null);
    }
  };

  const handleRevoke = async (shareId: string) => {
    setErrorMessage(null);
    const ok = await revokeShare(shareId, props.targetType);
    if (!ok) return setErrorMessage('No pude revocar este acceso.');
    const revoked = shares.find(share => share.id === shareId);
    setShares(prev => prev.filter(share => share.id !== shareId));
    if (revoked && !revoked.shared_with_user_id) setShareLink(null);
  };

  const handleGenerateLink = async () => {
    setLinkBusy(true);
    setErrorMessage(null);
    try {
      const token = props.targetType === 'conversation'
        ? await generateConversationShareLink(props.targetId, props.userId, props.orgId, 'view')
        : await generateFolderShareLink(props.targetId, props.userId, props.orgId, 'view');
      setShareLink(token);
      setShares(props.targetType === 'conversation' ? await loadConversationShares(props.targetId) : await loadFolderShares(props.targetId));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No pude generar el enlace.');
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

  return { tab, setTab, shares, loading, permission, setPermission, shareLink, linkCopied, searchTerm, setSearchTerm, errorMessage, pendingMemberId, linkBusy, sharesByUserId, filteredMembers, handleShare, handleRevoke, handleGenerateLink, handleCopyLink };
}
