import { readPrivateFile, replacePrivateFile } from '../storage/private-files';

export const MAX_CREDENTIAL_BYTES = 1024 * 1024;
export const readCredentialFile = (file: string) => readPrivateFile(file, MAX_CREDENTIAL_BYTES);
export const replaceCredentialFile = (file: string, data: Buffer, assert: () => void) => replacePrivateFile(file, data, assert, MAX_CREDENTIAL_BYTES);
