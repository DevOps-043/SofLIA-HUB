interface SectionTitleProps {
  title: string;
  subtitle: string;
  icon: JSX.Element;
  muted?: boolean;
}

export function SectionTitle({ title, subtitle, icon, muted = false }: SectionTitleProps) {
  return (
    <div className="flex items-center gap-3 mb-6 relative z-10">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center border group-hover:scale-105 transition-transform duration-500 ${muted ? 'bg-gray-500/5 border-white/5 group-hover:bg-accent/5 group-hover:border-accent/10' : 'bg-accent/5 border-accent/10'}`}>
        {icon}
      </div>
      <div>
        <h4 className="text-[10px] font-bold text-gray-900 dark:text-white/90 uppercase tracking-[0.2em]">{title}</h4>
        <p className="text-[8px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}
