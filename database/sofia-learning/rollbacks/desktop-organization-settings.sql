-- SOFIA Learning. Reversión manual, sólo con autorización explícita.
-- Conserva organizaciones, bucket e imágenes ya vinculadas; bloquea nuevas escrituras.
BEGIN;
DROP FUNCTION IF EXISTS public.desktop_organization_settings(uuid,jsonb);
DROP POLICY IF EXISTS organization_branding_admin ON storage.objects;
DROP POLICY IF EXISTS organization_branding_scope ON storage.objects;
CREATE POLICY organization_branding_scope ON storage.objects AS RESTRICTIVE
FOR ALL TO anon, authenticated
USING (bucket_id <> 'organization-branding') WITH CHECK (bucket_id <> 'organization-branding');
DROP FUNCTION IF EXISTS private.can_manage_desktop_brand_asset(text);
NOTIFY pgrst, 'reload schema';
COMMIT;
