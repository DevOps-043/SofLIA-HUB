import path from 'node:path';
import * as dotenv from 'dotenv';

export function configureMainProcessEnvironment(dirname: string): {
  VITE_DEV_SERVER_URL: string | undefined;
  RENDERER_DIST: string;
} {
  const envPaths = [
    path.join(dirname, '..', '.env'),
    path.join(dirname, '.env'),
  ];

  for (const envPath of envPaths) {
    if (!dotenv.config({ path: envPath }).error) {
      console.log(`[BOOT] Environment loaded from ${envPath}`);
      break;
    }
  }

  process.env.APP_ROOT = path.join(dirname, '..');
  const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
  const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');
  process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
    ? path.join(process.env.APP_ROOT, 'public')
    : RENDERER_DIST;

  return { VITE_DEV_SERVER_URL, RENDERER_DIST };
}
