import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useModelSelector } from '../../hooks/useModelSelector';
import { consumeSofliaMaxUse, readSofliaMaxQuota } from '../../services/model-quota';
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

    act(() => result.current.handleModelChange('gpt-6.2-sol'));
    expect(result.current.currentModel.provider).toBe('openai');
    expect(result.current.thinkingMode).toBe('medium');

    act(() => result.current.setThinkingMode('max'));
    expect(result.current.thinkingMode).toBe('max');

    act(() => result.current.handleModelChange('gemini-3.8-flash'));
    expect(result.current.currentModel.provider).toBe('openai');
    expect(result.current.thinkingMode).toBe('medium');

    act(() => result.current.handleModelChange('gpt-6.2-sol'));
    expect(result.current.thinkingMode).toBe('max');
  });

  it('recupera modelo y razonamiento después de remontar el selector', () => {
    const first = renderHook(() => useModelSelector());
    act(() => first.result.current.handleModelChange('gpt-6.1-terra'));
    act(() => first.result.current.setThinkingMode('xhigh'));
    first.unmount();

    const second = renderHook(() => useModelSelector());
    expect(second.result.current.preferredPrimaryModel).toBe('gpt-6.1-terra');
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

    act(() => result.current.first.handleModelChange('gpt-6.2-sol'));
    expect(result.current.second.preferredPrimaryModel).toBe('gpt-6.2-sol');

    act(() => result.current.first.setThinkingMode('xhigh'));
    expect(result.current.second.thinkingMode).toBe('xhigh');
  });

  it.each(['gpt-6.1-sol', 'gpt-6-sol', 'gpt-5.6-terra'])('migra %s a Sol 6.2 y conserva razonamiento y cuota al remontar', model => {
    consumeSofliaMaxUse('usuario-max');
    const quota = readSofliaMaxQuota('usuario-max');
    localStorage.setItem(scopedPreferenceKey('soflia:selected-model'), model);
    localStorage.setItem(scopedPreferenceKey('soflia:thinking-by-model'), JSON.stringify({
      [model]: 'xhigh',
      'gpt-5.6-luna': 'low',
    }));
    const first = renderHook(() => useModelSelector());
    expect(first.result.current.preferredPrimaryModel).toBe('gpt-6.2-sol');
    expect(first.result.current.currentModel.name).toBe('SofLIA Max');
    expect(first.result.current.thinkingMode).toBe('xhigh');
    expect(localStorage.getItem(scopedPreferenceKey('soflia:selected-model'))).toBe('gpt-6.2-sol');
    expect(JSON.parse(localStorage.getItem(scopedPreferenceKey('soflia:thinking-by-model'))!))
      .toMatchObject({ 'gpt-6.2-sol': 'xhigh', 'gpt-5.6-luna': 'low' });
    first.unmount();
    const second = renderHook(() => useModelSelector());
    expect(second.result.current.preferredPrimaryModel).toBe('gpt-6.2-sol');
    expect(second.result.current.thinkingMode).toBe('xhigh');
    expect(readSofliaMaxQuota('usuario-max')).toEqual(quota);
  });

  it('acepta el identificador anterior de Max desde una superficie y sincroniza Sol', () => {
    const { result } = renderHook(() => ({ first: useModelSelector(), second: useModelSelector() }));
    act(() => result.current.first.handleModelChange('gpt-5.6-terra'));
    expect(result.current.first.preferredPrimaryModel).toBe('gpt-6.2-sol');
    expect(result.current.second.preferredPrimaryModel).toBe('gpt-6.2-sol');
    expect(localStorage.getItem(scopedPreferenceKey('soflia:selected-model'))).toBe('gpt-6.2-sol');
  });

  it('conserva Max y su razonamiento desde el identificador de Sol de la rama integrada', () => {
    localStorage.setItem(scopedPreferenceKey('soflia:selected-model'), 'gpt-6-sol');
    localStorage.setItem(scopedPreferenceKey('soflia:thinking-by-model'), JSON.stringify({
      'gpt-6-sol': 'high', 'gpt-5.6-terra': 'max',
    }));
    const { result } = renderHook(() => useModelSelector());
    expect(result.current.preferredPrimaryModel).toBe('gpt-6.2-sol');
    expect(result.current.currentModel.name).toBe('SofLIA Max');
    expect(result.current.thinkingMode).toBe('high');
    expect(localStorage.getItem(scopedPreferenceKey('soflia:selected-model'))).toBe('gpt-6.2-sol');
    act(() => result.current.handleModelChange('gpt-6-luna'));
    act(() => result.current.handleModelChange('gpt-6-sol'));
    expect(result.current.preferredPrimaryModel).toBe('gpt-6.2-sol');
    expect(result.current.thinkingMode).toBe('high');
  });

  it('prioriza el razonamiento de Sol cuando también hay una preferencia del Max anterior', () => {
    localStorage.setItem(scopedPreferenceKey('soflia:selected-model'), 'gpt-6.2-sol');
    localStorage.setItem(scopedPreferenceKey('soflia:thinking-by-model'), JSON.stringify({
      'gpt-5.6-terra': 'max', 'gpt-6-sol': 'high', 'gpt-6.1-sol': 'xhigh', 'gpt-6.2-sol': 'low',
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

 it.each(['gemini-3.8-flash', 'models/gemini-3.5-flash-lite'])('migra la selección retirada %s en el ámbito activo', model => {
    localStorage.clear();
    resetUserPreferenceScopeForTests();
    localStorage.setItem(scopedPreferenceKey('soflia:selected-model'), model);
    localStorage.setItem(scopedPreferenceKey('soflia:thinking-by-model'), JSON.stringify({ [model]: 'high' }));
    const { result } = renderHook(() => useModelSelector());
    expect(result.current.preferredPrimaryModel).toBe('gpt-6-luna');
    expect(result.current.thinkingMode).toBe('high');
    expect(localStorage.getItem(scopedPreferenceKey('soflia:selected-model'))).toBe('gpt-6-luna');
    expect(JSON.parse(localStorage.getItem(scopedPreferenceKey('soflia:thinking-by-model'))!)).toEqual({ 'gpt-6-luna': 'high' });
 });

it('migra el razonamiento de la selección retirada y respeta una preferencia OpenAI existente', () => {
  localStorage.clear(); resetUserPreferenceScopeForTests();
  localStorage.setItem(scopedPreferenceKey('soflia:selected-model'), 'gemini-3.8-flash');
  localStorage.setItem(scopedPreferenceKey('soflia:thinking-by-model'), JSON.stringify({
    'gemini-3.5-flash-lite': 'low', 'gemini-3.8-flash': 'high', 'gpt-6-luna': 'xhigh',
  }));
  const { result } = renderHook(() => useModelSelector());
  expect(result.current.thinkingMode).toBe('xhigh');
  expect(JSON.parse(localStorage.getItem(scopedPreferenceKey('soflia:thinking-by-model'))!)).toEqual({ 'gpt-6-luna': 'xhigh' });
});
