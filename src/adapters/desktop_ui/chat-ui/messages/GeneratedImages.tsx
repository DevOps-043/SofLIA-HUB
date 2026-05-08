export function GeneratedImages({
  images,
  onZoom,
}: {
  images?: string[];
  onZoom: (image: string) => void;
}) {
  if (!images || images.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {images.map((image, index) => (
        <img
          key={index}
          src={image}
          alt={`Imagen generada ${index + 1}`}
          className="max-w-[400px] max-h-[400px] rounded-xl object-contain cursor-pointer hover:opacity-90 transition-opacity border border-white/10 shadow-lg"
          onClick={() => onZoom(image)}
        />
      ))}
    </div>
  );
}
