// Proveedor ficticio para probar tuberías reales sin audio, modelos ni Python.
const readline = require('node:readline');
const protocol = Number(process.argv[2]);
let received = 0;
const emit = value => process.stdout.write(JSON.stringify(value) + '\n');
emit({ event: 'ready', protocol });
readline.createInterface({ input: process.stdin }).on('line', line => {
  const request = JSON.parse(line); received++;
  if (request.cmd === 'shutdown') { emit({ id: request.id, ok: true, bye: true }); process.exitCode = 0; process.stdin.destroy(); return; }
  if (request.cmd === 'crash') { process.exit(3); return; }
  if (request.cmd === 'invalid') { process.stdout.write(Buffer.from([0xff, 10])); return; }
  if (request.cmd === 'slow') { setTimeout(() => emit({ id: request.id, ok: true, late: true }), 250); return; }
  const message = { id: request.id, ok: true, pong: true, text: request.params.text ?? '', received, protocol };
  if (request.cmd === 'fragment') {
    const bytes = Buffer.from(JSON.stringify(message) + '\n'); let offset = 0;
    const next = () => { if (offset < bytes.length) { process.stdout.write(bytes.subarray(offset, ++offset)); setImmediate(next); } }; next();
  } else emit(message);
});
