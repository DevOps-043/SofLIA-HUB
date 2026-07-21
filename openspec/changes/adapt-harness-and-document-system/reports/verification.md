# Evidencia de verificacion

Estado: vigente.

Fecha: 2026-07-21.

Rama: `codex/harness-foundation`.

## Alcance verificado

- Adaptacion del arnes de desarrollo a Codex, Claude y Antigravity.
- Retiro de los adaptadores Cursor y Gemini CLI; el uso de Gemini como proveedor
  runtime del producto no fue modificado.
- Catalogo documental de producto, arquitectura, datos, UX/UI, seguridad,
  operaciones y calidad.
- Validadores de estructura, trazabilidad, inventario IPC, pruebas y paleta.

No se modifico codigo de ejecucion de `electron/` o `src/`, no se aplicaron
migraciones, no se desplego, no se publico y no se realizaron envios externos.

## Resultados reproducibles

| Comando | Resultado observado |
| --- | --- |
| `npm.cmd run adapters:check` | Aprobado: 24 adaptadores sincronizados. |
| `npm.cmd run harness:validate` | Aprobado: 22 rutas y 8 skills canonicas. |
| `npm.cmd run docs:system:check` | Aprobado: 26 documentos, 138 IDs, 271 canales IPC y 278 archivos de prueba. |
| `npm.cmd run docs:check` | Aprobado: 100 documentos Markdown activos en la verificacion final. |
| `npm.cmd run openspec:validate` | Aprobado: 3 cambios OpenSpec validos en modo estricto. |
| `npm.cmd run verify:pr` | Aprobado: adaptadores, arnes, documentacion, OpenSpec, tipos, lint y 962 pruebas en 104 archivos. |
| `npm.cmd run build:app` | Aprobado: renderer, main y preload construidos. |
| `git diff --check` | Aprobado; solo se observaron avisos de normalizacion LF/CRLF. |
| Busqueda de patrones de secretos en el arbol modificado | Sin llaves API, tokens ni claves privadas detectadas. |

Durante las pruebas se restauro la variante de `better-sqlite3` compatible con el
ABI de Electron. La compuerta termino con codigo cero.

## Revision adversarial

### Hallazgos corregidos en este cambio

1. El generador podia recrear adaptadores para herramientas que el equipo no
   usa. Ahora solo sincroniza `.codex`, `.claude` y `.agents`, y la validacion
   rechaza `.cursor`, `.gemini` y `GEMINI.md`.
2. La documentacion activa mezclaba una especificacion de diseno web ajena con
   el producto Electron. Se sustituyo por los tokens derivados de `src/index.css`.
3. Un PRD historico de reuniones contradice funciones ya implementadas y un
   reporte de base de datos atribuía aislamiento por propietario a politicas
   permisivas. Ambos quedaron archivados y marcados como no normativos.
4. El inventario previo describia estructuras, versiones y cantidades obsoletas.
   Los nuevos validadores derivan las rutas de evidencia, los canales IPC, las
   pruebas y los tokens de color desde el repositorio.

### Escenarios atacados

| Riesgo | Comprobacion | Resultado |
| --- | --- | --- |
| Reaparicion de Cursor/Gemini CLI | Validacion recursiva de rutas retiradas | Bloqueada por `harness:validate`. |
| Divergencia de skills | Comparacion canonica con los tres destinos | Bloqueada por `adapters:check`. |
| Documento sin evidencia o con pendientes | Estado, marcadores y rutas `evidence` | Bloqueado por `docs:system:check`. |
| Requisitos sin trazabilidad | Secuencias BR/RF/RNF/HU/DEC/LIM y matriz | Bloqueado por `docs:system:check`. |
| Inventario IPC o pruebas desactualizado | Conteo derivado del codigo y Git | Bloqueado por `docs:system:check`. |
| Paleta inventada | Comparacion de tokens con `src/index.css` | Bloqueada por `docs:system:check`. |
| Filtracion de secretos | Busqueda de formatos de llave/token/clave privada | No se detectaron secretos. |
| Cambio accidental del runtime | Revision de nombres y estado Git | No hay cambios bajo `electron/` o `src/`. |

## Riesgo residual documentado

- Las tablas de reuniones, SDO y `hub_service_state` tienen RLS activo pero
  politicas permisivas para `anon`; el aislamiento actual depende de filtros de
  aplicacion. Es la brecha de seguridad prioritaria y requiere una migracion
  separada, con plan de compatibilidad y rollback.
- Variables `VITE_*` usadas por el renderer forman parte del bundle cliente; no
  deben recibir secretos privilegiados. La migracion de credenciales sensibles a
  main/servidor sigue pendiente.
- Las herramientas dinamicas son extensiones locales confiables; falta una
  frontera fuerte de firma o sandbox para codigo no confiable.
- La deteccion de prompt injection esta deshabilitada por defecto en la
  configuracion observada y debe activarse mediante un cambio probado.
- No hay evidencia automatizada de respaldo/restauracion, SLO operativo ni
  auditoria WCAG completa; los documentos los registran como limites actuales.
- Vite advirtio imports mixtos dinamicos/estaticos en `sofia-auth`,
  `image-generation` y `chat/cache`, y un chunk renderer de aproximadamente
  2.06 MB. No impide el build, pero justifica una fase de rendimiento separada.

## Rollback

El cambio es reversible retirando `.agents`, restaurando los adaptadores
anteriores y revirtiendo los scripts/documentos de este commit. No existe estado
externo que restaurar porque no se ejecutaron migraciones, despliegues ni envios.

## Veredicto

APROBADO para commit local. La documentacion describe el estado observado y
separa explicitamente capacidades vigentes, limites y trabajo futuro. Los riesgos
residuales no bloquean este cambio documental, pero no deben interpretarse como
controles ya implementados.
