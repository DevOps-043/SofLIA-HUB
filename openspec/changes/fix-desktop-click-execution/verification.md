# Evidencia de la corrección de entrada

Fecha: 2026-10-12. Base: `91ad405`.

## Diagnóstico y alcance

La captura reportada muestra una finalización en dos pasos sin Bloc de notas
visible. No permite demostrar por sí sola que ningún evento físico ocurrió.
La revisión confirmó rutas que ocultaban fallos: carga con `require` sin
declararlo en ESM, `Super` sin traducción válida en fallback, errores no
terminantes de PowerShell y acciones desconocidas ignoradas. La escritura
dirigida también perdía sus coordenadas y el cliente descartaba llamadas
posteriores de una misma respuesta.

Se corrigieron esas rutas y se añadió corroboración del estado final desde una
captura nueva, con 400 ms de asentamiento entre acción y observación. La
captura del chat y las indicaciones del orbe no cuentan como evidencia. La
apertura de aplicaciones usa el resolver existente y conserva cancelación y
guardas de contexto antes de enfocar o lanzar. No hay nuevos canales IPC,
dependencias, datos remotos ni cambios de configuración local.

## Pruebas ejecutadas

- `npx vitest run electron/__tests__/gemini-cu-client.test.ts electron/__tests__/gemini-cu-loop.test.ts`:
  27 pruebas pasaron; incluye fallo al abrir seguido de escritura pendiente,
  captura final obsoleta y texto terminal después de un clic rechazado.
- Las pruebas dirigidas de ejecutor, mapeo y cancelación comprueban enfoque antes
  de escribir, teclas Windows, rechazo de acciones desconocidas y cancelación
  durante resolución de aplicaciones.
- `node test/manual/orb-guidance/build-input.mjs` y ejecución de Electron sobre
  `work/native-input/input.cjs`: salida 0. Ventana propia de QA, sin proveedor.
  Se comprobaron clic físico con `isTrusted=true` y contenido escrito con nut.js;
  también clic y texto con fallback PowerShell. Un script erróneo fue rechazado.
  Resultado: `success`, `physicalClick`, `trustedEvent`, `text`, `fallbackClick`,
  `fallbackText` y `silentErrorsRejected` verdaderos; backend `nut`.
- `npx vite build --config vite.config.mts`: renderer, main y preload compilan;
  permanecen avisos de tamaño de chunks e imports dinámicos del proyecto.
- `npm run lint:changed`: 23 archivos revisados sin deuda nueva.
- `npm run verify:pr`: salida 0; 410 suites y 4268 pruebas pasaron,
  una suite/prueba omitida. Incluye tipos, arnés, inventario, enlaces y
  validación estricta de 62 elementos OpenSpec.

## Revisión independiente

Tres hallazgos atendidos: cancelación antes de efectos de abrir/enfocar,
recaptura al finalizar con comprobación del estado final en vez de pasos
transitorios, y cancelación de las llamadas pendientes de un lote fallido.
El revisor confirmó las correcciones y no dejó bloqueos.

## Límite y prueba del usuario

La prueba física acredita la entrada nativa, y las pruebas de cliente usan un
SDK simulado. No se ejecutó una tarea completa contra el proveedor real. La
visión puede fallar, y una captura no confirma resultados que no sean visibles.
La comprobación añade una consulta al proveedor por cierre de tarea de escritorio.

Reiniciar el proceso de desarrollo con `Ctrl+C` y `npm run dev` desde el checkout
principal. Solicitar: «Usa Computer Use en el escritorio. Abre Bloc de notas,
crea una nota y escribe Prueba del orbe. No guardes el archivo». Comprobar que
el texto aparece en Bloc de notas; si no se confirma, el resultado debe comunicar
fallo en vez de declarar que se completó.

## Reversión

Revertir el commit de esta corrección restaura el comportamiento anterior;
no hay migraciones ni efectos externos que revertir.
