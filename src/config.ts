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
  // SofLIA: el modelo por defecto del chat.
  PRIMARY: 'gemini-3.6-flash',
  FALLBACK: 'gemini-3.5-flash-lite',
  PRO: 'gemini-2.5-pro',
  WEB_AGENT: 'gemini-3.5-flash',
  // Orbe de voz: usa el modelo mas reciente por latencia de primera frase.
  // Si falla, sendMessageStream cae a FALLBACK/PRIMARY automaticamente.
  ORB: 'gemini-3.6-flash',
  IMAGE_GENERATION: 'gemini-2.5-flash-image',
  DEEP_RESEARCH: 'deep-research-pro-preview-12-2025',
  TRANSCRIPTION: 'gemini-3.5-flash-lite',
  MAPS: 'gemini-3.5-flash-lite',
};

// Familia GPT-5.6 de OpenAI. Terra (SofLIA Max) se reserva para acciones reales
// sobre la computadora: abrir apps, mover el cursor, hacer clic. Luna (SofLIA
// Pro) atiende la orbe y el resto de comandos, que son la mayoria del uso.
// Solo se enrutan si hay OPENAI_API_KEY: sin llave el producto cae a Gemini.
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
