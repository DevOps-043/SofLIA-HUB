import { useState, useEffect } from 'react';

interface ThinkingOption {
  id: string;
  name: string;
  desc: string;
  level?: string;
  budget?: number;
}

interface ModelOption {
  id: string;
  name: string;
  desc: string;
  thinkingType: 'level' | 'budget';
  thinkingOptions: ThinkingOption[];
}

const THINKING_OPTIONS_GEMINI3_FLASH: ThinkingOption[] = [
  { id: 'minimal', name: 'Rápido', desc: 'Responde rápidamente', level: 'minimal' },
  { id: 'low', name: 'Pensar', desc: 'Razonamiento básico', level: 'low' },
  { id: 'medium', name: 'Medio', desc: 'Razonamiento balanceado', level: 'medium' },
  { id: 'high', name: 'Alto', desc: 'Máximo razonamiento', level: 'high' },
];

const THINKING_OPTIONS_GEMINI3_PRO: ThinkingOption[] = [
  { id: 'low', name: 'Pensar', desc: 'Razonamiento básico', level: 'low' },
  { id: 'high', name: 'Pro', desc: 'Máximo razonamiento', level: 'high' },
];

const THINKING_OPTIONS_GEMINI25: ThinkingOption[] = [
  { id: 'off', name: 'Rápido', desc: 'Sin pensamiento', budget: 0 },
  { id: 'low', name: 'Pensar', desc: 'Pensamiento ligero', budget: 1024 },
  { id: 'medium', name: 'Medio', desc: 'Pensamiento moderado', budget: 8192 },
  { id: 'high', name: 'Alto', desc: 'Pensamiento profundo', budget: 24576 },
];

export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro',
    desc: 'Mayor capacidad de razonamiento lógico.',
    thinkingType: 'level',
    thinkingOptions: THINKING_OPTIONS_GEMINI3_PRO,
  },
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3.0 Flash',
    desc: 'Equilibrio perfecto entre velocidad y calidad.',
    thinkingType: 'level',
    thinkingOptions: THINKING_OPTIONS_GEMINI3_FLASH,
  },
  {
    id: 'gemini-3.1-flash-lite-preview',
    name: 'Gemini 3.1 Flash Lite',
    desc: 'Ultra rápido y ligero para tareas simples.',
    thinkingType: 'level',
    thinkingOptions: THINKING_OPTIONS_GEMINI3_FLASH,
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    desc: 'Modelo de máxima inteligencia.',
    thinkingType: 'budget',
    thinkingOptions: THINKING_OPTIONS_GEMINI25,
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    desc: 'Ultra rápido y ligero para tareas simples.',
    thinkingType: 'budget',
    thinkingOptions: THINKING_OPTIONS_GEMINI25,
  },
];

export function useModelSelector() {
  const [preferredPrimaryModel, setPreferredPrimaryModel] = useState('gemini-3-flash-preview');
  const [thinkingMode, setThinkingMode] = useState('minimal');
  const [isThinkingDropdownOpen, setIsThinkingDropdownOpen] = useState(false);
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);

  // Close dropdowns when clicking outside
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

    const newModel = MODEL_OPTIONS.find(m => m.id === modelId);
    if (newModel) {
      const isGemini3 = newModel.thinkingType === 'level';
      const availableOptions = newModel.thinkingOptions.map(o => o.id);

      if (!availableOptions.includes(thinkingMode)) {
        if (modelId === 'gemini-3.1-pro-preview') {
          setThinkingMode('low');
        } else if (!isGemini3 && thinkingMode === 'minimal') {
          setThinkingMode('off');
        } else if (isGemini3 && thinkingMode === 'off') {
          setThinkingMode('minimal');
        }
      }
    }
    setIsModelSelectorOpen(false);
  };

  const currentModel = MODEL_OPTIONS.find(m => m.id === preferredPrimaryModel);
  const currentThinkingOption = currentModel?.thinkingOptions.find(o => o.id === thinkingMode);

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

export type { ThinkingOption, ModelOption };
