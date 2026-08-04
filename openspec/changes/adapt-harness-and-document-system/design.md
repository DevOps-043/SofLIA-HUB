## Context

El PDF `Resumen - Arnes.pdf` entregado por el usuario define cinco pilares:
instrucciones, herramientas, entorno local, estado y feedback/verificacion. El
repositorio LIDR Specboot aporta el ciclo de enriquecimiento, especificacion,
tareas atomicas, ejecucion aislada y auditoria. SofLIA ya tiene parte de esa base,
pero sus adaptadores no coinciden con las herramientas reales y su documentacion
de sistema esta fragmentada.

## Goals / Non-Goals

**Goals:**

- Hacer Antigravity un consumidor nativo del arnes sin duplicar logica.
- Retirar superficies que el equipo no usa.
- Convertir el repositorio en fuente consultable por rol y dominio.
- Vincular requisitos, historias, reglas, limites y decisiones con archivos
  implementados y pruebas.
- Fallar CI cuando desaparezca una seccion documental obligatoria o su evidencia.

**Non-Goals:**

- Reemplazar Gemini como proveedor de IA de la aplicacion.
- Prometer cobertura de datos externos no versionados o secretos de produccion.
- Copiar el codigo completo a Markdown o congelar cifras derivables.
- Corregir en esta fase toda inconsistencia funcional descubierta.

## Decisions

### `ai-specs/` canonico y `.agents/` como adaptador

El sincronizador genera wrappers de skills para `.codex`, `.claude` y `.agents`.
La regla y los workflows Antigravity son deliberadamente delgados y apuntan a
`AGENTS.md`, OpenSpec y las skills canonicas. Se descarta copiar skills completas
porque crearia tres fuentes divergentes.

### Retiro completo de Cursor y Gemini CLI

Se eliminan directorios y router raiz y el validador los prohibe. El termino
Gemini permanece donde describe modelos/API del producto; renombrarlo seria una
migracion funcional distinta.

### Documentacion por audiencia con trazabilidad explicita

`docs/product`, `docs/ux`, `docs/architecture`, `docs/data`, `docs/security`,
`docs/operations` y `docs/quality` separan responsabilidades. Cada documento
declara estado y evidencia. Los requisitos y reglas usan identificadores estables
para formar una matriz de trazabilidad.

### Hechos, inferencias y decisiones pendientes

Una razon se marca como `confirmada` solo si existe comentario, ADR, requisito o
configuracion que la explicite. Cuando solo puede deducirse del codigo se marca
`inferida`. Si no hay evidencia suficiente se registra `no documentada`; no se
inventa una narrativa retrospectiva.

### Cobertura documental ejecutable

Un validador comprueba presencia de documentos, identificadores unicos, ausencia
de marcadores pendientes y existencia de rutas declaradas como evidencia. No
intenta validar semantica con expresiones regulares; esa parte queda en revision
humana/adversarial.

### Prompt maestro como estandar, no como copia por herramienta

Las 17 areas del antiguo `docs/prompt_maestro.md` se conservan en
`docs/standards/engineering-practices.md`, adaptadas a Electron, React,
Supabase, SQLite, IPC y las compuertas reales. `docs/prompt_maestro.md` queda
como alias corto y estable para quienes lo invocan con `@prompt_maestro`; el
router `AGENTS.md` y la regla Antigravity cargan directamente la fuente
canonica. Esto evita perder las buenas practicas sin crear copias divergentes.

## Risks / Trade-offs

- La documentacion puede envejecer: la compuerta y la regla de actualizarla en el
  mismo cambio reducen drift, pero no sustituyen ownership.
- El catalogo es amplio: indices por rol y documentos acotados evitan cargarlo
  completo en cada tarea.
- Algunos snapshots contienen objetos que el Hub no consume: el diccionario los
  separa entre `usados`, `contrato disponible` y `legacy/no verificado`.
- Antigravity puede cambiar convenciones: se usan las rutas oficiales actuales y
  se registra la fuente/fecha para futuras migraciones.

## Migration Plan

1. Sustituir targets de adaptadores y crear `.agents/`.
2. Retirar Cursor/Gemini CLI y hacer que el arnes rechace su reaparicion.
3. Construir catalogo y matriz desde codigo, SQL y configuracion versionados.
4. Agregar validador de documentacion a la compuerta de PR.
5. Ejecutar revision adversarial, compuerta completa y build de aplicacion.
6. Recuperar el prompt maestro, conectarlo al flujo normal y documentar el uso
   operativo del arnes.

Rollback: revertir el commit restaura adaptadores y retira el catalogo. No hay
estado remoto ni migraciones que revertir.

## Open Questions

- Confirmar en una decision de producto futura si Gemini seguira siendo el
  proveedor runtime o si se abrira una migracion independiente.
- Asignar propietarios humanos permanentes a cada dominio documental.
