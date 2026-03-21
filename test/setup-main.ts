import { vi } from 'vitest';

// Mock electron module globally for all main process tests
vi.mock('electron', () => import('./mocks/electron'));

// Set test environment variables
process.env.VITE_GEMINI_API_KEY = 'test-gemini-key';
process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.VITE_SOFIA_SUPABASE_URL = 'https://test-sofia.supabase.co';
process.env.VITE_SOFIA_SUPABASE_ANON_KEY = 'test-sofia-anon-key';
process.env.VITE_IRIS_SUPABASE_URL = 'https://test-iris.supabase.co';
process.env.VITE_IRIS_SUPABASE_ANON_KEY = 'test-iris-anon-key';
process.env.VITE_GOOGLE_OAUTH_CLIENT_ID = 'test-client-id';
process.env.VITE_GOOGLE_OAUTH_CLIENT_SECRET = 'test-client-secret';
