export const GOOGLE_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

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
  PRIMARY: 'gemini-3.5-flash',
  FALLBACK: 'gemini-3.5-flash-lite',
  PRO: 'gemini-2.5-pro',
  WEB_AGENT: 'gemini-3.5-flash',
  // Live API (voz bidireccional): 3.1 soporta function calling, grounding y thinkingLevel.
  LIVE: 'gemini-3.1-flash-live-preview',
  IMAGE_GENERATION: 'gemini-2.5-flash-image',
  DEEP_RESEARCH: 'deep-research-pro-preview-12-2025',
  TRANSCRIPTION: 'gemini-3.5-flash-lite',
  MAPS: 'gemini-3.5-flash-lite',
};

export const LIVE_API_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

// Google Cloud Text-to-Speech (voz de la orbe). Todas las variables llevan
// prefijo VITE_: es el unico que el build incrusta tanto en el renderer como en
// el proceso main, asi que la misma variable sirve en ambos lados.
export const GOOGLE_TTS = {
  API_KEY: import.meta.env.VITE_GOOGLE_CLOUD_TTS_API_KEY || '',
  VOICE: import.meta.env.VITE_GOOGLE_CLOUD_TTS_VOICE || 'es-US-Chirp3-HD-Aoede',
  LANGUAGE: import.meta.env.VITE_GOOGLE_CLOUD_TTS_LANGUAGE || 'es-US',
};
