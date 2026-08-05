import { SOFLIA_RUNTIME_MODEL } from './shared/soflia-runtime-model';

export const GOOGLE_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

// OpenAI (familia GPT-5.6). Unica variable que hay que poner en el .env para
// habilitar Terra/Luna; sin ella el producto sigue funcionando solo con Gemini.
export const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';

// Lia Supabase (conversaciones, meetings, settings)
export const SUPABASE = {
  URL: import.meta.env.VITE_SUPABASE_URL || '',
  ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || ''
};

// SOFIA Supabase (autenticacion principal + organizaciones/equipos)
export const SOFIA_SUPABASE = {
  URL: import.meta.env.VITE_SOFIA_SUPABASE_URL || '',
  ANON_KEY: import.meta.env.VITE_SOFIA_SUPABASE_ANON_KEY || ''
};

// IRIS Supabase (Project Hub — proyectos, issues, equipos)
export const IRIS_SUPABASE = {
  URL: import.meta.env.VITE_IRIS_SUPABASE_URL || '',
  ANON_KEY: import.meta.env.VITE_IRIS_SUPABASE_ANON_KEY || ''
};

// Model Configurations
export const MODELS = {
  // Base Gemini compartida; el catálogo visible se define por separado.
  // Computer Use fija PRIMARY y no consulta FALLBACK/PRO.
  PRIMARY: SOFLIA_RUNTIME_MODEL,
  FALLBACK: SOFLIA_RUNTIME_MODEL,
  PRO: SOFLIA_RUNTIME_MODEL,
  WEB_AGENT: SOFLIA_RUNTIME_MODEL,
  ORB: SOFLIA_RUNTIME_MODEL,
  IMAGE_GENERATION: 'gemini-2.5-flash-image',
  DEEP_RESEARCH: 'deep-research-pro-preview-12-2025',
  TRANSCRIPTION: SOFLIA_RUNTIME_MODEL,
  MAPS: SOFLIA_RUNTIME_MODEL,
};

// Familia GPT-5.6 de OpenAI. Terra corresponde a SofLIA Max y conserva la clave
// histórica `COMPUTER_USE` por compatibilidad, aunque el actuador Computer Use
// usa exclusivamente Gemini 3.6 Flash. Luna corresponde a SofLIA Pro. El
// proveedor efectivo se decide por el modelo seleccionado; la llave puede
// provenir de la configuración guardada del usuario o del entorno.
export const OPENAI_MODELS = {
  COMPUTER_USE: 'gpt-5.6-terra',
  COMMANDS: 'gpt-5.6-luna',
};

/**
 * Vector stores de OpenAI para file_search (lo que la doc llama "retrieval").
 * La API exige al menos un `vector_store_ids`, asi que la herramienta queda
 * apagada mientras no se configure. Formato: ids separados por coma.
 */
export const OPENAI_VECTOR_STORE_IDS = (import.meta.env.VITE_OPENAI_VECTOR_STORE_IDS || '')
  .split(',')
  .map((id: string) => id.trim())
  .filter(Boolean);

export function isOpenAIConfigured(): boolean {
  return OPENAI_API_KEY.trim().length > 0;
}

// Google Cloud Text-to-Speech (voz de la orbe). Todas las variables llevan
// prefijo VITE_: es el unico que el build incrusta tanto en el renderer como en
// el proceso main, asi que la misma variable sirve en ambos lados.
export const GOOGLE_TTS = {
  API_KEY: import.meta.env.VITE_GOOGLE_CLOUD_TTS_API_KEY || '',
  VOICE: import.meta.env.VITE_GOOGLE_CLOUD_TTS_VOICE || 'es-US-Chirp3-HD-Aoede',
  LANGUAGE: import.meta.env.VITE_GOOGLE_CLOUD_TTS_LANGUAGE || 'es-US',
};
