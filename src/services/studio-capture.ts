import type { StudioCaptureApi } from '../shared/studio-capture';
function api(): StudioCaptureApi {
  if (!window.studioCapture) throw new Error('Reinicia Hub para vincular una fuente del estudio.');
  return window.studioCapture;
}
export const studioCapture = {
  choose: async () => {
    const result = await api().choose();
    if (!result.success) throw new Error(result.error);
    return result.binding;
  },
  activate: async (bindingId: string | null, preview = false) => {
    const result = await api().activate({ bindingId, preview });
    if (!result.success) throw new Error(result.error || 'No pudimos activar la fuente.');
  },
  release: async (bindingId: string) => { const result = await api().release({ bindingId }); if (!result.success) throw new Error('No pudimos liberar la fuente.'); },
  clear: async () => { const result = await api().clear(); if (!result.success) throw new Error('No pudimos cerrar los vínculos del estudio.'); },
};
