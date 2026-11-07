import { fileURLToPath } from 'node:url';
import { runRendererFixture } from './renderer-fixture-smoke.mjs';

await runRendererFixture('confirmation-dialog', 'Confirmación', fileURLToPath(import.meta.url));
