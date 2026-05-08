import type { ChangeEvent, ClipboardEvent } from 'react';
import { readImageFileAsDataUrl } from './image-files';

export function useChatFileHandlers(
  canSendMessages: boolean,
  setSelectedImages: (updater: (current: string[]) => string[]) => void,
) {
  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    if (!canSendMessages) return;
    const files = event.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      readImageFileAsDataUrl(file, (dataUrl) => setSelectedImages((current) => [...current, dataUrl]));
    });
    event.target.value = '';
  };

  const handlePaste = (event: ClipboardEvent) => {
    if (!canSendMessages) return;
    for (const item of event.clipboardData.items) {
      if (!item.type.startsWith('image/')) continue;
      event.preventDefault();
      const file = item.getAsFile();
      if (file) {
        readImageFileAsDataUrl(file, (dataUrl) => setSelectedImages((current) => [...current, dataUrl]));
      }
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  return { handleImageUpload, handlePaste, removeImage };
}
