import type { RemoteImageState } from './types';

export function RemoteScreenshot({ image }: { image: RemoteImageState }) {
  return (
    <div className="bg-white dark:bg-[#1a1c20]/50 border border-gray-200 dark:border-white/10 rounded-2xl p-4 shadow-sm dark:shadow-lg">
      <p className="text-xs font-semibold text-gray-900 dark:text-white mb-2">Vista remota - {image.nodeId}</p>
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-white/[0.06]">
        <img src={image.image} alt={`Captura ${image.nodeId}`} className="w-full h-auto object-contain" />
      </div>
    </div>
  );
}
