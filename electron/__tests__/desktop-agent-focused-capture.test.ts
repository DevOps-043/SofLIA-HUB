import { describe, expect, it, vi } from 'vitest';
import { getFocusedCaptureBounds, getForegroundWindowDipBounds } from '../desktop-agent/focused-capture-bounds';
import { DEFAULT_CONFIG } from '../desktop-agent-types';

function psWithWindow(window: Record<string, unknown>) {
  return vi.fn(async () => JSON.stringify(window));
}

describe('Focused capture: conversion fisico -> DIP', () => {
  it('FC-001: convierte el rect fisico de GetWindowRect a DIP antes de usarlo', async () => {
    // Ventana en un monitor con escala 125%: fisico = DIP * 1.25.
    const ps = psWithWindow({ title: 'Bloc de notas', process: 'notepad', x: 250, y: 125, width: 1000, height: 750 });
    const convertRect = (rect: any) => ({ x: rect.x / 1.25, y: rect.y / 1.25, width: rect.width / 1.25, height: rect.height / 1.25 });

    const foreground = await getForegroundWindowDipBounds(ps, convertRect);
    expect(foreground).not.toBeNull();
    expect(foreground!.bounds).toEqual({ x: 200, y: 100, width: 800, height: 600 });
    expect(foreground!.process).toBe('notepad');
  });

  it('FC-002: rechaza ventanas demasiado pequenas (ruido de tooltips)', async () => {
    const ps = psWithWindow({ title: 'tooltip', process: 'x', x: 0, y: 0, width: 80, height: 40 });
    const foreground = await getForegroundWindowDipBounds(ps, (rect) => rect);
    expect(foreground).toBeNull();
  });

  it('FC-003: getFocusedCaptureBounds aplica padding e interseca con el escritorio virtual', async () => {
    const ps = psWithWindow({ title: 'App', process: 'app', x: 0, y: 0, width: 800, height: 600 });
    const config = { ...DEFAULT_CONFIG, focusedCapturePadding: 24 };
    const bounds = await getFocusedCaptureBounds(config, ps, (rect) => rect);
    // Mock de pantalla: un solo display 1920x1080 en (0,0); el padding negativo se recorta.
    expect(bounds).toEqual({ x: 0, y: 0, width: 824, height: 624 });
  });

  it('FC-004: ignora Program Manager (escritorio) como ventana enfocada', async () => {
    const ps = psWithWindow({ title: 'Program Manager', process: 'explorer', x: 0, y: 0, width: 1920, height: 1080 });
    const bounds = await getFocusedCaptureBounds({ ...DEFAULT_CONFIG }, ps, (rect) => rect);
    expect(bounds).toBeNull();
  });

  it('FC-005: un fallo de PowerShell devuelve null en lugar de romper la captura', async () => {
    const ps = vi.fn(async () => { throw new Error('timeout'); });
    const foreground = await getForegroundWindowDipBounds(ps, (rect) => rect);
    expect(foreground).toBeNull();
  });
});
