export function MessageAttachments({
  images,
  onZoom,
}: {
  images?: string[];
  onZoom: (image: string) => void;
}) {
  if (!images || images.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {images.map((image, index) => {
        const isImage = image.startsWith('data:image/');
        if (isImage) {
          return (
            <img
              key={index}
              src={image}
              alt={`Adjunto ${index + 1}`}
              className="max-w-[200px] max-h-[150px] rounded-xl object-cover cursor-pointer hover:opacity-80 transition-opacity border border-white/20"
              onClick={() => onZoom(image)}
            />
          );
        }
        return (
          <div key={index} className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl max-w-[200px]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <span className="text-xs text-secondary truncate">Documento</span>
          </div>
        );
      })}
    </div>
  );
}
