import { afterEach, describe, expect, it, vi } from 'vitest';
import { takeRemoteNodeScreenshot } from '../../services/remote-node-service';

const original = Object.getOwnPropertyDescriptor(window, 'remoteNode');
afterEach(() => { if (original) Object.defineProperty(window, 'remoteNode', original); else Reflect.deleteProperty(window, 'remoteNode'); });
const respond = (value: unknown) => {
  const takeScreenshot = vi.fn(async () => value);
  Object.defineProperty(window, 'remoteNode', { configurable: true, writable: true, value: { takeScreenshot } });
  return takeScreenshot;
};
describe('Contrato renderer de captura remota', () => {
  it.each([null, [], { success: 'sí' }, { success: true, image: 42 }, { success: false, error: {} }])('rechaza un puente malformado sin asumir campos: caso %#', async value => {
    respond(value);
    await expect(takeRemoteNodeScreenshot('nodo')).rejects.toThrow('no válida');
  });
  it('conserva campos válidos y adicionales sin casts de promesa', async () => {
    const value = { success: true, image: 'imagen-ficticia', axTree: { role: 'window' }, width: 100 };
    const invoke = respond(value);
    expect(await takeRemoteNodeScreenshot('nodo', { display_id: 'pantalla' })).toEqual(value);
    expect(invoke).toHaveBeenCalledWith('nodo', { display_id: 'pantalla' });
  });
  it('conserva errores válidos y el rechazo del transporte', async () => {
    respond({ success: false, error: 'No disponible' });
    expect(await takeRemoteNodeScreenshot('nodo')).toEqual({ success: false, error: 'No disponible' });
    const failed = respond({}); failed.mockRejectedValueOnce(new Error('Transporte QA'));
    await expect(takeRemoteNodeScreenshot('nodo')).rejects.toThrow('Transporte QA');
  });
});
