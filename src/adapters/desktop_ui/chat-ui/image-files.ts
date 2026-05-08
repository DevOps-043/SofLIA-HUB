export function readImageFileAsDataUrl(
  file: File,
  onLoaded: (dataUrl: string) => void,
): void {
  const reader = new FileReader();
  reader.onload = () => {
    onLoaded(String(reader.result || ''));
  };
  reader.readAsDataURL(file);
}
