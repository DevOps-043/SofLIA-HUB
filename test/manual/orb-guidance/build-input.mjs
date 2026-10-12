import { build } from 'rolldown';
import { mkdir } from 'node:fs/promises';
await mkdir('work/native-input', { recursive: true });
await build({ input: 'test/manual/orb-guidance/native-input.ts', platform: 'node', external: ['electron', /^node:/, '@nut-tree-fork/nut-js'],
  output: { file: 'work/native-input/input.cjs', format: 'cjs' },
});
