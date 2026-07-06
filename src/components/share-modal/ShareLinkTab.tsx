import type { ShareRecord } from './types';

interface ShareLinkTabProps {
  shareLink: string | null;
  linkBusy: boolean;
  linkCopied: boolean;
  shares: ShareRecord[];
  onGenerateLink: () => void;
  onCopyLink: () => void;
  onRevoke: (shareId: string) => void;
}

export function ShareLinkTab(props: ShareLinkTabProps) {
  const orgWideShare = props.shares.find(share => !share.shared_with_user_id && share.share_token);

  return (
    <div className="px-6 pb-6">
      <p className="text-[11.5px] text-gray-500 dark:text-white/40 mb-4 leading-normal">
        Genera un enlace interno para que cualquier miembro activo de esta organización pueda abrir este elemento desde cualquier dispositivo.
      </p>

      {!props.shareLink ? (
        <button
          onClick={props.onGenerateLink}
          disabled={props.linkBusy}
          className="w-full py-2.5 bg-accent/10 hover:bg-accent/20 text-accent text-[12px] font-semibold rounded-xl transition-all flex items-center justify-center gap-2 border border-accent/10 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <LinkIcon />
          <span>{props.linkBusy ? 'Generando...' : 'Generar enlace'}</span>
        </button>
      ) : (
        <div className="space-y-2.5">
          <div className="px-3.5 py-2 bg-gray-50 dark:bg-white/[0.04] border border-gray-200/50 dark:border-white/[0.06] rounded-xl">
            <p className="text-[11.5px] font-mono text-gray-700 dark:text-white/70 break-all select-all">soflia://share/{props.shareLink}</p>
          </div>
          <button
            onClick={props.onCopyLink}
            className={`w-full py-2.5 text-[12px] font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 ${
              props.linkCopied
                ? 'bg-accent/15 text-accent border border-accent/25'
                : 'bg-accent text-white hover:bg-accent/90 shadow-md shadow-accent/10 active:scale-[0.98]'
            }`}
          >
            <span>{props.linkCopied ? 'Copiado' : 'Copiar enlace'}</span>
          </button>
          <button
            onClick={() => orgWideShare && props.onRevoke(orgWideShare.id)}
            className="w-full py-2.5 rounded-xl border border-red-500/15 bg-red-500/5 text-[12px] font-semibold text-red-500 dark:text-red-400 transition-all hover:bg-red-500/10"
          >
            Revocar enlace
          </button>
        </div>
      )}
    </div>
  );
}

function LinkIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-5.07a4.5 4.5 0 00-6.364 0L4.5 11.25a4.5 4.5 0 006.364 6.364l4.5-4.5" />
    </svg>
  );
}
