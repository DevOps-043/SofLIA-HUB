import { execFileSync } from 'node:child_process';

// Procesos aislados, orden alternado y sin peticiones a Google ni credenciales.
const samples = { completo: [], selectivo: [] };
for (let round = 0; round < 3; round++) {
  for (const mode of round % 2 ? ['selectivo', 'completo'] : ['completo', 'selectivo']) {
    const modules = mode === 'completo' ? ['googleapis']
      : ['calendar', 'drive', 'gmail', 'chat', 'oauth2'].map(api => `googleapis/build/src/apis/${api}/index.js`);
    const source = `const start = performance.now();
      for (const name of ${JSON.stringify(modules)}) require(name);
      console.log(JSON.stringify({ ms: performance.now() - start, rssMB: process.memoryUsage().rss / 1048576,
        modules: Object.keys(require.cache).length }));`;
    samples[mode].push(JSON.parse(execFileSync(process.execPath, ['-e', source], {
      encoding: 'utf8', windowsHide: true, timeout: 60000,
    })));
  }
}
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
console.log(JSON.stringify({ samples, medianas: Object.fromEntries(Object.entries(samples).map(([mode, values]) => [mode, {
  ms: median(values.map(value => value.ms)), rssMB: median(values.map(value => value.rssMB)), modules: values[0].modules,
}])), limites: 'Carga local de módulos en Node; no mide toda la aplicación ni otros equipos.' }, null, 2));
