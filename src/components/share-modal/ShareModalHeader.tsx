interface ShareModalHeaderProps {
  targetName: string;
}

export function ShareModalHeader({ targetName }: ShareModalHeaderProps) {
  return (
    <div className="relative z-10 px-8 pt-10 pb-2">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-1.5 h-6 bg-accent rounded-full shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
        <div>
          <h3 className="text-gray-900 dark:text-white text-lg font-black uppercase tracking-widest leading-none">Compartir</h3>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest mt-1 opacity-60 truncate max-w-[250px]">{targetName}</p>
        </div>
      </div>
    </div>
  );
}
