/**
 * Aislamiento de preferencias locales entre usuarios del mismo equipo.
 *
 * Regresion cubierta: favoritos, ajustes del navegador, modelo elegido y perfil
 * personal vivian en claves globales de `localStorage`, asi que al cerrar sesion
 * y entrar con otra cuenta el usuario nuevo heredaba los del anterior.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  getUserPreferenceScope,
  resetUserPreferenceScopeForTests,
  scopedPreferenceKey,
  setUserPreferenceScope,
} from '../../services/user-scope';

describe('ambito de preferencias por usuario', () => {
  beforeEach(() => {
    localStorage.clear();
    resetUserPreferenceScopeForTests();
  });

  it('da a cada usuario su propia clave', () => {
    setUserPreferenceScope('usuario-a');
    const claveA = scopedPreferenceKey('sofLia_integratedBrowserFavorites');
    setUserPreferenceScope('usuario-b');
    const claveB = scopedPreferenceKey('sofLia_integratedBrowserFavorites');

    expect(claveA).not.toBe(claveB);
    expect(claveA).toContain('usuario-a');
    expect(claveB).toContain('usuario-b');
  });

  it('un usuario no lee lo que guardo el anterior', () => {
    setUserPreferenceScope('usuario-a');
    localStorage.setItem(scopedPreferenceKey('soflia:selected-model'), 'modelo-de-a');

    setUserPreferenceScope(null);
    setUserPreferenceScope('usuario-b');

    expect(localStorage.getItem(scopedPreferenceKey('soflia:selected-model'))).toBeNull();
  });

  it('elimina las claves globales heredadas para que nadie las herede', () => {
    localStorage.setItem('sofLia_integratedBrowserFavorites', '[{"url":"https://privado.example"}]');
    localStorage.setItem('lia_user_settings', '{"user_id":"usuario-a","nickname":"A"}');

    setUserPreferenceScope('usuario-b');

    expect(localStorage.getItem('sofLia_integratedBrowserFavorites')).toBeNull();
    expect(localStorage.getItem('lia_user_settings')).toBeNull();
  });

  it('descarta lo navegado sin sesion al iniciar sesion', () => {
    setUserPreferenceScope(null);
    const claveSinSesion = scopedPreferenceKey('sofLia_integratedBrowserUtilityBarVisible');
    localStorage.setItem(claveSinSesion, 'false');

    setUserPreferenceScope('usuario-a');

    expect(localStorage.getItem(claveSinSesion)).toBeNull();
    expect(getUserPreferenceScope()).toBe('usuario-a');
  });
});
