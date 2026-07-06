import { createMainSupabaseClient } from '../supabase-client-factory';
import {
  readSofliaLearningConfig,
} from './config';
import type {
  SofliaLearningClientResult,
  SofliaLearningConfig,
} from './types';

export function createSofliaLearningClient(config?: SofliaLearningConfig): SofliaLearningClientResult {
  const resolvedConfig = config || readSofliaLearningConfig();
  if (!resolvedConfig.configured) {
    return {
      bundle: null,
      config: resolvedConfig,
      error: resolvedConfig.error || 'SofLIA Learning no esta configurado.',
    };
  }

  const result = createMainSupabaseClient({
    url: resolvedConfig.url,
    key: resolvedConfig.key,
    serviceName: 'SofLIA-Learning',
  });

  if (!result.client) {
    return {
      bundle: null,
      config: {
        ...resolvedConfig,
        key: '',
      },
      error: result.error || 'No se pudo crear el cliente Supabase de SofLIA Learning.',
    };
  }

  return {
    bundle: {
      client: result.client,
      config: resolvedConfig,
    },
    config: {
      ...resolvedConfig,
      key: '',
    },
  };
}
