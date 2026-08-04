## Why

El arnes fundacional genero adaptadores para Cursor y Gemini aunque el equipo usa
Antigravity. Ademas, la documentacion vigente cubre modulos aislados pero no ofrece
un catalogo trazable de producto, reglas de negocio, requisitos, historias,
frontend, backend, datos, operaciones, UX/UI, limites y decisiones. Esa brecha
obliga a cada agente a reconstruir el sistema desde el codigo y facilita
contradicciones.

## What Changes

- Retirar del arnes los adaptadores Cursor y Gemini CLI y agregar la estructura
  oficial de workspace de Antigravity: `.agents/skills`, `.agents/rules` y
  `.agents/workflows`.
- Mantener `ai-specs/` como unica fuente de skills propias y comprobar el drift de
  sus adaptadores Codex, Claude y Antigravity.
- Distinguir el proveedor Gemini usado por el producto de la herramienta de
  desarrollo Gemini CLI que deja de estar soportada.
- Crear un catalogo documental especifico, en espanol y enlazado al codigo para
  producto, requisitos, reglas, historias, UX/UI, arquitectura, datos, seguridad,
  DevOps, pruebas, operacion, configuracion, parametros y decisiones.
- Agregar una compuerta automatizada de cobertura documental y trazabilidad.
- Registrar las fuentes del modelo Arnes, Specboot y Antigravity y actualizar el
  plan de adopcion con el estado realmente implementado.
- Recuperar las 17 areas de buenas practicas del antiguo `prompt_maestro`,
  adaptarlas al stack y contratos reales de SofLIA, y mantener un alias estable
  para su invocacion explicita desde Antigravity.

No objetivos: cambiar modelos o APIs de IA del producto, ejecutar SQL remoto,
desplegar, publicar o documentar como existente una capacidad solo planeada.

## Capabilities

### New Capabilities

- `antigravity-harness-adapter`: reglas, skills y workflows Antigravity derivados
  de la fuente canonica, sin adaptadores Cursor/Gemini CLI.
- `system-documentation-catalog`: documentacion integral, trazable y validable del
  comportamiento y arquitectura implementados de Pulse Hub.

### Modified Capabilities

Ninguna especificacion base: los cambios fundacionales aun no se han archivado.

## Impact

Afecta archivos de agentes, scripts del arnes, CI de PR, indices, estandares y
documentacion.
El cambio no altera ejecutables del producto, IPC, datos, permisos runtime,
variables de entorno ni artefactos de release.
