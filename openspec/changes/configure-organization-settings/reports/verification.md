# Verificación

Fecha: 2026-11-11. Estado: implementación local verificada; activación remota
pendiente de autorización explícita.

## Resultado

El menú tiene fondo transparente, separador superior de 1 px, imagen y nombre
de 15 px sin flecha ni relleno al hover. Las imágenes conservan proporción y no
llevan caja. Se incorpora brand_logo_url a la consulta de perfil y se intenta
el logo heredado antes del favicon cuando falla la imagen de marca.

Ajustes incluye Organización para propietarios y administradores activos, con
datos generales, logo/icono por URL o archivo PNG/JPEG/WebP hasta 2 MiB y colores.
El guardado es explícito. Las imágenes seleccionadas se previsualizan y se
revisan antes de habilitar Guardar. Se usa el actor SOFIA, independiente del id
Lia de ajustes personales, y se descartan respuestas de otra selección/sesión.

## Seguridad y decisiones comprobadas

Las consultas remotas realizadas fueron exclusivamente de metadatos: columnas,
políticas, funciones de autorización, grants y buckets. SOFIA Learning tiene
SELECT para authenticated en organizations, sin UPDATE directo. No se alteraron
datos ni se aplicó la migración remotamente.

La RPC nueva valida auth.uid y membresía owner/admin activa; bloquea la membresía
durante la operación, acepta sólo nueve campos y sincroniza ambas columnas de
logo. No recibe actor ni rol del cliente y no permite suscripciones, permisos,
slug, estado activo ni miembros. Su SECURITY DEFINER mantiene search_path fijo,
sin EXECUTE para PUBLIC/anon y sin modificar grants/RLS de las tablas compartidas.

Se detectó una política de Storage preexistente que permite ALL a anon y
authenticated fuera de live-recordings. La política RESTRICTIVE nueva acota
exclusivamente organization-branding, incluidos actor y prefijo; el motor local
demuestra que la política permisiva anterior no la evade y que los demás
buckets conservan su comportamiento. Esta entrega no corrige la exposición
preexistente de otros buckets. El helper privado evita requerir lectura de las
tablas de organizaciones al rol anon al evaluar políticas de otros buckets.

La migración es transaccional e idempotente; si un bucket homónimo aparece con
configuración incompatible, aborta antes de exponer archivos. El rollback
retira la RPC y bloquea el bucket nuevo sin borrar imágenes ni datos.

## Comandos y resultados

- Suite dirigida de servicios, formulario, selector, sidebar, ajustes y auth:
  nueve archivos y 79 pruebas correctas en la ejecución final.
- `node test/manual/organization-settings/verify-database.mjs`: 27 controles
  correctos en PostgreSQL efímero (PGlite): admin/owner positivos, miembro,
  suspendido, anon y otra organización denegados; allowlist, formatos, longitudes,
  grants directos cerrados, aislamiento de cargas, idempotencia, rollback y
  reaplicación conservando los datos.
- `node test/manual/organization-settings/verify-ui.mjs`: correcto en Edge
  headless con red externa bloqueada y servicio ficticio; claro/oscuro, carga y
  previsualización de un PNG sintético, guardado, actualización del nombre del
  menú, fondo transparente incluso al hover, sin flecha, texto de 15 px, miembro
  sin apartado y ancho de 900 px sin desbordamiento horizontal.
- Capturas locales bajo `tmp/organization-settings`, ignoradas por Git. Se
  inspeccionaron formulario y menú en ambos temas; no certifican cuentas reales.
- ESLint directo de archivos nuevos y capas tocadas: correcto.
- `npm run typecheck`: correcto, también dentro de la compuerta final.
- `npm run docs:inventory:sync`: inventario derivado con 710 archivos de prueba.
- `npm run verify:pr`: las ejecuciones inicial y final pasaron typecheck y controles previos,
  pero se detuvo en lint de cambios ajenos de eliminación de carpetas: 9 errores
  y 1 advertencia en useAppViewHandlers-deleteFolder.test.ts, AppModals.tsx y
  DeleteFolderModal.tsx. No se modificaron para este trabajo ni se ejecutó la
  suite completa del workspace después de esa detención.
- `npm run docs:check`, `npm run harness:validate` y ESLint final de todas las
  capas nuevas y modificadas sin deuda histórica: correctos.
- Consulta remota final de sólo lectura: RPC y bucket todavía ausentes, tal
  como corresponde a la activación pendiente. Ninguna migración fue aplicada.

El motor local se instaló sólo en `tmp/organization-settings-sql`, con scripts
de instalación desactivados, sin cambiar package.json/lockfiles del producto.
Para repetir: `npm install --prefix tmp/organization-settings-sql --no-save --ignore-scripts @electric-sql/pglite`.
La fixture visual usa `npx vite --config test/manual/organization-settings/vite.config.mts`.

## Revisión adversarial y límites

Se intentó refutar la autorización con actores/scope incorrectos, claves fuera
de contrato, imágenes falsas/grandes, pérdida de permiso antes de la subida y
cambio de selección tras ella; se corrigieron el cruce de ids SOFIA/Lia, la
evaluación de políticas sin SELECT para anon y la posibilidad de guardar
mientras se revisa una imagen. No se declara revisión independiente ni archivo
OpenSpec: la activación está pendiente.

Un guardado ya enviado puede completarse después de cerrar/cambiar selección;
su confirmación no actualiza otra sesión. Las cargas no vinculadas tras un
fallo quedan para conciliación: no se borran ante un timeout incierto. Los
colores se guardan como identidad organizacional y no cambian el tema personal.
Los cambios concurrentes de administradores conservan la semántica normal de
último guardado; no hay versionado optimista. La caché existente de identidad
para documentos puede tardar hasta cinco minutos en renovarse.

No se certifica persistencia, CDN o permisos de usuarios reales hasta aplicar
la migración y verificar la instancia. La pantalla muestra error accionable y
no inicia cargas cuando falta la RPC.

## Fuentes de API consultadas

Se revisaron [actualizaciones de Supabase](https://supabase.com/changelog.md),
[upload](https://supabase.com/docs/reference/javascript/storage-from-upload) y
[control de Storage](https://supabase.com/docs/guides/storage/security/access-control)
para el uso de archivos sin upsert y las políticas de acceso. Los contratos del
producto se basan en el esquema y políticas inspeccionados, no en supuestos.
