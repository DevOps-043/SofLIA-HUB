import { expect, it } from 'vitest';
import { createWorkflowHubTestService } from './service-factory';

export function registerWorkflowHubVariantCases(): void {
  it('sanitizes variant config to allowed template fields only', () => {
    const { service } = createWorkflowHubTestService();
    const variant = service.saveVariant({
      workflowId: 'drive',
      name: 'Operacion base',
      config: {
        projectName: 'Cliente demo',
        folderPreset: 'invalido',
        parentFolderId: 'folder_123',
        extra: 'remove',
      },
      createdBy: 'user_1',
    });

    expect(variant.config).toEqual({
      projectName: 'Cliente demo',
      parentFolderId: 'folder_123',
      gchatSpace: '',
      folderPreset: 'cliente_estandar',
    });
  });
}
