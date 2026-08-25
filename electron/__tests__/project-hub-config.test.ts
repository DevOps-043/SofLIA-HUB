import { afterEach, describe, expect, it } from 'vitest';
import { resolveProjectHubBaseUrl } from '../project-hub/service';

const original = {
  runtime: process.env.PROJECT_HUB_API_URL,
  bundled: process.env.VITE_PROJECT_HUB_API_URL,
  devServer: process.env.VITE_DEV_SERVER_URL,
};

afterEach(() => {
  restore('PROJECT_HUB_API_URL', original.runtime);
  restore('VITE_PROJECT_HUB_API_URL', original.bundled);
  restore('VITE_DEV_SERVER_URL', original.devServer);
});

describe('resolveProjectHubBaseUrl', () => {
  it('prioriza la sobrescritura de runtime', () => {
    setEnv('PROJECT_HUB_API_URL', 'https://runtime.example.com');
    setEnv('VITE_PROJECT_HUB_API_URL', 'https://build.example.com');
    expect(resolveProjectHubBaseUrl()).toBe('https://runtime.example.com');
  });

  it('usa el endpoint público incorporado al instalador', () => {
    setEnv('PROJECT_HUB_API_URL');
    setEnv('VITE_PROJECT_HUB_API_URL', 'https://project-hub.example.com');
    expect(resolveProjectHubBaseUrl()).toBe('https://project-hub.example.com');
  });

  it('usa el dominio oficial cuando no hay una sobrescritura explícita', () => {
    setEnv('PROJECT_HUB_API_URL');
    setEnv('VITE_PROJECT_HUB_API_URL');
    expect(resolveProjectHubBaseUrl()).toBe('https://sofliahub.netlify.app');
  });
});

function restore(name: string, value: string | undefined): void {
  setEnv(name, value);
}

function setEnv(name: string, value?: string): void {
  if (value === undefined) Reflect.deleteProperty(process.env, name);
  else Reflect.set(process.env, name, value);
}
