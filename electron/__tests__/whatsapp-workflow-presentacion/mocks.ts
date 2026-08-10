import { vi } from 'vitest';

export const mockGenerateContent = vi.fn();
export const mockGetGenerativeModel = vi.fn(() => ({ generateContent: mockGenerateContent }));
export const mockGenAI = { getGenerativeModel: mockGetGenerativeModel };
export const mockAgent = { getGenAI: vi.fn(() => mockGenAI) };
export const mockFetch = vi.fn();
export const mockSendText = vi.fn().mockResolvedValue(undefined);
export const mockSendFile = vi.fn().mockResolvedValue(undefined);
export const mockWaService = {
  sendText: mockSendText,
  sendFile: mockSendFile,
  isConnected: vi.fn().mockReturnValue(true),
};

/**
 * Servicio de espacio de trabajo simulado: el flujo de WhatsApp ya no llama a
 * un generador externo, escribe el HTML en su workspace y exporta el PDF.
 */
export const mockWriteFile = vi.fn(async () => ({ ok: true, data: { path: 'index.html', bytes: 100, updatedAt: '' } }));
export const mockWriteSystemFile = vi.fn(async () => ({ ok: true, data: { path: 'estilos/marca.css', bytes: 50, updatedAt: '' } }));
export const mockCreateWorkspace = vi.fn(async () => ({
  ok: true,
  data: { id: 'ws-test', skillId: 'sistema:presentaciones', conversationId: null, title: 'Demo', entryFile: 'index.html', createdAt: '', updatedAt: '' },
}));
export const mockWorkspaceService = {
  createWorkspace: mockCreateWorkspace,
  writeFile: mockWriteFile,
  writeSystemFile: mockWriteSystemFile,
  resolveWorkspaceRoot: vi.fn(async () => '/tmp/ws-test'),
  resolveAbsolutePath: vi.fn(async () => '/tmp/ws-test/index.html'),
  getWorkspace: vi.fn(async () => ({ id: 'ws-test', title: 'Demo', entryFile: 'index.html' })),
};

export const mockExportHtml = vi.fn(async () => ({ ok: true as const, htmlPath: '/tmp/ws-test/demo.html' }));
vi.doMock('../../skill-workspace/export-html', () => ({ exportPresentationToHtml: mockExportHtml }));

export const mockResolveBranding = vi.fn(async () => ({
  organizationId: 'org-1', organizationName: 'Acme', enabled: true,
  colorPrimary: '#123456', colorSecondary: '#654321', colorAccent: '#abcdef',
  fontFamily: 'Inter', logoUrl: null, faviconUrl: null, bannerUrl: null, missingAssets: [],
}));
vi.doMock('../../organization-branding/service', () => ({
  resolveOrganizationBranding: mockResolveBranding,
  resolveUserOrganizationId: vi.fn(async () => 'org-1'),
  invalidateBrandingCache: vi.fn(),
}));
vi.doMock('../../organization-branding/assets', () => ({
  downloadBrandAssets: vi.fn(async () => ({ logo: null, banner: null, missing: [] })),
  allowedBrandingHost: vi.fn(() => null),
  isAllowedBrandingUrl: vi.fn(() => false),
}));

vi.doMock('../../whatsapp-service', () => ({
  WhatsAppService: vi.fn(),
}));

vi.doMock('../../whatsapp-agent', () => ({
  WhatsAppAgent: vi.fn(),
}));

vi.stubGlobal('fetch', mockFetch);
