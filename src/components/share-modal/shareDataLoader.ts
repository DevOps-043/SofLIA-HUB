import { orgService } from '../../services/org-service';
import {
  loadConversationShares,
  loadFolderShares,
  resolveLiaProfilesByEmails,
} from '../../services/share-service';
import type { MemberWithLia, ShareModalProps, ShareRecord } from './types';

export async function loadShareData(
  props: ShareModalProps,
  setMembers: (members: MemberWithLia[]) => void,
  setShares: (shares: ShareRecord[]) => void,
  setShareLink: (link: string | null) => void,
  setLoading: (loading: boolean) => void,
  setErrorMessage: (message: string | null) => void,
  setLinkCopied: (copied: boolean) => void,
  setSearchTerm: (term: string) => void,
) {
  setLoading(true);
  setErrorMessage(null);
  setLinkCopied(false);
  setSearchTerm('');
  try {
    const [membersData, sharesData] = await Promise.all([
      orgService.getOrganizationMembers(props.orgId),
      props.targetType === 'conversation' ? loadConversationShares(props.targetId) : loadFolderShares(props.targetId),
    ]);
    const availableMembers = filterAvailableMembers(membersData, props.currentSofiaUserId, props.currentUserEmail);
    const profilesByEmail = await resolveLiaProfilesByEmails(
      availableMembers.map((member: any) => member.user_profile?.email || member.user_profile?.username || null),
    );
    setMembers(availableMembers.map((member: any) => mapMemberWithLia(member, profilesByEmail)));
    setShares(sharesData);
    setShareLink(sharesData.find(share => !share.shared_with_user_id && share.share_token)?.share_token || null);
  } catch (error) {
    console.error('[ShareModal] Error loading share data:', error);
    setErrorMessage('No pude cargar los permisos de comparticion.');
  } finally {
    setLoading(false);
  }
}

function filterAvailableMembers(membersData: any[], currentSofiaUserId?: string | null, currentUserEmail?: string | null) {
  const normalizedCurrentEmail = currentUserEmail?.trim().toLowerCase() || null;
  return membersData.filter((member: any) => {
    const memberEmail = member.user_profile?.email?.trim().toLowerCase() || member.user_profile?.username?.trim().toLowerCase() || null;
    return member.status === 'active' && member.user_id !== currentSofiaUserId && (!normalizedCurrentEmail || memberEmail !== normalizedCurrentEmail);
  });
}

function mapMemberWithLia(member: any, profilesByEmail: Map<string, any>): MemberWithLia {
  const email = member.user_profile?.email?.trim().toLowerCase() || null;
  const profile = email ? profilesByEmail.get(email) : undefined;
  return { ...member, shareTargetUserId: profile?.id, liaisonUserId: profile?.id, liaisonEmail: profile?.email || email || undefined };
}

export function filterMembers(members: MemberWithLia[], searchTerm: string) {
  return members.filter(member => {
    if (!searchTerm) return true;
    const name = member.user_profile?.display_name || member.user_profile?.username || member.user_profile?.email || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });
}
