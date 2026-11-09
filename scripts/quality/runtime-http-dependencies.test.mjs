import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { http } = require('follow-redirects');
const semver = require('semver');

test('las dependencias de sistema y red excluyen las versiones afectadas de noviembre', () => {
  assert.ok(semver.gte(require('systeminformation/package.json').version, '5.33.16'));
  assert.ok(semver.gte(require('follow-redirects/package.json').version, '1.16.2'));
});

test('una redirección entre orígenes retira cabeceras sensibles incluso de otro contexto', { timeout: 10_000 }, async () => {
  const observed = [];
  const target = createServer((request, response) => {
    observed.push(request.headers);
    response.end('ok');
  });
  const redirect = createServer((_request, response) => {
    response.writeHead(302, { location: `http://127.0.0.1:${target.address().port}/` });
    response.end();
  });
  const listen = server => new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    await listen(target);
    await listen(redirect);
    for (const sensitiveHeaders of [['X-API-Key'], runInNewContext("['X-API-Key']")]) {
      await new Promise((resolve, reject) => {
        const request = http.get(`http://127.0.0.1:${redirect.address().port}/`, {
          headers: { 'X-API-Key': 'credencial-ficticia', 'X-Harmless': 'dato-publico' },
          sensitiveHeaders, timeout: 3000,
        }, response => {
          response.resume();
          response.on('error', reject);
          response.on('end', resolve);
        });
        request.on('error', reject);
        request.on('timeout', () => request.destroy(new Error('Tiempo límite de redirección.')));
      });
    }
    assert.equal(observed.length, 2);
    for (const headers of observed) {
      assert.equal(headers['x-api-key'], undefined);
      assert.equal(headers['x-harmless'], 'dato-publico');
    }
  } finally {
    await Promise.all([redirect, target].map(server => new Promise(resolve => {
      server.closeAllConnections();
      server.close(resolve);
    })));
  }
});
