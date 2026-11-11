# Revisión y consolidación local

Fecha: 2026-10-26. Solicitud: revisar y guardar todos los cambios en una rama.

## Alcance y preservación

La rama de entrega es `codex/consolidacion-cambios-20261026`, desde `f007d95`.
Reúne los cambios locales de creación de proyectos, acceso directo a IRIS,
almacenamiento local/Google Drive/OneDrive, recursos y chats de proyectos,
tablero y editor de tareas, chat flotante, recuperación de sesión y tipos Gmail.
Incluye sus pruebas, recursos de marca, migraciones, especificaciones y evidencia.

Las otras ramas locales ya eran ancestros de la base, salvo
`codex/compact-studio-scenes`. Sus cambios de código eran equivalentes a los de
la base con hashes distintos. Se incorpora también su historial como segundo
padre del commit de consolidación, conservando el inventario actual de pruebas.
No se eliminan ramas ni worktrees.
Se comprobaron también las 77 referencias remotas ya conocidas por Git: todas
están contenidas en los padres de la integración, sin consultar ni cambiar remotos.

El worktree `fix-login-loading` contiene 74 archivos idénticos y versiones
anteriores de la creación y almacenamiento de proyectos. Los componentes
anteriores `ProjectStorageFiles` y `ProjectResources` fueron sustituidos por la
colección de archivos y su hook de almacenamiento. Se conservan las versiones
actuales y el otro worktree permanece intacto.

Antes de integrar se guardó un stash temporal. Tras aplicarlo se verificó que
los archivos previamente versionados no diferían del respaldo y que los 148
archivos nuevos recuperados coincidían por hash Git. El único conflicto fue el
inventario documental; se recuperó su versión actual del respaldo.

## Hallazgos corregidos

El selector de destino de Guardar página permitía reenviar una escritura después
de una respuesta incierta, una solicitud de revisión o un error de transporte.
Esto podía duplicar un marcador. `SavePageDialog` ahora conserva la incertidumbre,
bloquea nuevos envíos y pide revisar el proyecto. No presenta un éxito ficticio.
El escenario queda especificado en `project-resources/spec.md`.

La prueba de regresión reprodujo los tres fallos antes del arreglo. Después,
`npx vitest run src/__tests__/components/ProjectResources.test.tsx` aprobó los
17 casos del archivo, incluidos esos tres escenarios negativos.

El transporte personalizado de IRIS rechazaba también la ruta de firma que usa
el backend para descargar archivos históricos. Una prueba con el SDK Supabase
real y transporte simulado reprodujo `Destino de datos IRIS inválido`. Ahora se
permite exclusivamente `/storage/v1/object/sign/project-files/` en el origen
configurado, con la autorización IRIS existente, sin cabeceras de Learning ni
redirecciones. Los otros buckets, accesos a objetos y Auth siguen bloqueados.
Esto conserva la solicitud de firma; el servidor todavía debe autorizarla.

Tras ambas correcciones, el grupo de cuatro archivos de recursos, sesión IRIS,
backend directo y descargas históricas aprobó 102 casos, cero fallos.

## Verificación

- Primera ejecución de `npm run verify:pr`: código 0; 525 archivos aprobados,
  dos omitidos; 5.969 casos aprobados y cinco omitidos. Incluye tipos, lint
  incremental, arnés, supply chain, documentación, catálogo de skills,
  OpenSpec y pruebas de calidad.
- Segunda compuerta, después del arreglo del selector y de la integración:
  525 archivos aprobados y dos omitidos; 5.972 casos aprobados y cinco omitidos.
- Compuerta final posterior a ambas correcciones: `npm run verify:pr`, código 0;
  525 archivos aprobados y dos omitidos; 5.975 casos aprobados y cinco omitidos,
  cero fallos. Lint incremental: 137 archivos revisados sin deuda nueva.
- `git diff --cached --check`: correcto tras retirar una línea vacía al final
  de `direct-tasks.ts`. La entrega reúne 226 archivos, incluidos código,
  documentación, especificaciones y evidencia previa.
- Revisión de patrones de claves privadas y credenciales de proveedores en los
  archivos de la entrega: sin coincidencias; no incluye `.env`, claves privadas
  ni dependencias instaladas. Esta comprobación no sustituye una auditoría externa.

## Revisión y límites

Se revisaron el contrato servicio/handler/allowlist/preload/wrapper, validación
de payloads, aislamiento por actor y organización, cambios A/B/A, destinos de
tokens, roles verificados frente a espejos, selección opaca de archivos,
confirmaciones de escritura y recuperación ante efectos parciales. Las rutas
probadas conservan rechazo y error seguro; ambos hallazgos se corrigieron y sus
pruebas de regresión pasan en la compuerta final.

Esta consolidación no ejecuta migraciones remotas, no prueba cuentas reales de
Google/Microsoft y no acredita el smoke pendiente de Guardar página con la sesión
del usuario iniciada. Los reportes anteriores de bases conservan su fecha y
alcance; sus comprobaciones remotas no se presentan como repetidas en esta sesión.
No se empaqueta una release ni se publica la rama.

Reversión: revertir el commit de consolidación tomando el primer padre conserva
la base anterior. No borrar proyectos, carpetas ni datos remotos como compensación;
las migraciones tienen su procedimiento propio y requieren autorización explícita.
