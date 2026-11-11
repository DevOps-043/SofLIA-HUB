import { fileURLToPath } from 'node:url';
import { runRendererFixture } from './renderer-fixture-smoke.mjs';

await runRendererFixture('select-dropdown', 'Selector', fileURLToPath(import.meta.url));
