## Context

Los IDs de modelo están centralizados en `src/config.ts` (`MODELS`) y las
opciones visibles en `src/hooks/model-selector-options.ts`. `MODELS.PRIMARY`
(`gemini-3.5-flash`) es el default que resuelve `resolveModelId` en
`src/services/gemini-chat/model-config.ts`. `gemini-3.1-flash-lite` aparece como
`FALLBACK`, `LITE`, `TRANSCRIPTION` y `MAPS`.

## Goals / Non-Goals

**Goals:**

- Ofrecer `gemini-3.5-flash-lite` y `gemini-3.6-flash` como opciones.
- Mantener `gemini-3.5-flash` como default.
- No romper llamadas a Gemini por un ID incorrecto.

**Non-Goals:**

- Cambiar el default ni la lógica de fallback.
- Tocar modelos de dominios no pedidos (imagen, deep research, live) salvo el ID
  lite verificado.

## Decisions

### Reemplazo de la opción Lite y adición de 3.6-flash

La opción "SofLIA Lite" pasa de `gemini-3.1-flash-lite` a `gemini-3.5-flash-lite`.
Se agrega una opción para `gemini-3.6-flash` (marca visible propia) seleccionable
pero no default. `MODELS.PRIMARY` no cambia.

Alternativa descartada: poner `gemini-3.6-flash` como default. El usuario pidió
mantener `gemini-3.5-flash` por ser el 3.6 muy reciente y con posibles errores.

### Referencias a 3.1-flash-lite verificadas una a una

Cada uso de `gemini-3.1-flash-lite` (`FALLBACK`, `LITE`, `TRANSCRIPTION`, `MAPS`)
se revisa antes de migrar a `gemini-3.5-flash-lite`; se cambia solo donde el
propósito es "el modelo lite vigente".

## Risks / Trade-offs

- [ID de modelo inexistente] → Centralizar en `MODELS`, verificar con typecheck y
  pruebas del selector y del servicio de chat; el default estable limita el
  impacto.
- [Cambiar un uso lite que no debía] → Revisión por referencia, no reemplazo
  global ciego.

## Migration Plan

1. Agregar los IDs nuevos en `MODELS` y las opciones del selector.
2. Migrar referencias `3.1-flash-lite` verificadas.
3. Typecheck, pruebas dirigidas del selector/chat, `verify:pr`.

Rollback: revertir el cambio de catálogo; el default no se tocó, así que no hay
estado que restaurar.

## Open Questions

Ninguna: los IDs y la colocación quedaron confirmados con el usuario.
