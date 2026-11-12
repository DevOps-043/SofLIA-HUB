import { FolderIcon } from '../ui/Icons';

export function ProjectHubIcon() {
  return (
    <div className="relative group mb-5">
      <div className="w-14 h-14 rounded-2xl bg-accent/5 flex items-center justify-center border border-accent/10 shadow-lg shadow-accent/[0.02] backdrop-blur-xl transition-all duration-500 group-hover:scale-105 group-hover:border-accent/30">
        <FolderIcon size={26} className="text-accent" />
      </div>
    </div>
  );
}
