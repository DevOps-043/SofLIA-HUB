import { useEffect, useState } from 'react';
import { DEFAULT_MODEL_ID, MODEL_OPTIONS } from './model-selector-options';
import { scopedPreferenceKey } from '../services/user-scope';
import { SOFLIA_MAX_MODEL } from '../shared/soflia-runtime-model';
import type { ModelIconKey, ModelOption, ThinkingOption } from './model-selector-options';

const MODEL_STORAGE_KEY = 'soflia:selected-model';
const THINKING_STORAGE_KEY = 'soflia:thinking-by-model';
const MODEL_PREFERENCES_CHANGED_EVENT = 'soflia:model-preferences-changed';
const LEGACY_MAX_MODEL_IDS = ['gpt-6-sol', 'gpt-5.6-terra'];

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
    // React conserva estado al actualizar módulos; reconciliarlo también al
    // montar el efecto evita mantener identificadores retirados en una sesión.
    syncPreferences();
    globalThis.addEventListener?.(MODEL_PREFERENCES_CHANGED_EVENT, syncPreferences);
    globalThis.addEventListener?.('storage', syncPreferences);
    return () => {
      globalThis.removeEventListener?.(MODEL_PREFERENCES_CHANGED_EVENT, syncPreferences);
      globalThis.removeEventListener?.('storage', syncPreferences);
    };
  }, []);

  useEffect(() => {
    if (!isThinkingDropdownOpen && !isModelSelectorOpen) return undefined;

    const handleClickOutside = (e: MouseEvent | PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.closest('[role="menu"]') ||
        target?.closest('[aria-label*="modelo"]') ||
        target?.closest('[aria-label*="Modelo"]')
      ) {
        return;
      }
      setIsThinkingDropdownOpen(false);
      setIsModelSelectorOpen(false);
    };

    const timer = window.setTimeout(() => {
      document.addEventListener('pointerdown', handleClickOutside);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [isThinkingDropdownOpen, isModelSelectorOpen]);

  const currentModel = findModel(preferredPrimaryModel);
  const thinkingMode = resolveThinkingId(currentModel, thinkingByModel[currentModel.id]);
  const currentThinkingOption = currentModel.thinkingOptions.find((option) => option.id === thinkingMode);

  const setThinkingMode = (mode: string) => {
    if (!currentModel.thinkingOptions.some((option) => option.id === mode)) return;
    const next = { ...thinkingByModel, [currentModel.id]: mode };
    setThinkingByModel(next);
    writeStorage(scopedPreferenceKey(THINKING_STORAGE_KEY), JSON.stringify(next));
    notifyPreferencesChanged();
  };

  const handleModelChange = (modelId: string) => {
    const nextModel = MODEL_OPTIONS.find((model) => model.id === normalizeModelId(modelId));
    if (!nextModel) return;
    setPreferredPrimaryModel(nextModel.id);
    writeStorage(scopedPreferenceKey(MODEL_STORAGE_KEY), nextModel.id);
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
  return MODEL_OPTIONS.find((model) => model.id === normalizeModelId(modelId)) ?? MODEL_OPTIONS[0];
}

function normalizeModelId(modelId: string): string {
  return LEGACY_MAX_MODEL_IDS.includes(modelId) ? SOFLIA_MAX_MODEL : modelId;
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
  const key = scopedPreferenceKey(MODEL_STORAGE_KEY);
  const stored = readStorage(key);
  const modelId = stored ? normalizeModelId(stored) : DEFAULT_MODEL_ID;
  if (!MODEL_OPTIONS.some((model) => model.id === modelId)) return DEFAULT_MODEL_ID;
  if (stored && stored !== modelId) writeStorage(key, modelId);
  return modelId;
}

function readStoredThinking(): Record<string, string> {
  const raw = readStorage(scopedPreferenceKey(THINKING_STORAGE_KEY));
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const legacyMaxModelId = LEGACY_MAX_MODEL_IDS.find((modelId) => typeof parsed[modelId] === 'string');
    if (!Object.prototype.hasOwnProperty.call(parsed, SOFLIA_MAX_MODEL) && legacyMaxModelId) {
      parsed[SOFLIA_MAX_MODEL] = parsed[legacyMaxModelId];
      writeStorage(scopedPreferenceKey(THINKING_STORAGE_KEY), JSON.stringify(parsed));
    }
    return parsed;
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
