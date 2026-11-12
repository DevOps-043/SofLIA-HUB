import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import console from 'node:console';

// Motor PostgreSQL local efímero; no conecta con la instancia remota.
const { PGlite } = await import(pathToFileURL(resolve('tmp/organization-settings-sql/node_modules/@electric-sql/pglite/dist/index.js')).href);
const db = new PGlite();
const org = '10000000-0000-4000-8000-000000000001';
const other = '10000000-0000-4000-8000-000000000002';
const admin = '20000000-0000-4000-8000-000000000001';
const member = '20000000-0000-4000-8000-000000000002';
const suspended = '20000000-0000-4000-8000-000000000003';
const owner = '20000000-0000-4000-8000-000000000004';
let checks = 0;
async function denied(action, code = '42501') { await assert.rejects(action, error => error.code === code); checks++; }
async function actor(id, role = 'authenticated') { await db.exec(`SET ROLE ${role}; SELECT set_config('request.jwt.claim.sub','${id}',false);`); }
const rpc = changes => db.query('select public.desktop_organization_settings($1,$2::jsonb) as settings', [org, changes == null ? null : JSON.stringify(changes)]);
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE SCHEMA private;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    CREATE TABLE public.organizations(id uuid PRIMARY KEY,name varchar(255) NOT NULL,description text,contact_email varchar(255),contact_phone varchar(50),website_url text,logo_url text,brand_logo_url text,brand_favicon_url text,brand_color_primary varchar(20),brand_color_secondary varchar(20),is_active boolean DEFAULT true,updated_at timestamp,subscription_plan text DEFAULT 'team');
    CREATE TABLE public.organization_users(id uuid PRIMARY KEY,organization_id uuid,user_id uuid,role text,status text);
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    CREATE TABLE storage.objects(id text PRIMARY KEY,bucket_id text,name text);
    ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.organization_users ENABLE ROW LEVEL SECURITY;
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA public,auth,storage TO anon,authenticated;
    GRANT SELECT ON public.organizations,public.organization_users TO authenticated;
    GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO anon,authenticated;
    CREATE POLICY organizations_select_member ON public.organizations FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.organization_users m WHERE m.organization_id=organizations.id AND m.user_id=auth.uid() AND m.status='active'));
    CREATE POLICY own_membership ON public.organization_users FOR SELECT TO authenticated USING(user_id=auth.uid());
    CREATE POLICY live_recordings_server_only ON storage.objects FOR ALL TO anon,authenticated USING(bucket_id <> 'live-recordings') WITH CHECK(bucket_id <> 'live-recordings');
    INSERT INTO public.organizations(id,name) VALUES('${org}','Empresa de prueba'),('${other}','Otra empresa');
    INSERT INTO public.organization_users VALUES
      ('30000000-0000-4000-8000-000000000001','${org}','${admin}','admin','active'),
      ('30000000-0000-4000-8000-000000000002','${org}','${member}','member','active'),
      ('30000000-0000-4000-8000-000000000003','${org}','${suspended}','admin','suspended'),
      ('30000000-0000-4000-8000-000000000004','${org}','${owner}','owner','active');
  `);
  const migration = await readFile('database/sofia-learning/migrations/desktop-organization-settings.sql', 'utf8');
  await db.exec(migration);
  await db.exec(migration); checks++;
  await actor('', 'anon'); await denied(() => rpc(null));
  await actor(member); await denied(() => rpc(null));
  await actor(suspended); await denied(() => rpc({ name: 'No autorizado' }));
  await actor(admin);
  assert.equal((await rpc(null)).rows[0].settings.name, 'Empresa de prueba'); checks++;
  await denied(() => db.query('select public.desktop_organization_settings($1,null)', [other]));
  await denied(() => rpc({ subscription_plan: 'enterprise' }), '22023');
  await denied(() => rpc({ name: '' }), '22023');
  await denied(() => rpc({ name: 'x'.repeat(151) }), '22023');
  await denied(() => rpc({ logo_url: 'javascript:alert(1)' }), '22023');
  await denied(() => rpc({ logo_url: 'https://usuario:clave@example.test/logo.png' }), '22023');
  await denied(() => rpc({ brand_color_primary: 'rojo' }), '22023');
  await denied(() => rpc({ description: { script: true } }), '22023');
  const saved = (await rpc({ name: 'Nueva identidad', logo_url: 'https://example.test/logo.png', brand_color_primary: '#123ABC' })).rows[0].settings;
  assert.equal(saved.name, 'Nueva identidad'); checks++;
  await denied(() => db.exec(`UPDATE public.organizations SET subscription_plan='enterprise' WHERE id='${org}'`));
  const path = `${org}/logo/40000000-0000-4000-8000-000000000001.png`;
  await db.query('insert into storage.objects values($1,$2,$3)', ['asset', 'organization-branding', path]); checks++;
  await denied(() => db.query('insert into storage.objects values($1,$2,$3)', ['other', 'organization-branding', path.replace(org, other)]));
  await actor(member); await denied(() => db.query('insert into storage.objects values($1,$2,$3)', ['member', 'organization-branding', path]));
  await actor('', 'anon'); await denied(() => db.query('insert into storage.objects values($1,$2,$3)', ['anon', 'organization-branding', path]));
  await db.exec("insert into storage.objects values('legacy','assets','anterior.png')"); checks++;
  await actor(owner); assert.equal((await rpc({ description: 'Actualizada por el propietario' })).rows[0].settings.description, 'Actualizada por el propietario'); checks++;
  await db.exec('RESET ROLE');
  const stored = (await db.query('select logo_url,brand_logo_url,subscription_plan from public.organizations where id=$1', [org])).rows[0];
  assert.equal(stored.logo_url, stored.brand_logo_url); assert.equal(stored.subscription_plan, 'team'); checks++;
  const rollback = await readFile('database/sofia-learning/rollbacks/desktop-organization-settings.sql', 'utf8');
  await db.exec(rollback); await db.exec(rollback); checks++;
  await actor(admin);
  await denied(() => db.query('insert into storage.objects values($1,$2,$3)', ['after-rollback', 'organization-branding', path]));
  await denied(() => rpc(null), '42883');
  await db.exec("insert into storage.objects values('legacy-after-rollback','assets','anterior.png')"); checks++;
  await db.exec('RESET ROLE'); await db.exec(migration); await actor(admin);
  assert.equal((await rpc(null)).rows[0].settings.name, 'Nueva identidad'); checks++;
  console.log(`Base efímera verificada: ${checks} controles de contrato, permisos, aislamiento, idempotencia y compatibilidad.`);
} finally { await db.close(); }
