## Why

Salieron dos modelos Gemini más rápidos y capaces: `gemini-3.5-flash-lite` y
`gemini-3.6-flash`. El catálogo actual (`src/hooks/model-selector-options.ts`)
ofrece `gemini-3.5-flash`, `gemini-2.5-pro` y `gemini-3.1-flash-lite`, y el
default (`src/config.ts` `MODELS.PRIMARY`) es `gemini-3.5-flash`. Conviene ofrecer
los nuevos modelos sin cambiar el default: `gemini-3.6-flash` es muy reciente y
podría tener errores, por lo que se mantiene `gemini-3.5-flash` como
predeterminado y `gemini-3.6-flash` queda seleccionable pero no por defecto.

## What Changes

- Agregar `gemini-3.5-flash-lite` al catálogo, reemplazando la opción Lite basada
  en `gemini-3.1-flash-lite`.
- Agregar `gemini-3.6-flash` como opción seleccionable, no como default.
- Mantener `gemini-3.5-flash` como modelo por defecto (`MODELS.PRIMARY` sin
  cambios).
- Actualizar las referencias internas que apuntaban a `gemini-3.1-flash-lite`
  como fallback/lite hacia `gemini-3.5-flash-lite`, verificando cada uso.
- Actualizar `docs/architecture/runtime-parameters.md` si documenta modelos.

No objetivos: cambiar el modelo por defecto; alterar el modelo de computer-use,
Live API, imagen, transcripción o deep research salvo que su ID lite cambie de
forma verificable; introducir lógica de fallback nueva; renombrar la marca visible
de los modelos sin necesidad.

## Capabilities

### New Capabilities

- `gemini-model-catalog`: Catálogo de modelos seleccionables del producto con un
  modelo por defecto estable y opciones nuevas que no alteran el comportamiento
  predeterminado.

### Modified Capabilities

Ninguna especificación base publicada de catálogo de modelos.

## Impact

Afecta `src/hooks/model-selector-options.ts`, `src/config.ts` (`MODELS`) y las
referencias verificadas a `gemini-3.1-flash-lite`. No agrega IPC, tablas ni
secretos. Riesgo bajo: un ID de modelo incorrecto rompería las llamadas a Gemini;
se mitiga centralizando los IDs y verificando cada referencia con typecheck y
pruebas dirigidas del selector y del servicio de chat. El default no cambia, así
que el comportamiento predeterminado se preserva.
