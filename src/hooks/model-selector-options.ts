import { SOFLIA_LITE_MODEL, SOFLIA_MAX_MODEL, SOFLIA_PRO_MODEL, SOFLIA_RUNTIME_MODEL } from '../shared/soflia-runtime-model';

export interface ThinkingOption {
  id: string;
  name: string;
  desc: string;
  level?: string;
  budget?: number;
}

export type ModelProvider = 'google' | 'openai';

export type ModelIconKey = 'spark' | 'bolt' | 'nodes' | 'feather' | 'globe' | 'moon';

export interface ModelOption {
  id: string;
  name: string;
  desc: string;
  icon: ModelIconKey;
  provider: ModelProvider;
  badge?: string;
  thinkingType: 'level' | 'budget';
  defaultThinkingId: string;
  thinkingOptions: ThinkingOption[];
}

const THINKING_OPTIONS_GEMINI3_FLASH: ThinkingOption[] = [
  { id: 'low', name: 'Bajo', desc: 'Razonamiento ligero', level: 'low' },
  { id: 'medium', name: 'Medio', desc: 'Razonamiento balanceado', level: 'medium' },
  { id: 'high', name: 'Alto', desc: 'Maximo razonamiento', level: 'high' },
];

// El producto no expone un modo sin razonamiento. `xhigh` y `max` son
// exclusivos de la familia OpenAI.
const THINKING_OPTIONS_OPENAI: ThinkingOption[] = [
  { id: 'low', name: 'Bajo', desc: 'Razonamiento ligero', level: 'low' },
  { id: 'medium', name: 'Medio', desc: 'Razonamiento balanceado', level: 'medium' },
  { id: 'high', name: 'Alto', desc: 'Razonamiento profundo', level: 'high' },
  { id: 'xhigh', name: 'Muy alto', desc: 'Mayor exploracion y verificacion', level: 'xhigh' },
  { id: 'max', name: 'Maximo', desc: 'Calidad prioritaria para tareas dificiles', level: 'max' },
];

/** Modelo por defecto del chat. */
export const DEFAULT_MODEL_ID = SOFLIA_RUNTIME_MODEL;

export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: DEFAULT_MODEL_ID,
    name: 'SofLIA',
    desc: 'Equilibrio ideal para el dia a dia.',
    icon: 'spark',
    provider: 'google',
    thinkingType: 'level',
    defaultThinkingId: 'medium',
    thinkingOptions: THINKING_OPTIONS_GEMINI3_FLASH,
  },
  {
    id: SOFLIA_MAX_MODEL,
    name: 'SofLIA Max',
    desc: 'Maxima potencia para tareas exigentes.',
    icon: 'globe',
    provider: 'openai',
    badge: '3/mes',
    thinkingType: 'level',
    defaultThinkingId: 'medium',
    thinkingOptions: THINKING_OPTIONS_OPENAI,
  },
  {
    id: SOFLIA_PRO_MODEL,
    name: 'SofLIA Pro',
    desc: 'Capaz para comandos y acciones.',
    icon: 'moon',
    provider: 'openai',
    thinkingType: 'level',
    defaultThinkingId: 'medium',
    thinkingOptions: THINKING_OPTIONS_OPENAI,
  },
  {
    id: SOFLIA_LITE_MODEL,
    name: 'SofLIA Lite',
    desc: 'Ultra ligero para tareas simples.',
    icon: 'feather',
    provider: 'google',
    thinkingType: 'level',
    defaultThinkingId: 'low',
    thinkingOptions: THINKING_OPTIONS_GEMINI3_FLASH,
  },
];
