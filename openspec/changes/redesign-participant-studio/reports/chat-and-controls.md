# Chat, controles y actividades superpuestas

Fecha: 2026-10-24. Sustituye el límite anterior de selección exclusivamente local
para llamadas Video SDK. Meeting conserva los controles oficiales.

## Cambios y cobertura
Actividades llega al borde inferior y la barra flota encima. El padding final
de las áreas desplazables permite alcanzar botones inferiores. No se obtuvo
captura nueva: Work mantiene deshabilitado el navegador local.

Chat: envíos serializados, borradores que sobreviven a fallos y escritura durante
un envío, moderación comprobada también en submit, IME/Shift+Enter, lectura sin
saltos al escribir, estado real de suscripción y reintento de conexión completo.
Lecturas recuperadas limpian su error sin ocultar fallos de mutación. Un watch
antiguo pendiente no ejecuta unwatch contra la nueva sesión.

Dispositivos: listas reales acotadas y selección validada en el iframe aislado;
fuentes apagadas guardan preferencia sin capturar, activas usan switch del SDK.
El padre valida origen, ventana, nonce y esquema. No hay IPC, tablas ni secretos
nuevos. La selección local anterior deja de presentarse durante la llamada.

## Evidencia
- 8 archivos focalizados, 54 pruebas aprobadas: aula, chat, hook de suscripción,
  frontera frame, dispositivos, runtime Video, tutor y acceso Learning.
- `npm run test`: 504 archivos aprobados, 2 omitidos; 5731 pruebas aprobadas y
  5 omitidas. Sin proveedor IA ni reunión Zoom reales.
- `node test/manual/live-studio-runtime/smoke.mjs`: aprobado contra localhost:4321.
  HTTP/SSE entre instructor y alumno, publicación en ambos sentidos, deduplicación,
  modo lectura, restricción individual, acceso a sala propia y denegación ajena,
  entrega, quiz sin respuesta correcta expuesta, respuesta duplicada denegada y
  subida/publicación/lectura de material. Es dominio compartido local, no Supabase
  de producción. Se restauró moderación/quiz y se retiró material; los ejemplos
  de mensajes/entrega/respuestas se eliminan al reiniciar la fixture.
- `npm run zoom:build` y `node scripts/quality/smoke-zoom-runtime.mjs`: aprobados;
  tipos del SDK, assets y origen aislado confirmados. No acreditan reunión real.
- `npm run lint:changed`: 17 archivos sin incidencias nuevas.
- `npx tsc --noEmit -p tsconfig.node.json` y `git diff --check`: aprobados.
- `npm run verify:pr`: controles anteriores a typecheck aprobados; se detiene
  exclusivamente en TS2345 previo de `electron/gmail/raw-message.ts:19`, propiedad
  `newline` ausente de Options. Sin errores nuevos del aula. Suite y lint aparte.

## Revisión y límites
Revisión independiente detectó recuperación inicial sin suscripción. Reintentar
ahora recupera snapshot, watch y presencia; prueba de regresión aprobada. Segunda
revisión por lectura sin P1/P2 nuevos.

Pendientes: QA visual y reunión real con dos cuentas, dispositivos físicos y
captions habilitados. Salas siguen siendo académicas, sin correlación audiovisual;
el chat del grupo usa Learning, sin duplicarlo en un chat nativo Zoom. Mano y
reacciones son mensajes académicos confirmados. No hubo cambios de producción.

Reversión: revertir este commit de renderer y runtime juntos; mantiene contratos
académicos y datos existentes. Reiniciar la fixture devuelve sus ejemplos iniciales.
