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

/**
 * Inicio de sesion federado con SofLIA Learning.
 *
 * Ninguna de las dos variables es un secreto: la URL base es publica y el
 * interruptor solo decide si se ofrece la entrada. Las claves del proveedor de
 * identidad viven en Learning, que es quien ejecuta el intercambio.
 *
 * Apagar el interruptor devuelve el inicio por contrasena como unica via, sin
 * publicar una version nueva.
 */
export const LEARNING_SSO = {
  BASE_URL: (import.meta.env.VITE_LEARNING_BASE_URL || '').trim().replace(/\/+$/, ''),
  ENABLED: import.meta.env.VITE_LEARNING_SSO_ENABLED === 'true',
};

export function isLearningSsoConfigured(): boolean {
  return LEARNING_SSO.ENABLED && LEARNING_SSO.BASE_URL.length > 0;
}

// Model Configurations
export const MODELS = {
  // Base Gemini compartida; el catálogo visible se define por separado.
  // Computer Use fija PRIMARY y no consulta FALLBACK/PRO.
  PRIMARY: SOFLIA_RUNTIME_MODEL,
  FALLBACK: SOFLIA_RUNTIME_MODEL,
  PRO: SOFLIA_RUNTIME_MODEL,
  WEB_AGENT: SOFLIA_RUNTIME_MODEL,
  ORB: SOFLIA_RUNTIME_MODEL,
  IMAGE_GENERATION: 'gemini-3.1-flash-image',
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
