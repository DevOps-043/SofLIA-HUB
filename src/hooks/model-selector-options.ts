export interface ThinkingOption {
  id: string;
  name: string;
  desc: string;
  level?: string;
  budget?: number;
}

export type ModelIconKey = 'spark' | 'bolt' | 'nodes' | 'feather' | 'globe' | 'moon';

export interface ModelOption {
  id: string;
  name: string;
  desc: string;
  icon: ModelIconKey;
  badge?: string;
  thinkingType: 'level' | 'budget';
  thinkingOptions: ThinkingOption[];
}

const THINKING_OPTIONS_GEMINI3_FLASH: ThinkingOption[] = [
  { id: 'minimal', name: 'Rapido', desc: 'Responde rapidamente', level: 'minimal' },
  { id: 'low', name: 'Pensar', desc: 'Razonamiento basico', level: 'low' },
  { id: 'medium', name: 'Medio', desc: 'Razonamiento balanceado', level: 'medium' },
  { id: 'high', name: 'Alto', desc: 'Maximo razonamiento', level: 'high' },
];

// GPT-5.6 expone el esfuerzo de razonamiento en `reasoning.effort`; los ids
// coinciden con los valores que acepta la Responses API.
const THINKING_OPTIONS_GPT56: ThinkingOption[] = [
  { id: 'minimal', name: 'Rapido', desc: 'Responde rapidamente', level: 'minimal' },
  { id: 'low', name: 'Pensar', desc: 'Razonamiento basico', level: 'low' },
  { id: 'medium', name: 'Medio', desc: 'Razonamiento balanceado', level: 'medium' },
  { id: 'high', name: 'Alto', desc: 'Maximo razonamiento', level: 'high' },
];

/** Modelo por defecto del chat. */
export const DEFAULT_MODEL_ID = 'gemini-3.6-flash';

export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: DEFAULT_MODEL_ID,
    name: 'SofLIA',
    desc: 'Equilibrio ideal para el dia a dia.',
    icon: 'spark',
    thinkingType: 'level',
    thinkingOptions: THINKING_OPTIONS_GEMINI3_FLASH,
  },
  {
    id: 'gpt-5.6-terra',
    name: 'SofLIA Max',
    desc: 'Maxima potencia para tareas exigentes.',
    icon: 'globe',
    badge: '3/mes',
    thinkingType: 'level',
    thinkingOptions: THINKING_OPTIONS_GPT56,
  },
  {
    id: 'gpt-5.6-luna',
    name: 'SofLIA Pro',
    desc: 'Rapido y capaz para comandos y acciones.',
    icon: 'moon',
    thinkingType: 'level',
    thinkingOptions: THINKING_OPTIONS_GPT56,
  },
  {
    id: 'gemini-3.5-flash-lite',
    name: 'SofLIA Lite',
    desc: 'Ultra ligero para tareas simples.',
    icon: 'feather',
    thinkingType: 'level',
    thinkingOptions: THINKING_OPTIONS_GEMINI3_FLASH,
  },
];
