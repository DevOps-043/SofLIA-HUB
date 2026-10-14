import type { DisplayMediaPickerApi } from '../shared/display-media';
function api(): DisplayMediaPickerApi {
  if (!window.displayMediaPicker) throw new Error('El selector de pantalla no está disponible.');
  return window.displayMediaPicker;
}
export const displayMediaPicker = {
  list: async () => api().list(),
  select: async (sourceId: string, withSystemAudio: boolean) => api().select({ sourceId, withSystemAudio }),
  cancel: async () => api().cancel(),
};
