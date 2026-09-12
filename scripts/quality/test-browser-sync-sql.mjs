// PostgreSQL desechable en memoria. Nunca lee .env ni contacta Supabase.
import assert from 'node:assert/strict';
import { randomUUID, createCipheriv, randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const runtime = process.argv[2];
assert.ok(runtime && path.isAbsolute(runtime), 'Indica la ruta absoluta del paquete PGlite aislado.');
const manifest = JSON.parse(await fs.readFile(path.join(runtime, 'package.json'), 'utf8'));
assert.equal(manifest.name, '@electric-sql/pglite');
assert.equal(manifest.version, '0.5.8');
const { PGlite } = await import(pathToFileURL(path.join(runtime, 'dist/index.js')).href);
const db = new PGlite();
const root = fileURLToPath(new URL('../../', import.meta.url));
const evidence = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-sync-sql-evidence-'));
const report = { status: 'running', runtime: 'PGlite 0.5.8', postgres: '', checks: [], limitations: [
  'PostgreSQL en memoria; no verifica gateway PostgREST, firma JWT, concurrencia de conexiones ni instancia Lia remota.',
  'auth.users, auth.sessions, auth.uid y auth.jwt son fixtures mínimas; no se emiten tokens reales.',
] };
function check(label) { report.checks.push(label); console.log('[SQL] OK: ' + label); }
const userA = randomUUID(); const userB = randomUUID();
const sessionA = randomUUID(); const sessionA2 = randomUUID(); const sessionB = randomUUID();
const deviceA = randomUUID(); const deviceA2 = randomUUID(); const deviceB = randomUUID();
const trace = () => randomUUID();
async function actor(user, sessionId, role = 'authenticated', isAnonymous = false) {
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: user, session_id: sessionId, role, is_anonymous: isAnonymous })]);
  assert.ok(['anon', 'authenticated'].includes(role));
  await db.exec(`SET ROLE ${role}`);
}
const query = (sql, values = []) => db.query(sql, values);
const put = (envelope, revision, key = randomUUID(), category = envelope.category) => query(
  'SELECT public.browser_sync_put($1,$2::jsonb,$3,$4::uuid,$5::uuid) AS result', [category, JSON.stringify(envelope), revision, key, trace()],
).then((result) => result.rows[0].result);
function envelope(category = 'bookmarks') {
  const key = randomBytes(32); const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(`soflia-sync:v1:${category}`));
  const plaintext = category === 'settings' ? '{"theme":"dark"}' : '[]';
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  key.fill(0);
  return { version: 1, algorithm: 'aes-256-gcm', category, nonce: nonce.toString('base64'),
    ciphertext: ciphertext.toString('base64'), authTag: cipher.getAuthTag().toString('base64') };
}
try {
  report.postgres = (await query('SELECT version() AS version')).rows[0].version;
  await db.exec(`CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE auth.sessions(id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id));
    CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid $$;
    GRANT USAGE ON SCHEMA auth, public TO anon, authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid(), auth.jwt() TO anon, authenticated;`);
  await query('INSERT INTO auth.users VALUES ($1),($2)', [userA, userB]);
  await query('INSERT INTO auth.sessions VALUES ($1,$2),($3,$2),($4,$5)', [sessionA, userA, sessionA2, sessionB, userB]);
  const sql = await fs.readFile(path.join(root, 'database/lia/migrations/browser-encrypted-sync.sql'), 'utf8');
  await db.exec(sql); await db.exec(sql);
  check('migración aditiva aplica dos veces sin duplicar tablas, políticas ni privilegios');

  await actor(userA, sessionA, 'anon');
  await assert.rejects(query('SELECT * FROM public.browser_sync_envelopes'), /permission denied/);
  await assert.rejects(query('SELECT public.browser_sync_register_device($1,$2)', [deviceA, trace()]), /permission denied/);
  await actor(userA, sessionB);
  await assert.rejects(query('SELECT public.browser_sync_register_device($1,$2)', [deviceA, trace()]), /sesión Lia/);
  await actor(userA, null);
  await assert.rejects(query('SELECT public.browser_sync_register_device($1,$2)', [deviceA, trace()]), /sesión Lia/);
  await actor(userA, sessionA, 'authenticated', true);
  await assert.rejects(query('SELECT public.browser_sync_register_device($1,$2)', [deviceA, trace()]), /sesión Lia/);
  assert.equal((await query('SELECT * FROM public.browser_sync_envelopes')).rows.length, 0);
  check('anon, Auth anónimo, sesión ausente y sesión de otro titular no registran ni leen datos');

  await actor(userA, sessionA);
  await query('SELECT public.browser_sync_register_device($1,$2)', [deviceA, trace()]);
  await query('SELECT public.browser_sync_register_device($1,$2)', [deviceA, trace()]);
  assert.equal((await query('SELECT device_id FROM public.browser_sync_devices')).rows.length, 1);
  await assert.rejects(query('SELECT auth_session_id FROM public.browser_sync_devices'), /permission denied/);
  await assert.rejects(query('SELECT * FROM public.browser_sync_mutations'), /permission denied/);
  await assert.rejects(query('SELECT public.browser_sync_actor_session()'), /permission denied/);
  check('registro idempotente; JWT de sesión y recibos no quedan expuestos por SELECT');

  const data = envelope(); const key = randomUUID();
  assert.deepEqual(await put(data, 0, key), { status: 'written', revision: 1 });
  assert.deepEqual(await put(data, 0, key), { status: 'replayed', revision: 1 });
  await assert.rejects(put(envelope(), 0, key), /idempotencia/);
  assert.deepEqual(await put(envelope(), 0), { status: 'conflict', revision: 1 });
  assert.deepEqual(await put(envelope(), 1), { status: 'written', revision: 2 });
  assert.deepEqual(await put(data, 0, key), { status: 'replayed', revision: 1 });
  check('recibos conservan replay exacto incluso después de otra versión; conflicto no sobrescribe');

  for (const invalid of [{ ...data, category: 'passwords' }, { ...data, version: 2 }, { ...data, algorithm: 'none' },
    { ...data, nonce: 'AA==' }, { ...data, authTag: 'AA==' }, { ...data, ciphertext: 'texto' },
    { ...data, ciphertext: Buffer.alloc(2097153).toString('base64') }, { ...data, secret: 'ficticio' },
    { ...data, ciphertext: null }]) await assert.rejects(put(invalid, 2), /contrato/);
  await assert.rejects(put(data, 2, randomUUID(), 'tabs'), /contrato/);
  for (const category of ['groups', 'tabs', 'settings']) assert.equal((await put(envelope(category), 0)).status, 'written');
  check('categorías cerradas y límites de envelope, nonce, tag y ciphertext verificados');

  await actor(userB, sessionB);
  await query('SELECT public.browser_sync_register_device($1,$2)', [deviceB, trace()]);
  assert.equal((await query('SELECT * FROM public.browser_sync_envelopes')).rows.length, 0);
  assert.deepEqual((await query('SELECT device_id FROM public.browser_sync_devices')).rows, [{ device_id: deviceB }]);
  assert.equal((await query('SELECT public.browser_sync_revoke_device($1,$2) AS revoked', [deviceA, trace()])).rows[0].revoked, false);
  assert.equal((await put(envelope(), 0)).revision, 1);
  check('otro titular sólo ve y modifica su ámbito; no revoca dispositivos ajenos');

  // Comprobar RLS por separado de GRANT, sólo dentro de la base desechable.
  await db.exec('RESET ROLE; GRANT INSERT, UPDATE, DELETE ON public.browser_sync_envelopes TO authenticated;');
  await actor(userA, sessionA);
  await assert.rejects(query('INSERT INTO public.browser_sync_envelopes(owner_user_id,category,revision,envelope,device_id) VALUES ($1,$2,1,$3,$4)', [userB, 'settings', data, deviceB]), /row-level security/);
  assert.equal((await query('UPDATE public.browser_sync_envelopes SET revision = 8 RETURNING revision')).rows.length, 0);
  assert.equal((await query('DELETE FROM public.browser_sync_envelopes RETURNING revision')).rows.length, 0);
  await db.exec('RESET ROLE; REVOKE INSERT, UPDATE, DELETE ON public.browser_sync_envelopes FROM authenticated;');
  check('RLS deniega INSERT, UPDATE y DELETE directos aun con grants accidentales de tabla');

  await actor(userA, sessionA2);
  await query('SELECT public.browser_sync_register_device($1,$2)', [deviceA2, trace()]);
  assert.equal((await query('SELECT * FROM public.browser_sync_envelopes')).rows.length, 4);
  await query('SELECT public.browser_sync_revoke_device($1,$2)', [deviceA, trace()]);
  await actor(userA, sessionA);
  assert.equal((await query('SELECT * FROM public.browser_sync_envelopes')).rows.length, 0);
  await assert.rejects(put(data, 0, key), /autorizado/);
  await assert.rejects(query('SELECT public.browser_sync_register_device($1,$2)', [randomUUID(), trace()]), /revocado/);
  assert.equal((await query('SELECT public.browser_sync_revoke_device($1,$2) AS revoked', [deviceA, trace()])).rows[0].revoked, true);
  check('revocar bloquea lecturas, escrituras, replays y re-registro de la sesión anterior');

  await db.exec('RESET ROLE');
  await query('DELETE FROM auth.sessions WHERE id=$1', [sessionB]);
  await actor(userB, sessionB);
  assert.equal((await query('SELECT * FROM public.browser_sync_envelopes')).rows.length, 0);
  await assert.rejects(put(envelope(), 1), /sesión Lia/);
  check('logout que elimina auth.sessions invalida también el acceso aunque el claim siga presente');

  await db.exec('RESET ROLE');
  await query(`INSERT INTO public.browser_sync_devices(owner_user_id,device_id,auth_session_id,registration_trace_id)
    SELECT $1,gen_random_uuid(),gen_random_uuid(),gen_random_uuid() FROM generate_series(1,98)`, [userA]);
  const extraSession = randomUUID();
  await query('INSERT INTO auth.sessions VALUES ($1,$2)', [extraSession, userA]);
  await actor(userA, extraSession);
  await assert.rejects(query('SELECT public.browser_sync_register_device($1,$2)', [randomUUID(), trace()]), /cuota de dispositivos/);
  await db.exec('RESET ROLE');
  await query(`INSERT INTO public.browser_sync_mutations(owner_user_id,idempotency_key,trace_id,category,device_id,request_hash,revision)
    SELECT $1,gen_random_uuid(),gen_random_uuid(),'bookmarks',$2,sha256('ficticio'::bytea),1 FROM generate_series(1,10000)`, [userA, deviceA2]);
  await actor(userA, sessionA2);
  await assert.rejects(put(envelope(), 2), /cuota de recibos/);
  assert.equal((await query("SELECT revision FROM public.browser_sync_envelopes WHERE category='bookmarks'")).rows[0].revision, 2);
  check('cuotas bloquean registros y escrituras nuevos sin purgar revocación ni cambiar la versión');

  await db.exec('RESET ROLE');
  const before = (await query('SELECT owner_user_id,category,revision,envelope FROM public.browser_sync_envelopes ORDER BY owner_user_id,category')).rows;
  const disable = await fs.readFile(path.join(root, 'database/lia/rollbacks/browser-encrypted-sync-disable.sql'), 'utf8');
  await db.exec(disable); await db.exec(disable);
  await actor(userA, sessionA2);
  await assert.rejects(query('SELECT device_id FROM public.browser_sync_devices'), /permission denied/);
  await assert.rejects(query('SELECT * FROM public.browser_sync_envelopes'), /permission denied/);
  await assert.rejects(put(envelope(), 2), /permission denied/);
  await db.exec('RESET ROLE');
  assert.deepEqual((await query('SELECT owner_user_id,category,revision,envelope FROM public.browser_sync_envelopes ORDER BY owner_user_id,category')).rows, before);
  await db.exec(sql);
  await actor(userA, sessionA2);
  assert.equal((await query('SELECT * FROM public.browser_sync_envelopes')).rows.length, 4);
  check('rollback idempotente revoca acceso sin borrar datos; reaplicar recupera permisos');
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  // Las fixtures son ficticias; no imprimir SQL ni parámetros por defecto.
  report.failure = error instanceof Error ? error.name : 'Error';
  console.error('[SQL] Falló la comprobación posterior al último OK. Código:', error?.code ?? 'assertion');
  process.exitCode = 1;
} finally {
  await db.close();
  await fs.writeFile(path.join(evidence, 'report.json'), JSON.stringify(report, null, 2));
  console.log('[SQL] Evidencia:', evidence);
}
