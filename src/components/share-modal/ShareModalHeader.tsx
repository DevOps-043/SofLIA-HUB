interface ShareModalHeaderProps {
  targetName: string;
}

export function ShareModalHeader({ targetName }: ShareModalHeaderProps) {
  return (
    <div className="relative z-10 px-6 pt-6 pb-2">
      <h3 className="text-gray-950 dark:text-white text-base font-bold tracking-tight">Compartir</h3>
      <p className="text-[11px] text-gray-500 dark:text-white/40 font-medium mt-0.5 truncate" title={targetName}>
        {targetName}
      </p>
    </div>
  );
}
