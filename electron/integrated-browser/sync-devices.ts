import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createBrowserSyncConnection, type BrowserSyncConnection, type BrowserSyncConnectionFactory } from './sync-auth';
import { BrowserSyncDeviceIdentity } from './sync-device-identity';
import { abortableSync, assertSyncActive, assertSyncUuid, BrowserSyncError } from './sync-remote';
import type { BrowserSyncDeviceStatus } from './platform-types';

export interface BrowserSyncDeviceContext {
  enabled: boolean;
  authenticated: boolean;
  profileRoot: string;
  guard: () => void;
  confirm: (action: 'register' | 'revoke', label: string) => Promise<boolean>;
}

/** Dispositivos y consentimiento, sin activar transferencia de datos navegados. */
export class BrowserSyncDevices {
  private pending: AbortController | null = null;
  private confirming = false;
  constructor(private readonly connect: BrowserSyncConnectionFactory = createBrowserSyncConnection) {}
  cancel(): void { this.pending?.abort(); }

  async status(context: BrowserSyncDeviceContext): Promise<BrowserSyncDeviceStatus> {
    if (!context.enabled || !context.authenticated) return { enabled: false, state: 'disabled', devices: [], message: 'La sincronización requiere un perfil autenticado y habilitación de esta instalación.' };
    return this.run(context, async (connection, identity, signal) => this.inspect(connection, identity, signal));
  }
  register(context: BrowserSyncDeviceContext): Promise<BrowserSyncDeviceStatus> {
    return this.run(context, async (connection, identity, signal) => {
      const previous = await this.inspect(connection, identity, signal);
      if (previous.state === 'registered') return previous;
      const confirmed = await this.confirm(context, 'register', 'Este dispositivo', signal);
      assertSyncActive(signal, context.guard);
      if (!confirmed) return { ...previous, canceled: true };
      const id = await identity.ensure(connection.binding, () => assertSyncActive(signal, context.guard));
      assertSyncActive(signal, context.guard);
      await connection.remote.register(id, randomUUID(), signal);
      return this.inspect(connection, identity, signal);
    });
  }
  revoke(id: string, context: BrowserSyncDeviceContext): Promise<BrowserSyncDeviceStatus> {
    assertSyncUuid(id);
    return this.run(context, async (connection, identity, signal) => {
      const previous = await this.inspect(connection, identity, signal);
      const device = previous.devices.find((row) => row.id === id);
      if (!device) throw new BrowserSyncError('El dispositivo ya no está disponible en esta cuenta.');
      if (device.revokedAt) return previous;
      const confirmed = await this.confirm(context, 'revoke', device.label, signal);
      assertSyncActive(signal, context.guard);
      if (!confirmed) return { ...previous, canceled: true };
      await connection.remote.revoke(id, signal);
      assertSyncActive(signal, context.guard);
      if (device.current) return { enabled: true, state: 'inactive', devices: [], message: 'Dispositivo revocado. Una nueva autenticación será necesaria para registrarlo otra vez.' };
      return this.inspect(connection, identity, signal);
    });
  }

  private async inspect(connection: BrowserSyncConnection, identity: BrowserSyncDeviceIdentity, signal: AbortSignal): Promise<BrowserSyncDeviceStatus> {
    const active = await connection.remote.active(signal);
    if (!active) return { enabled: true, state: 'inactive', devices: [], message: 'Esta sesión no tiene un registro activo. Registrarla no activa todavía la transferencia de datos.' };
    const current = await identity.get(connection.binding);
    const rows = await connection.remote.devices(signal);
    // RLS puede vaciar la lista si se revoca la sesión después de active().
    if (!rows.some((row) => !row.revokedAt)
      || (current !== null && !rows.some((row) => row.id === current && !row.revokedAt))) {
      throw new BrowserSyncError('El registro activo cambió durante la consulta. Actualiza los dispositivos para verificar su estado.');
    }
    return { enabled: true, state: 'registered', message: 'Dispositivos registrados. Configura las categorías y la clave para sincronizar bajo demanda.', devices: rows.map((row) => ({
      ...row, current: row.id === current, label: row.id === current ? 'Este dispositivo' : `Dispositivo ${row.id.slice(0, 8)}`,
    })) };
  }
  private async run(context: BrowserSyncDeviceContext, operation: (connection: BrowserSyncConnection, identity: BrowserSyncDeviceIdentity, signal: AbortSignal) => Promise<BrowserSyncDeviceStatus>): Promise<BrowserSyncDeviceStatus> {
    context.guard();
    if (!context.enabled || !context.authenticated) throw new BrowserSyncError('La sincronización no está habilitada para este perfil.');
    if (this.pending || this.confirming) throw new BrowserSyncError('Ya hay una operación o confirmación de sincronización en curso.');
    const controller = new AbortController(); this.pending = controller;
    const timer = setTimeout(() => controller.abort(), 45_000);
    let connection: BrowserSyncConnection | undefined;
    try {
      connection = await this.connect(controller.signal, context.guard);
      assertSyncActive(controller.signal, context.guard);
      const result = await operation(connection, new BrowserSyncDeviceIdentity(path.join(context.profileRoot, 'sync-device.json')), controller.signal);
      assertSyncActive(controller.signal, context.guard);
      return result;
    } catch (error) {
      if (error instanceof BrowserSyncError) throw error;
      // No filtrar tokens, causas nativas ni rutas a renderer.
      throw new BrowserSyncError('No se pudo completar la operación de sincronización. Revisa la sesión y vuelve a intentarlo.');
    } finally { clearTimeout(timer); connection?.dispose(); if (this.pending === controller) this.pending = null; }
  }
  private async confirm(context: BrowserSyncDeviceContext, action: 'register' | 'revoke', label: string, signal: AbortSignal): Promise<boolean> {
    this.confirming = true;
    const answer = context.confirm(action, label).finally(() => { this.confirming = false; });
    return abortableSync(answer, signal);
  }
}
