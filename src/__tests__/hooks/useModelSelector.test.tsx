import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useModelSelector } from '../../hooks/useModelSelector';

describe('useModelSelector', () => {
  beforeEach(() => localStorage.clear());

  it('mantiene una preferencia de razonamiento independiente por modelo', () => {
    const { result } = renderHook(() => useModelSelector());

    expect(result.current.currentModel.provider).toBe('google');
    expect(result.current.thinkingMode).toBe('medium');

    act(() => result.current.handleModelChange('gpt-5.6-terra'));
    expect(result.current.currentModel.provider).toBe('openai');
    expect(result.current.thinkingMode).toBe('medium');

    act(() => result.current.setThinkingMode('max'));
    expect(result.current.thinkingMode).toBe('max');

    act(() => result.current.handleModelChange('gemini-3.5-flash-lite'));
    expect(result.current.thinkingMode).toBe('low');

    act(() => result.current.handleModelChange('gpt-5.6-terra'));
    expect(result.current.thinkingMode).toBe('max');
  });

  it('recupera modelo y razonamiento después de remontar el selector', () => {
    const first = renderHook(() => useModelSelector());
    act(() => first.result.current.handleModelChange('gpt-5.6-luna'));
    act(() => first.result.current.setThinkingMode('xhigh'));
    first.unmount();

    const second = renderHook(() => useModelSelector());
    expect(second.result.current.preferredPrimaryModel).toBe('gpt-5.6-luna');
    expect(second.result.current.thinkingMode).toBe('xhigh');
  });

  it('migra preferencias antiguas de razonamiento rápido al nivel visible por defecto', () => {
    localStorage.setItem('soflia:selected-model', 'gpt-5.6-luna');
    localStorage.setItem('soflia:thinking-by-model', JSON.stringify({
      'gpt-5.6-luna': 'none',
      'gemini-3.5-flash-lite': 'minimal',
    }));

    const { result } = renderHook(() => useModelSelector());
    expect(result.current.thinkingMode).toBe('low');

    act(() => result.current.handleModelChange('gemini-3.5-flash-lite'));
    expect(result.current.thinkingMode).toBe('low');
  });

  it('sincroniza modelo y razonamiento entre selectores montados en la misma ventana', () => {
    const { result } = renderHook(() => ({ first: useModelSelector(), second: useModelSelector() }));

    act(() => result.current.first.handleModelChange('gpt-5.6-luna'));
    expect(result.current.second.preferredPrimaryModel).toBe('gpt-5.6-luna');

    act(() => result.current.first.setThinkingMode('xhigh'));
    expect(result.current.second.thinkingMode).toBe('xhigh');
  });
});
