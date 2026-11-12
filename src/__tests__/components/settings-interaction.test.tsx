import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UnifiedSettingsModal } from '../../components/UnifiedSettingsModal';
import { UserMenu } from '../../components/sidebar/UserMenu';
import SelectDropdown from '../../components/ui/SelectDropdown';
vi.mock('../../components/unified-settings/SettingsContent', () => ({ SettingsContent: () => <><input aria-label="Campo de prueba" /><SelectDropdown aria-label="Versión de prueba" value="actual" onChange={vi.fn()} options={[{value:"actual",label:"Actual"},{value:"anterior",label:"Anterior"}]} /></> }));
afterEach(() => { Reflect.deleteProperty(window, 'updater'); vi.restoreAllMocks(); });
const props = { isOpen: true, userId: 'fixture', userSettings: null, onSaveSettings: vi.fn(), sofiaContext: null, apiKey: '' };
describe('interacción de ajustes', () => {
 it('Escape cierra primero el selector sin cerrar Configuración', () => {
  const close = vi.fn(); render(<UnifiedSettingsModal {...props} onClose={close} />);
  const dropdown = screen.getByRole('combobox', { name: 'Versión de prueba' });
  fireEvent.click(dropdown); expect(screen.getByRole('listbox')).toBeTruthy();
  fireEvent.keyDown(dropdown, { key: 'Escape' });
  expect(screen.queryByRole('listbox')).toBeNull();expect(close).not.toHaveBeenCalled();
  fireEvent.keyDown(document, { key: 'Escape' });expect(close).toHaveBeenCalledOnce();
 });
 it('conserva el campo enfocado cuando el padre renueva el callback de cierre', async () => {
  const firstClose = vi.fn(), nextClose = vi.fn();
  const { rerender } = render(<UnifiedSettingsModal {...props} onClose={firstClose} />);
  const input = screen.getByRole('textbox', { name: 'Campo de prueba' });
  act(() => input.focus());
  rerender(<UnifiedSettingsModal {...props} onClose={nextClose} />);
  expect(input).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(nextClose).toHaveBeenCalledOnce();
  expect(firstClose).not.toHaveBeenCalled();
 });
 it('cierra por Escape y devuelve el foco al control que abrió el diálogo', () => {
  const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus();
  const close = vi.fn(); const { unmount } = render(<UnifiedSettingsModal {...props} onClose={close} />);
  expect(screen.getByRole('dialog')).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Escape' });expect(close).toHaveBeenCalledOnce();
  unmount();expect(trigger).toHaveFocus();trigger.remove();
 });
 it('la selección de tema invoca la preferencia y anuncia cuál está activo', () => {
  const setTheme = vi.fn();
  render(<UserMenu isOpen displayName="Alex" initials="A" userEmail={undefined} avatarUrl={undefined} orgName="SofLIA" orgLogoUrl={undefined} theme="dark" onSetTheme={setTheme} onOpenSettings={vi.fn()} onSignOut={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Menú de (organización|usuario)/ }));
  fireEvent.click(screen.getByRole('button', { name: /Apariencia/ }));
  expect(screen.getByRole('button', { name: 'Oscuro' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Claro' }));expect(setTheme).toHaveBeenCalledWith('light');
 });
});
