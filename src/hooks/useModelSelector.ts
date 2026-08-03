import { useEffect, useState } from 'react';
import { DEFAULT_MODEL_ID, MODEL_OPTIONS } from './model-selector-options';
import type { ModelIconKey, ModelOption, ThinkingOption } from './model-selector-options';

export function useModelSelector() {
  const [preferredPrimaryModel, setPreferredPrimaryModel] = useState(DEFAULT_MODEL_ID);
  const [thinkingMode, setThinkingMode] = useState('minimal');
  const [isThinkingDropdownOpen, setIsThinkingDropdownOpen] = useState(false);
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);

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

  const handleModelChange = (modelId: string) => {
    setPreferredPrimaryModel(modelId);
    const newModel = MODEL_OPTIONS.find((model) => model.id === modelId);
    if (newModel) syncThinkingMode(newModel, thinkingMode, setThinkingMode);
    setIsModelSelectorOpen(false);
  };

  const currentModel = MODEL_OPTIONS.find((model) => model.id === preferredPrimaryModel);
  const currentThinkingOption = currentModel?.thinkingOptions.find((option) => option.id === thinkingMode);

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

function syncThinkingMode(
  model: ModelOption,
  currentThinkingMode: string,
  setThinkingMode: (mode: string) => void,
) {
  const availableOptions = model.thinkingOptions.map((option) => option.id);
  if (availableOptions.includes(currentThinkingMode)) return;
  if (model.thinkingType === 'budget' && currentThinkingMode === 'minimal') setThinkingMode('off');
  else if (model.thinkingType === 'level' && currentThinkingMode === 'off') setThinkingMode('minimal');
}

export { MODEL_OPTIONS };
export type { ThinkingOption, ModelOption, ModelIconKey };
