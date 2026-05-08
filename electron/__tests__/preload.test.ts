import { describe } from 'vitest';
import { registerPreloadChannelTests } from './preload/channel-cases';
import { registerPreloadPayloadTests } from './preload/payload-cases';
import { registerPreloadSourceTests } from './preload/source-cases';

describe('Preload IPC Security Layer', () => {
  registerPreloadPayloadTests();
  registerPreloadChannelTests();
  registerPreloadSourceTests();
});
