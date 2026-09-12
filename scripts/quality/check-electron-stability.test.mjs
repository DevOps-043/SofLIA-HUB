import assert from 'node:assert/strict';
import { isPrerelease, validateElectronRelease } from './check-electron-stability.mjs';

assert.equal(isPrerelease('43.4.0'), false);
assert.equal(isPrerelease('44.0.0-beta.3'), true);
assert.equal(validateElectronRelease({ version: '43.4.0' }).valid, true);
for (const version of [undefined, null, '', '^43.4.0', '*', 'latest', '43.4', 'texto']) assert.equal(validateElectronRelease({ version }).valid, false);
assert.equal(validateElectronRelease({ version: '44.0.0-beta.3', exception: null }).valid, false);
assert.equal(validateElectronRelease({
  version: '44.0.0-beta.3',
  now: new Date('2026-09-04T00:00:00Z'),
  exception: { version: '44.0.0-beta.3', expiresAt: '2026-09-30T00:00:00Z', risk: 'Compatibilidad web', rollback: 'Volver a 43.4.0' },
}).valid, true);
