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
  PRIMARY: 'gemini-2.5-flash-preview',
  FALLBACK: 'gemini-2.5-flash',
  PRO: 'gemini-2.5-pro-preview',
  WEB_AGENT: 'gemini-2.5-flash-preview',
  LIVE: 'gemini-2.5-flash-native-audio-preview-12-2025',
  IMAGE_GENERATION: 'gemini-2.5-flash-image',
  DEEP_RESEARCH: 'deep-research-pro-preview-12-2025',
};

export const LIVE_API_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
