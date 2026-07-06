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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-[2px]" onClick={props.onClose}>
      <div
        className="relative bg-white dark:bg-[#161B22]/95 border border-gray-200/50 dark:border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-[360px] mx-4 overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-top-3 duration-200 backdrop-blur-xl"
        onClick={(event: any) => event.stopPropagation()}
      >
        <div className="absolute top-0 right-0 w-28 h-28 bg-accent/5 blur-[50px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-28 h-28 bg-accent/5 blur-[50px] pointer-events-none" />

        <button
          onClick={props.onClose}
          className="absolute top-5 right-5 z-20 w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/[0.04] hover:bg-gray-200/70 dark:hover:bg-white/[0.08] flex items-center justify-center text-gray-400 hover:text-gray-700 dark:text-white/40 dark:hover:text-white transition-all duration-150 group"
          title="Cerrar"
        >
          <svg className="w-3.5 h-3.5 transition-transform duration-200 group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
