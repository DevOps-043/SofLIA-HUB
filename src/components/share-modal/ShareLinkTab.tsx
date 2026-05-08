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
    <div className="px-8 pb-8">
      <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
        Genera un enlace interno para que cualquier miembro activo de esta organizacion pueda abrir este elemento desde cualquier dispositivo.
      </p>

      {!props.shareLink ? (
        <button onClick={props.onGenerateLink} disabled={props.linkBusy} className="w-full py-3 bg-accent/10 text-accent text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-accent/20 transition-all flex items-center justify-center gap-2 border border-accent/10 disabled:opacity-50">
          <LinkIcon />
          {props.linkBusy ? 'Generando...' : 'Generar enlace'}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="px-4 py-3 bg-gray-100/50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl">
            <p className="text-[10px] font-mono text-gray-700 dark:text-gray-300 break-all">soflia://share/{props.shareLink}</p>
          </div>
          <button onClick={props.onCopyLink} className={`w-full py-3 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all flex items-center justify-center gap-2 ${props.linkCopied ? 'bg-accent/10 text-accent border border-accent/20' : 'bg-accent text-white shadow-xl shadow-accent/10 hover:scale-[1.02] active:scale-[0.98]'}`}>
            {props.linkCopied ? 'Copiado' : 'Copiar enlace'}
          </button>
          <button onClick={() => orgWideShare && props.onRevoke(orgWideShare.id)} className="w-full py-3 rounded-2xl border border-red-500/15 bg-red-500/5 text-[10px] font-black uppercase tracking-[0.2em] text-red-400 transition-all hover:bg-red-500/10">
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
