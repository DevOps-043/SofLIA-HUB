export function SecurityFooter() {
  return (
    <div className="px-8 py-4 border-t border-white/5 bg-white/2 flex items-center justify-center gap-2">
      <svg className="w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
      <p className="text-[9px] text-gray-600 font-black uppercase tracking-[0.2em]">
        Cifrado de Extremo a Extremo â€” SesiÃ³n Local Segura
      </p>
    </div>
  );
}
