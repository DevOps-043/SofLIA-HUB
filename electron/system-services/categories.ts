export const CATEGORY_MAP: Record<string, string[]> = {
  Images: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp', '.ico', '.tiff'],
  Documents: ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.xls', '.xlsx', '.csv', '.ppt', '.pptx', '.odt', '.ods'],
  Installers: ['.exe', '.msi', '.pkg', '.dmg', '.deb', '.rpm', '.appimage'],
  Archives: ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz'],
  Media: ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.mp3', '.wav', '.flac', '.m4a', '.ogg'],
  Code: ['.js', '.ts', '.html', '.css', '.json', '.xml', '.py', '.java', '.cpp', '.c', '.cs', '.go', '.rb', '.php', '.sql', '.yaml', '.yml'],
};

export function buildExtensionMap(): Record<string, string> {
  const extToCategory: Record<string, string> = {};
  for (const [category, extensions] of Object.entries(CATEGORY_MAP)) {
    for (const ext of extensions) {
      extToCategory[ext.toLowerCase()] = category;
    }
  }
  return extToCategory;
}
