import { describe, expect, it } from 'vitest';
import { communicationConnection, communicationConnectionPreview } from '../communication-hub/ipc-contract';
describe('Eliminación de credenciales de Telegram', () => {
  it('sólo permite vaciar la clave cuando se deshabilita y describe la eliminación', () => {
    const update = communicationConnection({ provider: 'telegram', updates: { enabled: false, bot_token: '' } });
    expect(communicationConnectionPreview(update)).toContain('[eliminar clave]');
    expect(() => communicationConnection({ provider: 'telegram', updates: { enabled: true, bot_token: '' } })).toThrow();
    expect(() => communicationConnection({ provider: 'telegram', updates: { bot_token: '' } })).toThrow();
  });
  it('oculta el valor de una clave nueva en la confirmación', () => {
    const update = communicationConnection({ provider: 'telegram', updates: { enabled: true, bot_token: 'clave-ficticia' } });
    expect(communicationConnectionPreview(update)).not.toContain('clave-ficticia');
  });
});
