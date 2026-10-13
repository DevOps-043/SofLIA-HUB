import { afterEach, expect, it, vi } from 'vitest';
import { artifactViewerService } from '../../services/artifact-viewer';
import type { ArtifactViewerBridge } from '../../shared/artifact-viewer';
afterEach(() => { delete window.artifactViewer; });
it('envía referencias cerradas y comunica fallos del host', async () => {
  const preview = vi.fn(async () => ({ success: false, error: 'El archivo cambió.' }));
  window.artifactViewer = { preview } as unknown as ArtifactViewerBridge;
  const reference = { kind: 'team' as const, jobId: 'equipo', artifactId: 'archivo' };
  await expect(artifactViewerService.preview(reference)).rejects.toThrow('El archivo cambió.');
  expect(preview).toHaveBeenCalledWith(reference);
});
it('explica la ausencia del preload sin simular que el archivo se abrió', async () => {
  expect(() => artifactViewerService.pick()).toThrow('Reinicia Soflia Hub');
});
