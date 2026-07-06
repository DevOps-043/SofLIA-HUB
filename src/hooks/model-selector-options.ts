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

const THINKING_OPTIONS_GEMINI25_PRO: ThinkingOption[] = [
  { id: 'low', name: 'Pensar', desc: 'Razonamiento basico', level: 'low' },
  { id: 'high', name: 'Pro', desc: 'Maximo razonamiento', level: 'high' },
];

export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'gemini-3.5-flash',
    name: 'SofLIA',
    desc: 'Modelo mas inteligente para agentes y codificacion.',
    thinkingType: 'level',
    thinkingOptions: THINKING_OPTIONS_GEMINI3_FLASH,
  },
  {
    id: 'gemini-2.5-pro',
    name: 'SofLIA Pro',
    desc: 'Mayor capacidad de razonamiento logico.',
    thinkingType: 'level',
    thinkingOptions: THINKING_OPTIONS_GEMINI25_PRO,
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'SofLIA Lite',
    desc: 'Ultra rapido y ligero para tareas simples.',
    thinkingType: 'level',
    thinkingOptions: THINKING_OPTIONS_GEMINI3_FLASH,
  },
];
