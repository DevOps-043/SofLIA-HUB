# Corrección del selector de SofLIA Max

Fecha: 2026-10-03. Estado: completado y verificado.

## Diagnóstico y alcance

La migración a `gpt-6.1-sol` ya existía como cambios locales al comenzar la tarea.
Se conservaron esos cambios. En la sesión Electron abierta se reprodujo que
Pro se seleccionaba, pero elegir Max cerraba el menú y mostraba SofLIA.
La sesión quedó consistente después de actualizar y recargar los módulos.
La mezcla de módulos anteriores durante la actualización es una inferencia;
no se capturó un trace del manejador anterior.

La incompatibilidad de preferencias está confirmada por código y pruebas:
`readStoredModel` descartaba `gpt-5.6-terra` y `handleModelChange` rechazaba ese
identificador. Dos regresiones fallaron antes del arreglo devolviendo
`gemini-3.8-flash` donde se esperaba `gpt-6.1-sol`.

## Implementación

- Max y Pro comparten constantes en `src/shared/soflia-runtime-model.ts` entre
  catálogo y configuración del ruteo.
- `useModelSelector` acepta el ID anterior de Max, persiste Sol en el ámbito
  activo y copia el razonamiento anterior sólo si Sol no tiene una preferencia.
- El efecto de sincronización reconcilia inmediatamente el estado conservado
  por React con las preferencias normalizadas.
- Se cubren remontaje, sincronización entre selectores, precedencia de Sol,
  IDs desconocidos, aislamiento entre usuarios y clic real en el menú compacto.
- Se corrigió la cifra preexistente del inventario documental, usando el conteo
  derivado por `validate-system-docs.mjs`, para desbloquear la compuerta.

## Evidencia

- Antes del arreglo: suite original focalizada, 47 pruebas exitosas; nuevas
  regresiones de migración, dos fallos confirmados.
- Después del arreglo inicial: siete archivos focalizados, 70 pruebas exitosas.
- Suite completa después de ampliar las regresiones: 321 archivos ejecutados,
  3473 pruebas exitosas.
- `npm run lint:changed`: 13 archivos revisados sin deuda nueva.
- `npm run docs:check`: 302 archivos Markdown activos con enlaces válidos.
- `npm run openspec:validate`: 28 cambios válidos.
- `npm run skills:seed:check`: semilla consistente con el registro.
- La primera compuerta verificó adaptadores, arnés y cadena de suministro; se
  detuvo por inventario documental preexistente desactualizado (485/338 en vez
  de 486/339). Se actualizaron esas cifras sin cambiar el baseline.
- El primer typecheck encontró `Object.hasOwn` incompatible con el lib ES2020
  del proyecto. Se sustituyó por `Object.prototype.hasOwnProperty.call`.
- Compuerta final `npm run verify:pr`: exit 0. Pasaron adaptadores, arnés,
  cadena de suministro, documentación de sistema y enlaces, semilla de Skills,
  OpenSpec, typecheck, lint incremental y las 3473 pruebas en 321 archivos.
- `git diff --check`: exit 0.
- QA nativo con `computer-use`: antes, Pro → Max regresaba a SofLIA; después,
  Pro → Max muestra Max y conserva su nivel Alto. El menú marca Max seleccionado.

## Revisión y límites

La revisión del diff comprobó que una preferencia nueva no sea reemplazada,
que la migración opere sólo en el ámbito activo y que la cuota siga usando
el prefijo existente. No se tocaron secretos, canales IPC ni permisos.
No se enviaron inferencias reales ni mensajes durante el QA, por lo que no se
consumió cuota y no se comprobó el acceso de la cuenta al modelo remoto.
El pipeline existente ya usa Responses API y niveles compatibles con Sol;
referencia: [documentación oficial del modelo](https://developers.openai.com/api/docs/models/gpt-6.1-sol).

El cambio es reversible mediante el diff de esta tarea. Las preferencias
migradas quedan guardadas como Sol; volver a una versión anterior requiere
adaptar esos IDs o elegir otro modelo en esa versión. Los cambios locales
anteriores del usuario se conservaron en `codex/fix-soflia-max-selector`.
