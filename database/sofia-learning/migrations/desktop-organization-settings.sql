-- Instancia: SOFIA Learning (mrqnnmuckznvukjvfkly). Migración aditiva e idempotente.
-- No concede UPDATE directo ni altera RLS/grants de las tablas compartidas.
-- Aplicar sólo con autorización explícita. RPC cerrada y bucket público de identidad.
BEGIN;

CREATE OR REPLACE FUNCTION public.desktop_organization_settings(
  p_organization_id uuid, p_changes jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  org public.organizations%ROWTYPE;
  normalized jsonb;
  field text;
  value text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Se requiere una sesión activa.' USING ERRCODE = '42501';
  END IF;
  -- El bloqueo mantiene la membresía autorizada hasta terminar la transacción.
  PERFORM id FROM public.organization_users
    WHERE organization_id = p_organization_id AND user_id = auth.uid()
      AND status = 'active' AND role IN ('owner', 'admin') FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No tienes permiso para administrar esta organización.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO org FROM public.organizations WHERE id = p_organization_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La organización no está disponible.' USING ERRCODE = '42501';
  END IF;

  IF p_changes IS NOT NULL THEN
    IF jsonb_typeof(p_changes) <> 'object' THEN
      RAISE EXCEPTION 'Los ajustes deben ser un objeto.' USING ERRCODE = '22023';
    END IF;
    normalized := '{}'::jsonb;
    FOR field IN SELECT jsonb_object_keys(p_changes) LOOP
      IF NOT field = ANY(ARRAY['name','description','contact_email','contact_phone','website_url','logo_url','brand_favicon_url','brand_color_primary','brand_color_secondary']) THEN
        RAISE EXCEPTION 'Campo de organización no permitido.' USING ERRCODE = '22023';
      END IF;
      IF jsonb_typeof(p_changes -> field) NOT IN ('string','null') THEN
        RAISE EXCEPTION 'El valor no es válido.' USING ERRCODE = '22023';
      END IF;
      value := nullif(btrim(p_changes ->> field), '');
      IF (field = 'name' AND (value IS NULL OR length(value) > 150))
        OR (field = 'description' AND length(value) > 2000)
        OR (field = 'contact_phone' AND length(value) > 40)
        OR (field = 'contact_email' AND (length(value) > 254 OR value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'))
        OR (field IN ('website_url','logo_url','brand_favicon_url') AND (length(value) > 2048 OR value !~ '^https://[^/@[:space:]]+([/?#][^[:space:]]*)?$'))
        OR (field IN ('brand_color_primary','brand_color_secondary') AND value !~* '^#[0-9a-f]{6}$') THEN
        RAISE EXCEPTION 'Revisa el formato o longitud del campo %.', field USING ERRCODE = '22023';
      END IF;
      normalized := normalized || jsonb_build_object(field, value);
    END LOOP;
    -- Se sincronizan las dos columnas existentes de logo sin modificar facturación.
    IF normalized ? 'logo_url' THEN
      normalized := normalized || jsonb_build_object('brand_logo_url', normalized -> 'logo_url');
    END IF;
    -- Bloquear antes de combinar evita perder actualizaciones parciales concurrentes.
    SELECT * INTO org FROM public.organizations WHERE id = p_organization_id AND is_active = true FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'La organización no está disponible.' USING ERRCODE = '42501'; END IF;
    org := jsonb_populate_record(org, normalized);
    UPDATE public.organizations SET name = org.name, description = org.description,
      contact_email = org.contact_email, contact_phone = org.contact_phone,
      website_url = org.website_url, logo_url = org.logo_url, brand_logo_url = org.brand_logo_url,
      brand_favicon_url = org.brand_favicon_url, brand_color_primary = org.brand_color_primary,
      brand_color_secondary = org.brand_color_secondary, updated_at = now()
      WHERE id = p_organization_id;
  END IF;
  RETURN jsonb_build_object('name', org.name, 'description', org.description,
    'contact_email', org.contact_email, 'contact_phone', org.contact_phone,
    'website_url', org.website_url, 'logo_url', coalesce(nullif(btrim(org.brand_logo_url),''), org.logo_url),
    'brand_favicon_url', org.brand_favicon_url, 'brand_color_primary', org.brand_color_primary,
    'brand_color_secondary', org.brand_color_secondary);
END;
$$;
REVOKE ALL ON FUNCTION public.desktop_organization_settings(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.desktop_organization_settings(uuid,jsonb) TO authenticated;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('organization-branding','organization-branding',true,2097152,ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT (id) DO NOTHING;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'organization-branding'
    AND (public IS DISTINCT FROM true OR file_size_limit IS DISTINCT FROM 2097152
      OR allowed_mime_types IS DISTINCT FROM ARRAY['image/png','image/jpeg','image/webp'])) THEN
    RAISE EXCEPTION 'El bucket organization-branding ya existe con otra configuración. Revisar antes de continuar.';
  END IF;
END $$;

-- El helper evita exigir SELECT de organizaciones al rol anon en otros buckets.
CREATE OR REPLACE FUNCTION private.can_manage_desktop_brand_asset(p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT auth.uid() IS NOT NULL
    AND p_name ~ '^[0-9a-f-]{36}/(logo|icon)/[0-9a-f-]{36}\.(png|jpg|webp)$'
    AND EXISTS (SELECT 1 FROM public.organization_users m
      JOIN public.organizations o ON o.id = m.organization_id
      WHERE m.organization_id::text = split_part(p_name,'/',1)
        AND m.user_id = auth.uid() AND m.status = 'active'
        AND m.role IN ('owner','admin') AND o.is_active = true);
$$;
REVOKE ALL ON FUNCTION private.can_manage_desktop_brand_asset(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.can_manage_desktop_brand_asset(text) TO anon, authenticated;

-- RESTRICTIVE es necesario: existe ALL permisivo para otros buckets.
-- La condición bucket_id <> ... conserva intacto el acceso de los demás buckets.
DROP POLICY IF EXISTS organization_branding_scope ON storage.objects;
CREATE POLICY organization_branding_scope ON storage.objects AS RESTRICTIVE
FOR ALL TO anon, authenticated
USING (bucket_id <> 'organization-branding' OR private.can_manage_desktop_brand_asset(name))
WITH CHECK (bucket_id <> 'organization-branding' OR private.can_manage_desktop_brand_asset(name));
DROP POLICY IF EXISTS organization_branding_admin ON storage.objects;
CREATE POLICY organization_branding_admin ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'organization-branding') WITH CHECK (bucket_id = 'organization-branding');

NOTIFY pgrst, 'reload schema';
COMMIT;

-- Rollback manual: revocar EXECUTE y eliminar la RPC y ambas políticas, manteniendo
-- una política RESTRICTIVE que deniegue organization-branding a anon/authenticated.
-- No borrar el bucket ni sus archivos: puede haber logos ya vinculados. Restaurar
-- los archivos de UI/servicio si se retira la función; ninguna fila se deshace sola.
