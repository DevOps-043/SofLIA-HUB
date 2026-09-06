import { createEncryptedRefreshTokenStore } from './encrypted-refresh-token-store';

const store = createEncryptedRefreshTokenStore({
  fileName: 'sofia-session.enc',
  logScope: 'SofiaSession',
});

export const saveSofiaRefreshToken = (refreshToken: string): boolean => store.save(refreshToken);
export const readSofiaRefreshToken = (): string | null => store.read();
export const clearSofiaRefreshToken = (): void => store.clear();
export const hasStoredSofiaSession = (): boolean => store.hasStored();
