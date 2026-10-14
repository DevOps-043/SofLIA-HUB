export type DisplayMediaKind = 'screen' | 'window' | 'tab';
export interface DisplayMediaSourcePreview {
  id: string;
  name: string;
  kind: DisplayMediaKind;
  thumbnail: string | null;
  appIcon: string | null;
}
export interface DisplayMediaPickerSnapshot {
  sources: DisplayMediaSourcePreview[];
  audioAvailable: boolean;
  dark: boolean;
  purpose?: 'bind';
}
export type DisplayMediaPickerResult =
  | { success: true; snapshot: DisplayMediaPickerSnapshot }
  | { success: false; error: string };
export interface DisplayMediaPickerApi {
  list(): Promise<DisplayMediaPickerResult>;
  select(input: { sourceId: string; withSystemAudio: boolean }): Promise<{ success: boolean; error?: string }>;
  cancel(): Promise<{ success: boolean }>;
}
declare global {
  interface Window { displayMediaPicker?: DisplayMediaPickerApi }
}
