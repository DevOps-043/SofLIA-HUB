import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useModelSelector } from '../../hooks/useModelSelector';
import { resetUserPreferenceScopeForTests, scopedPreferenceKey, setUserPreferenceScope } from '../../services/user-scope';

describe('useModelSelector', () => {
  beforeEach(() => {
    localStorage.clear();
    resetUserPreferenceScopeForTests();
  });

  it('mantiene una preferencia de razonamiento independiente por modelo', () => {
    const { result } = renderHook(() => useModelSelector());

    expect(result.current.currentModel.provider).toBe('openai');
    expect(result.current.thinkingMode).toBe('medium');

    act(() => result.current.handleModelChange('gpt-6.1-sol'));
    expect(result.current.currentModel.provider).toBe('openai');
    expect(result.current.thinkingMode).toBe('medium');

    act(() => result.current.setThinkingMode('max'));
    expect(result.current.thinkingMode).toBe('max');

    act(() => result.current.handleModelChange('gemini-3.8-flash'));
    expect(result.current.currentModel.provider).toBe('google');
    expect(result.current.thinkingMode).toBe('medium');

    act(() => result.current.handleModelChange('gpt-6.1-sol'));
    expect(result.current.thinkingMode).toBe('max');
  });

  it('recupera modelo y razonamiento después de remontar el selector', () => {
    const first = renderHook(() => useModelSelector());
    act(() => first.result.current.handleModelChange('gpt-6-luna'));
    act(() => first.result.current.setThinkingMode('xhigh'));
    first.unmount();

    const second = renderHook(() => useModelSelector());
    expect(second.result.current.preferredPrimaryModel).toBe('gpt-6-luna');
    expect(second.result.current.thinkingMode).toBe('xhigh');
  });

  it('migra preferencias antiguas de razonamiento rápido al nivel visible por defecto', () => {
    localStorage.setItem(scopedPreferenceKey('soflia:selected-model'), 'gpt-6-luna');
    localStorage.setItem(scopedPreferenceKey('soflia:thinking-by-model'), JSON.stringify({
      'gpt-6-luna': 'none',
      'gemini-3.8-flash': 'minimal',
    }));

    const { result } = renderHook(() => useModelSelector());
    expect(result.current.thinkingMode).toBe('low');

    act(() => result.current.handleModelChange('gemini-3.8-flash'));
    expect(result.current.thinkingMode).toBe('low');
  });

  it('sincroniza modelo y razonamiento entre selectores montados en la misma ventana', () => {
    const { result } = renderHook(() => ({ first: useModelSelector(), second: useModelSelector() }));

    act(() => result.current.first.handleModelChange('gpt-6.1-sol'));
    expect(result.current.second.preferredPrimaryModel).toBe('gpt-6.1-sol');

    act(() => result.current.first.setThinkingMode('xhigh'));
    expect(result.current.second.thinkingMode).toBe('xhigh');
  });

  it('migra la selección y el razonamiento de Max al identificador de Sol y los conserva al remontar', () => {
    localStorage.setItem(scopedPreferenceKey('soflia:selected-model'), 'gpt-5.6-terra');
    localStorage.setItem(scopedPreferenceKey('soflia:thinking-by-model'), JSON.stringify({
      'gpt-5.6-terra': 'xhigh',
      'gpt-5.6-luna': 'low',
    }));
    const first = renderHook(() => useModelSelector());
    expect(first.result.current.preferredPrimaryModel).toBe('gpt-6.1-sol');
    expect(first.result.current.currentModel.name).toBe('SofLIA Max');
    expect(first.result.current.thinkingMode).toBe('xhigh');
    expect(localStorage.getItem(scopedPreferenceKey('soflia:selected-model'))).toBe('gpt-6.1-sol');
    expect(JSON.parse(localStorage.getItem(scopedPreferenceKey('soflia:thinking-by-model'))!))
      .toMatchObject({ 'gpt-6.1-sol': 'xhigh', 'gpt-5.6-luna': 'low' });
    first.unmount();
    const second = renderHook(() => useModelSelector());
    expect(second.result.current.preferredPrimaryModel).toBe('gpt-6.1-sol');
    expect(second.result.current.thinkingMode).toBe('xhigh');
  });

  it('acepta el identificador anterior de Max desde una superficie y sincroniza Sol', () => {
    const { result } = renderHook(() => ({ first: useModelSelector(), second: useModelSelector() }));
    act(() => result.current.first.handleModelChange('gpt-5.6-terra'));
    expect(result.current.first.preferredPrimaryModel).toBe('gpt-6.1-sol');
    expect(result.current.second.preferredPrimaryModel).toBe('gpt-6.1-sol');
    expect(localStorage.getItem(scopedPreferenceKey('soflia:selected-model'))).toBe('gpt-6.1-sol');
  });

  it('conserva Max y su razonamiento desde el identificador de Sol de la rama integrada', () => {
    localStorage.setItem(scopedPreferenceKey('soflia:selected-model'), 'gpt-6-sol');
    localStorage.setItem(scopedPreferenceKey('soflia:thinking-by-model'), JSON.stringify({
      'gpt-6-sol': 'high', 'gpt-5.6-terra': 'max',
    }));
    const { result } = renderHook(() => useModelSelector());
    expect(result.current.preferredPrimaryModel).toBe('gpt-6.1-sol');
    expect(result.current.currentModel.name).toBe('SofLIA Max');
    expect(result.current.thinkingMode).toBe('high');
    expect(localStorage.getItem(scopedPreferenceKey('soflia:selected-model'))).toBe('gpt-6.1-sol');
    act(() => result.current.handleModelChange('gpt-6-luna'));
    act(() => result.current.handleModelChange('gpt-6-sol'));
    expect(result.current.preferredPrimaryModel).toBe('gpt-6.1-sol');
    expect(result.current.thinkingMode).toBe('high');
  });

  it('prioriza el razonamiento de Sol cuando también hay una preferencia del Max anterior', () => {
    localStorage.setItem(scopedPreferenceKey('soflia:selected-model'), 'gpt-6.1-sol');
    localStorage.setItem(scopedPreferenceKey('soflia:thinking-by-model'), JSON.stringify({
      'gpt-5.6-terra': 'max', 'gpt-6.1-sol': 'low',
    }));
    const { result } = renderHook(() => useModelSelector());
    expect(result.current.thinkingMode).toBe('low');
  });

  it('migra Max sólo en el ámbito activo y descarta modelos desconocidos', () => {
    setUserPreferenceScope('usuario-1');
    const otherUserKey = scopedPreferenceKey('soflia:selected-model');
    localStorage.setItem(otherUserKey, 'gpt-5.6-terra');
    setUserPreferenceScope('usuario-2');
    localStorage.setItem(scopedPreferenceKey('soflia:selected-model'), 'modelo-desconocido');
    const { result } = renderHook(() => useModelSelector());
    expect(result.current.currentModel.name).toBe('SofLIA');
    act(() => result.current.handleModelChange('modelo-desconocido'));
    expect(result.current.currentModel.name).toBe('SofLIA');
    act(() => result.current.handleModelChange('gpt-5.6-terra'));
    expect(result.current.currentModel.name).toBe('SofLIA Max');
    expect(localStorage.getItem(otherUserKey)).toBe('gpt-5.6-terra');
  });
});
