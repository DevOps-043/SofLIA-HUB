export interface ThinkingOption {
  id: string;
  name: string;
  desc: string;
  level?: string;
  budget?: number;
}

export interface ModelOption {
  id: string;
  name: string;
  desc: string;
  thinkingType: 'level' | 'budget';
  thinkingOptions: ThinkingOption[];
}

const THINKING_OPTIONS_GEMINI3_FLASH: ThinkingOption[] = [
  { id: 'minimal', name: 'Rapido', desc: 'Responde rapidamente', level: 'minimal' },
  { id: 'low', name: 'Pensar', desc: 'Razonamiento basico', level: 'low' },
  { id: 'medium', name: 'Medio', desc: 'Razonamiento balanceado', level: 'medium' },
  { id: 'high', name: 'Alto', desc: 'Maximo razonamiento', level: 'high' },
];

const THINKING_OPTIONS_GEMINI3_PRO: ThinkingOption[] = [
  { id: 'low', name: 'Pensar', desc: 'Razonamiento basico', level: 'low' },
  { id: 'high', name: 'Pro', desc: 'Maximo razonamiento', level: 'high' },
];

const THINKING_OPTIONS_GEMINI25: ThinkingOption[] = [
  { id: 'off', name: 'Rapido', desc: 'Sin pensamiento', budget: 0 },
  { id: 'low', name: 'Pensar', desc: 'Pensamiento ligero', budget: 1024 },
  { id: 'medium', name: 'Medio', desc: 'Pensamiento moderado', budget: 8192 },
  { id: 'high', name: 'Alto', desc: 'Pensamiento profundo', budget: 24576 },
];

export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'gemini-3.1-pro-preview',
    name: 'SofLIA Pro',
    desc: 'Mayor capacidad de razonamiento logico.',
    thinkingType: 'level',
    thinkingOptions: THINKING_OPTIONS_GEMINI3_PRO,
  },
  {
    id: 'gemini-3-flash-preview',
    name: 'SofLIA',
    desc: 'Equilibrio perfecto entre velocidad y calidad.',
    thinkingType: 'level',
    thinkingOptions: THINKING_OPTIONS_GEMINI3_FLASH,
  },
  {
    id: 'gemini-3.1-flash-lite-preview',
    name: 'SofLIA Lite',
    desc: 'Ultra rapido y ligero para tareas simples.',
    thinkingType: 'level',
    thinkingOptions: THINKING_OPTIONS_GEMINI3_FLASH,
  },
  {
    id: 'gemini-2.5-pro',
    name: 'SofLIA Deep',
    desc: 'Modelo de maxima inteligencia.',
    thinkingType: 'budget',
    thinkingOptions: THINKING_OPTIONS_GEMINI25,
  },
  {
    id: 'gemini-2.5-flash',
    name: 'SofLIA Swift',
    desc: 'Ultra rapido y ligero para tareas simples.',
    thinkingType: 'budget',
    thinkingOptions: THINKING_OPTIONS_GEMINI25,
  },
];
