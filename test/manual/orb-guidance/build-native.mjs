import { build } from 'rolldown';
import { mkdir } from 'node:fs/promises';

await mkdir('work/orb-guidance', { recursive: true });
await build({
  input: 'test/manual/orb-guidance/native-smoke.ts', platform: 'node',
  external: ['electron', /^node:/],
  output: { file: 'work/orb-guidance/native-smoke.cjs', format: 'cjs' },
});
