import { describe, expect, it, vi } from 'vitest';
import { executeServiceDesktopAction } from '../desktop-agent/service-action-runtime';
import type { DesktopAgentService } from '../desktop-agent-service';
import type { DesktopActionPayload } from '../desktop-agent-types';

const locate = vi.hoisted(() => vi.fn());
vi.mock('../desktop-agent/element-locator', () => ({
  ElementLocator: class { localizarPorTexto = locate; },
  createUiaLocatorProvider: vi.fn(), createOcrLocatorProvider: vi.fn(), describeLocateAttempts: vi.fn(),
}));
function fixture() {
  const service = {
    config: { uiaWorkerEnabled: false }, currentUIElements: [], currentStep: 0, lastResolvedActionTarget: null,
    abortController: null, activeStepLayout: {}, lastScreenshotLayout: null,
    refineActionCoordinates: (action: DesktopActionPayload) => action,
    logActionCoordinateResolution: vi.fn(), assertActionTargetsVisibleContent: vi.fn(),
    resolveScreenPoint: (x: number, y: number) => ({ x, y, dipX: x, dipY: y, source: 'layout' }),
    mouseClick: vi.fn(), mouseControls: { clickAtPhysicalPoint: vi.fn(), doubleClickAtPhysicalPoint: vi.fn() },
    visualGuidance: { wait: vi.fn(async () => undefined), present: vi.fn(async () => undefined) },
  };
  return service;
}
describe('guía previa a acciones nativas', () => {
  it('no hace clic cuando la captura cambia durante la animación', async () => {
    const service = fixture(); service.visualGuidance.present.mockImplementation(async () => { service.activeStepLayout = {}; });
    await expect(executeServiceDesktopAction(service as unknown as DesktopAgentService, { action: 'click', x: 50, y: 50, message: 'Selecciona' })).rejects.toThrow('captura');
    expect(service.mouseClick).not.toHaveBeenCalled();
  });
  it('tampoco ejecuta un clic por texto si su contexto deja de estar vigente', async () => {
    const service = fixture();
    locate.mockResolvedValue({ elemento: { texto: 'Guardar', fuente: 'uia', centroFisico: { x: 50, y: 50 }, textScore: 3, spatialScore: 1 }, intentos: [] });
    service.visualGuidance.present.mockImplementation(async () => { service.activeStepLayout = {}; });
    await expect(executeServiceDesktopAction(service as unknown as DesktopAgentService, { action: 'click_element_by_name', elementName: 'Guardar', message: 'Guardar' })).rejects.toThrow('captura');
    expect(service.mouseControls.clickAtPhysicalPoint).not.toHaveBeenCalled();
  });
  it('detener durante el retraso previo a escribir impide el efecto aunque no haya señal externa', async () => {
    const service = fixture(); let stopped = false;
    const keyboardType = vi.fn(), delay = vi.fn(async () => { stopped = true; });
    Object.assign(service, { keyboardType, delay });
    Object.assign(service.visualGuidance, { createGuard: () => () => { if (stopped) throw new Error('Asistencia detenida'); } });
    await expect(executeServiceDesktopAction(service as unknown as DesktopAgentService, { action: 'type', x: 50, y: 50, text: 'Texto', message: 'Escribir' })).rejects.toThrow('detenida');
    expect(keyboardType).not.toHaveBeenCalled();
  });
  it('una primera localización tardía no vuelve a presentar la guía tras detener', async () => {
    const service = fixture(); let stopped = false;
    Object.assign(service.visualGuidance, { createGuard: () => () => { if (stopped) throw new Error('Asistencia detenida'); } });
    locate.mockImplementationOnce(async () => { stopped = true; return { elemento: { texto: 'Guardar', fuente: 'uia', centroFisico: { x: 50, y: 50 }, textScore: 3, spatialScore: 1 }, intentos: [] }; });
    await expect(executeServiceDesktopAction(service as unknown as DesktopAgentService, { action: 'click_element_by_name', elementName: 'Guardar', message: 'Guardar' })).rejects.toThrow('detenida');
    expect(service.visualGuidance.present).not.toHaveBeenCalled();
  });
});
