type Props = {
  generating: boolean;
  sending: boolean;
  sent: boolean;
  onGenerate: () => void;
  onSendWhatsApp: () => void;
};

export function SummaryFooterActions({ generating, sending, sent, onGenerate, onSendWhatsApp }: Props) {
  return (
    <div className="pt-8 border-t border-white/5 flex flex-wrap gap-4 items-center justify-between">
      <button
        onClick={onGenerate}
        disabled={generating}
        className="flex items-center gap-2 p-2 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white hover:bg-white/5 transition-all"
      >
        <svg className={`h-3.5 w-3.5 ${generating ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Actualizar Analisis
      </button>

      <button
        onClick={onSendWhatsApp}
        disabled={sending}
        className={`group/wa relative overflow-hidden flex items-center gap-2 px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-[0.98] ${sent ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-[#25D366] text-white shadow-[0_0_20px_rgba(37,211,102,0.2)] hover:shadow-[#25D366]/40 hover:-translate-y-0.5'}`}
      >
        <div className="absolute inset-0 bg-white/10 translate-x-full group-hover/wa:translate-x-0 transition-transform duration-500" />
        {sent ? <CheckIcon /> : <WhatsAppIcon />}
        <span className="relative z-10">{sent ? 'Analisis Enviado' : sending ? 'Preparando...' : 'Compartir en WhatsApp'}</span>
      </button>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 14.14L8.707 15.414a1 1 0 01-1.414 0L4.293 12.707a1 1 0 011.414-1.414L8 13.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347M12.05 21.785h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884" />
    </svg>
  );
}
