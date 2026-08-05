import { useEffect, useState } from 'react';
import { DEFAULT_MODEL_ID, MODEL_OPTIONS } from './model-selector-options';
import type { ModelIconKey, ModelOption, ThinkingOption } from './model-selector-options';

const MODEL_STORAGE_KEY = 'soflia:selected-model';
const THINKING_STORAGE_KEY = 'soflia:thinking-by-model';
const MODEL_PREFERENCES_CHANGED_EVENT = 'soflia:model-preferences-changed';

export function useModelSelector() {
  const [preferredPrimaryModel, setPreferredPrimaryModel] = useState(readStoredModel);
  const [thinkingByModel, setThinkingByModel] = useState<Record<string, string>>(readStoredThinking);
  const [isThinkingDropdownOpen, setIsThinkingDropdownOpen] = useState(false);
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);

  useEffect(() => {
    const syncPreferences = () => {
      setPreferredPrimaryModel(readStoredModel());
      setThinkingByModel(readStoredThinking());
    };
    globalThis.addEventListener?.(MODEL_PREFERENCES_CHANGED_EVENT, syncPreferences);
    globalThis.addEventListener?.('storage', syncPreferences);
    return () => {
      globalThis.removeEventListener?.(MODEL_PREFERENCES_CHANGED_EVENT, syncPreferences);
      globalThis.removeEventListener?.('storage', syncPreferences);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = () => {
      setIsThinkingDropdownOpen(false);
      setIsModelSelectorOpen(false);
    };

    if (isThinkingDropdownOpen || isModelSelectorOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isThinkingDropdownOpen, isModelSelectorOpen]);

  const currentModel = findModel(preferredPrimaryModel);
  const thinkingMode = resolveThinkingId(currentModel, thinkingByModel[currentModel.id]);
  const currentThinkingOption = currentModel.thinkingOptions.find((option) => option.id === thinkingMode);

  const setThinkingMode = (mode: string) => {
    if (!currentModel.thinkingOptions.some((option) => option.id === mode)) return;
    const next = { ...thinkingByModel, [currentModel.id]: mode };
    setThinkingByModel(next);
    writeStorage(THINKING_STORAGE_KEY, JSON.stringify(next));
    notifyPreferencesChanged();
  };

  const handleModelChange = (modelId: string) => {
    const nextModel = MODEL_OPTIONS.find((model) => model.id === modelId);
    if (!nextModel) return;
    setPreferredPrimaryModel(nextModel.id);
    writeStorage(MODEL_STORAGE_KEY, nextModel.id);
    notifyPreferencesChanged();
    setIsModelSelectorOpen(false);
  };

  return {
    preferredPrimaryModel,
    thinkingMode,
    setThinkingMode,
    isThinkingDropdownOpen,
    setIsThinkingDropdownOpen,
    isModelSelectorOpen,
    setIsModelSelectorOpen,
    handleModelChange,
    currentModel,
    currentThinkingOption,
  };
}

function findModel(modelId: string): ModelOption {
  return MODEL_OPTIONS.find((model) => model.id === modelId) ?? MODEL_OPTIONS[0];
}

function resolveThinkingId(model: ModelOption, stored?: string): string {
  if ((stored === 'minimal' || stored === 'none') && model.thinkingOptions.some((option) => option.id === 'low')) {
    return 'low';
  }
  return stored && model.thinkingOptions.some((option) => option.id === stored)
    ? stored
    : model.defaultThinkingId;
}

function readStoredModel(): string {
  const stored = readStorage(MODEL_STORAGE_KEY);
  return stored && MODEL_OPTIONS.some((model) => model.id === stored) ? stored : DEFAULT_MODEL_ID;
}

function readStoredThinking(): Record<string, string> {
  const raw = readStorage(THINKING_STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function readStorage(key: string): string | null {
  try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
}

function writeStorage(key: string, value: string): void {
  try { globalThis.localStorage?.setItem(key, value); } catch { /* preferencia no persistible */ }
}

function notifyPreferencesChanged(): void {
  try { globalThis.dispatchEvent?.(new Event(MODEL_PREFERENCES_CHANGED_EVENT)); } catch { /* entorno sin DOM */ }
}

export { MODEL_OPTIONS };
export type { ThinkingOption, ModelOption, ModelIconKey };
