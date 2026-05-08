import type { ChatUIController } from '../useChatUIController';

export function AttachmentPreviewStrip({ controller }: { controller: ChatUIController }) {
  const images = controller.state.images.selected;
  if (images.length === 0) return null;

  return (
    <div className="mb-2 flex gap-2 overflow-x-auto no-scrollbar">
      {images.map((image, index) => {
        const isImage = image.startsWith('data:image/');
        return (
          <div key={`${image.slice(0, 24)}-${index}`} className="relative flex-shrink-0 group">
            {isImage ? (
              <img
                src={image}
                alt={`Preview ${index + 1}`}
                className="w-[60px] h-[60px] rounded-xl object-cover border border-gray-200 dark:border-white/10 shadow-sm"
              />
            ) : (
              <div className="w-[60px] h-[60px] rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-sm flex items-center justify-center text-gray-400">
                Doc
              </div>
            )}
            <button
              onClick={() => controller.files.removeImage(index)}
              className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-md"
            >
              x
            </button>
          </div>
        );
      })}
    </div>
  );
}
