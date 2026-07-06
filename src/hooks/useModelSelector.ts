import { useEffect, useState } from 'react';
import { MODEL_OPTIONS } from './model-selector-options';
import type { ModelOption, ThinkingOption } from './model-selector-options';

export function useModelSelector() {
  const [preferredPrimaryModel, setPreferredPrimaryModel] = useState('gemini-3.5-flash');
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
    if (newModel) syncThinkingMode(modelId, newModel, thinkingMode, setThinkingMode);
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
  modelId: string,
  model: ModelOption,
  currentThinkingMode: string,
  setThinkingMode: (mode: string) => void,
) {
  const availableOptions = model.thinkingOptions.map((option) => option.id);
  if (availableOptions.includes(currentThinkingMode)) return;
  if (modelId === 'gemini-2.5-pro') setThinkingMode('low');
  else if (model.thinkingType === 'budget' && currentThinkingMode === 'minimal') setThinkingMode('off');
  else if (model.thinkingType === 'level' && currentThinkingMode === 'off') setThinkingMode('minimal');
}

export { MODEL_OPTIONS };
export type { ThinkingOption, ModelOption };
