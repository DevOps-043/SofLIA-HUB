# Migración de WhatsApp y presentaciones a GPT-6 Luna

Fecha: 2026-09-24. Rama: `codex/whatsapp-gpt6-luna`.

## Alcance

Coordinador WhatsApp, especialistas, extracción de datos de presentación,
propuesta y generación de deck usan `gpt-6-luna`. Transcripción de audio y
Computer Use mantienen Gemini; presentaciones del chat mantienen su selector.
El agente inicia sin clave Gemini, pero las herramientas auxiliares que aún
dependen de ella requieren su configuración.

El adaptador Responses mantiene el ejecutor existente y sus autorizaciones,
confirmaciones y filtros de grupo. Conserva call_id y razonamiento cifrado;
rechaza respuestas incompletas y herramientas fuera del catálogo. La clave
OpenAI se obtiene del Hub autenticado con timeout, sin cache entre usuarios.
Coordinador y especialistas capturan un cliente para el turno; los cambios de
sesión invalidan solicitudes, incluida la recepción del cuerpo HTTP.

## Evidencia

- `npm run verify:pr`: aprobado en la ejecución final; 3547 pruebas aprobadas y
  una omitida, 340 archivos aprobados y uno omitido. Duración: 103,31 segundos.
  Tipos, lint, documentación, OpenSpec, adaptadores y arnés aprobados.

- Pruebas focalizadas y revisión independiente: 80 pruebas en seis archivos,
  todas aprobadas. Incluyen conversación sin clave Gemini, aislamiento durante
  lectura de respuesta, cancelación, multimedia, call_id, aporte sin autoridad,
  errores y generación validada de decks.
- `npm run build:app`: aprobado, con advertencias existentes de chunks e imports.
- Una ejecución completa encontró un timeout de 15 segundos en la prueba del
  navegador que conserva 500 pestañas; las otras 3546 pruebas aprobaron. Sin
  modificar ese código, la repetición aislada aprobó en 5,6 segundos de prueba.
  La repetición final completa, sin build en paralelo, también aprobó.

## Revisión

Se corrigieron dos P1 detectados por revisión independiente: una guarda antigua
que aún exigía Gemini y un intervalo de lectura HTTP posterior a los headers
sin protección de sesión. Se añadieron regresiones; el revisor confirmó ambos
cierres y no encontró nuevos bloqueantes.

## Fuentes y límites

Se verificaron el [modelo GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna)
y el [contrato de funciones Responses](https://developers.openai.com/api/docs/guides/function-calling).
La ejecución del proveedor se simula en pruebas: no se hicieron inferencias de
pago ni envíos reales. No se comprobó acceso a Luna con la cuenta del usuario.
Se requiere configurar OpenAI en el Hub. La herramienta integrada de ejecución
de código de Gemini no se incorpora a Responses; permanecen las herramientas
locales existentes. No se habilitan herramientas hospedadas ni permisos nuevos.

## Reversión

Revertir el commit de esta migración restaura el proveedor anterior; no hay
migraciones de datos ni cambios en secretos o configuración local.
