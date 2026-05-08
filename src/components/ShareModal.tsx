import { ShareLinkTab } from './share-modal/ShareLinkTab';
import { ShareMembersTab } from './share-modal/ShareMembersTab';
import { ShareModalHeader } from './share-modal/ShareModalHeader';
import { ShareTabs } from './share-modal/ShareTabs';
import type { ShareModalProps } from './share-modal/types';
import { useShareModalData } from './share-modal/useShareModalData';

export const ShareModal: React.FC<ShareModalProps> = (props) => {
  const shareState = useShareModalData(props);
  if (!props.isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={props.onClose}>
      <div
        className="relative bg-white dark:bg-[#1a1b1e]/90 border border-gray-200 dark:border-white/10 rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={(event: any) => event.stopPropagation()}
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-[60px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/5 blur-[60px] pointer-events-none" />

        <button onClick={props.onClose} className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-all group">
          <svg className="w-4 h-4 transition-transform group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <ShareModalHeader targetName={props.targetName} />
        <ShareTabs tab={shareState.tab} onChange={shareState.setTab} />

        {shareState.errorMessage && (
          <div className="mx-8 mb-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[11px] font-medium text-red-500">
            {shareState.errorMessage}
          </div>
        )}

        <div className="relative z-10">
          {shareState.tab === 'members' ? (
            <ShareMembersTab
              loading={shareState.loading}
              permission={shareState.permission}
              searchTerm={shareState.searchTerm}
              filteredMembers={shareState.filteredMembers}
              pendingMemberId={shareState.pendingMemberId}
              sharesByUserId={shareState.sharesByUserId}
              onPermissionChange={shareState.setPermission}
              onSearchChange={shareState.setSearchTerm}
              onShare={shareState.handleShare}
              onRevoke={shareState.handleRevoke}
            />
          ) : (
            <ShareLinkTab
              shareLink={shareState.shareLink}
              linkBusy={shareState.linkBusy}
              linkCopied={shareState.linkCopied}
              shares={shareState.shares}
              onGenerateLink={shareState.handleGenerateLink}
              onCopyLink={shareState.handleCopyLink}
              onRevoke={shareState.handleRevoke}
            />
          )}
        </div>
      </div>
    </div>
  );
};
