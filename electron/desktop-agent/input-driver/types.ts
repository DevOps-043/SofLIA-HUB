/**
 * Contrato del driver de entrada (mouse/teclado) de bajo nivel.
 *
 * Objetivo: sintetizar entrada como lo haria un humano — el mouse se MUEVE por
 * una trayectoria, no se teletransporta; el teclado escribe con micro-retardos.
 * Todas las coordenadas van en PIXELES FISICOS de pantalla.
 *
 * El contrato es agnostico del backend: hoy nut.js (C++ nativo, in-process,
 * multiplataforma); manana podria enchufarse otro (daemon Python/C++) sin tocar
 * el agente. Un backend que no puede cargar reporta `disponible: false` y la
 * factory cae al backend legacy.
 */

export type PhysicalPoint = { x: number; y: number };

export type MouseButton = 'left' | 'right' | 'middle';

export type MoveOptions = {
  /** Si es false, salto directo sin trayectoria (para operaciones internas rapidas). */
  humano?: boolean;
};

export type TypeOptions = {
  /** Micro-retardo por caracter (ms) para simular tecleo humano. */
  perCharDelayMs?: number;
};

export type InputDriverCapabilities = {
  backend: 'nut' | 'legacy';
  disponible: boolean;
  movimientoHumano: boolean;
  detalle?: string;
};

export interface InputDriver {
  capacidades(): InputDriverCapabilities;
  moveTo(destino: PhysicalPoint, opts?: MoveOptions): Promise<void>;
  click(punto: PhysicalPoint, button?: MouseButton, opts?: MoveOptions): Promise<void>;
  doubleClick(punto: PhysicalPoint, opts?: MoveOptions): Promise<void>;
  dragTo(desde: PhysicalPoint, hasta: PhysicalPoint, opts?: MoveOptions): Promise<void>;
  scroll(direccion: 'up' | 'down', amount: number): Promise<void>;
  typeText(texto: string, opts?: TypeOptions): Promise<void>;
  /** Combinacion o tecla suelta, p.ej. ['ctrl','s'] o ['enter']. */
  pressKeys(keys: string[]): Promise<void>;
}
