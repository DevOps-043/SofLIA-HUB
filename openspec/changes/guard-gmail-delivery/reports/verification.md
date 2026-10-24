# Evidencia de envío Gmail íntegro

Estado: evidencia histórica de verificación local. Fecha: 2026-10-22.

## Cambio y contratos

La entrega valida un DTO compartido, prepara todos los adjuntos antes de pedir
confirmación y transmite la misma copia. Se rechazan tipos, destinatarios ambiguos,
controles, archivos ausentes/ilegibles/no regulares, enlaces finales y cuotas.
Las rutas canónicas y metadata estable vinculan la lectura al archivo abierto;
los handles se cierran también al vencer la sesión. El compositor MIME recibe
buffers y tiene bloqueado abrir archivos/URLs por sí mismo.

`gmail:send` mantiene allowlist y parámetros, con sesión, ventana/marco/documento
propios, conexión del actor y confirmación nativa. La guarda IPC se comparte con
calendario conservando sus exports y comportamiento. Cancelación o caducidad no
envían; cambios de contexto anteriores al transporte tampoco. Si el transporte ya
pudo iniciar, el resultado incierto exige revisar Enviados antes de repetir.
No se promete rollback de correo aceptado ni idempotencia ausente del proveedor.

El adaptador del chat reutiliza el mismo schema y deja de truncar/filtrar adjuntos
o convertir tipos erróneos. Este segundo defecto se descubrió durante la
autorrevisión; se añadieron siete regresiones y se repiten gate/build después
de corregirlo. Los DTO de main/preload/wrapper conservan cancelled/uncertain.

## Dependencia y consumidores reales

[Comparación de auditoría/lock](dependency-comparison.json): Nodemailer 9.0.4 →
10.2.1, retirando sus ocho avisos sin nuevos paquetes afectados. Auditoría global
28 → 27 paquetes afectados (high 9 → 8); producción 17 → 16 (high 5 → 4).
Producción antes se consultó sobre una copia temporal del lock previo al cambio,
sin instalar ni copiar configuración local. Estas cifras no son porcentaje de
código vulnerable ni una medición del índice global de deuda.

La metadata del registro se revisó antes de instalar con ignore-scripts: sin
dependencias runtime nuevas ni ganchos preinstall/install/postinstall. Sólo
cambian tres registros del lock respecto al inicio de esta unidad: raíz,
Nodemailer y retirada de @types/nodemailer sustituido por tipos propios. Se
verificó la versión física instalada, exports CJS/ESM, composición MIME real,
servidor SMTP de loopback con verify, autenticación ficticia y envío/BCC, y
[CJS/MIME en Node 24.21 de Electron 44.5.1](electron-node-compatibility.json).

Fuentes de compatibilidad: [cambios oficiales](https://github.com/nodemailer/nodemailer/blob/master/CHANGELOG.md),
[MailComposer](https://nodemailer.com/extras/mailcomposer) y
[adjuntos](https://nodemailer.com/message/attachments). No se reutiliza el
compositor de la versión afectada ni se incorporan paquetes directos nuevos.

## Pruebas ejecutadas

Logs locales: `%TEMP%/soflia-gmail-delivery-2026-10-22`.

| Comando/fase | Evidencia |
|---|---|
| Baseline Gmail/calendario/SMTP | 48 pruebas, 4 archivos, exit 0; `baseline-tests.log` |
| Gmail/calendario/preload/SMTP/wrapper, incluidas sesiones reales de SDK con fetch simulado | 172 pruebas, 10 archivos, exit 0; `focused-tests.log` |
| Contratos finales de entrega/IPC/SMTP tras revisión de rutas | 54 pruebas, 3 archivos, exit 0; `critical-final.log` |
| Chat + wrapper + entrega + IPC después de retirar truncación | 65 pruebas, 4 archivos, exit 0; `chat-delivery-final.log` |
| Typecheck previo a revisión final de chat | exit 0; `typecheck-final.log` |
| Lint incremental previo a revisión final de chat | 68 archivos sin deuda nueva, exit 0; `lint-final.log` |
| Inventario documental | 612 archivos de pruebas, 494 canales, 28 documentos, 150 IDs |

Una compuerta intermedia aprobó 4602 pruebas y 5 omitidas (212,94 s); se conserva
en `verify-pr-intermediate.log`. No acredita el cambio posterior del chat. La
compuerta final se registra al terminar en el estado completo.

## Autorrevisión adversarial

- Intentos de ocultar un segundo destinatario, controles, campos extra o tipos
  incorrectos se rechazan antes de abrir adjuntos o adquirir cliente.
- Archivo ausente después de otro preparado, EACCES, directorio, enlace final,
  archivo >10 MiB y total >20 MiB impiden transporte; sin omitir adjuntos.
- Crecimiento durante lectura se detecta. Una guarda vencida tras abrir cierra
  el handle. Mutación posterior a la aprobación no cambia los bytes enviados.
- Prueba con compositor real: Unicode, nombre con comillas donde el SO lo
  permite, base64 y líneas MIME; BCC viaja a Gmail. El SMTP local real conserva
  ambos destinatarios en el sobre y elimina la cabecera BCC del mensaje final.
- Emisor/origen/frame/ventana/sesión/dueño ajenos bloqueados; A/B/A, navegación,
  reconexión y frame cambiado invalidan aceptación. Diálogo vencido no permite
  otro mientras el anterior siga abierto y su respuesta tardía no envía.
- Fallo remoto, ID ausente y logout tras iniciar transporte son inciertos, con
  una sola llamada. Errores crudos y datos privados no salen del servicio.
- Se detectó y retiró slice(0,10) del chat: el límite deja de producir éxito con
  una lista distinta. No se relajaron reglas de lint ni timeouts.

## Límites y reversión

No se enviaron mensajes, credenciales o archivos reales. Google se simula en
las pruebas; SMTP escucha sólo en loopback con credenciales ficticias. El diálogo Electron
se verifica por contrato con mock; no se acredita inspección humana nativa de
mensajes extensos ni toda la aplicación instalada. Build aislado no equivale a
empaquetado o arranque. No hay evidencia nueva de Linux/macOS nativos.

Rutas canónicas/metadata y copia única reducen TOCTOU; no se promete detectar una
mutación maliciosa que conserve toda la metadata. Los otros canales Gmail y la
custodia SMTP existente quedan fuera de este endurecimiento. IRIS sigue pendiente
de contratos reales de identidad/permisos para su transacción; no se preparó ni
ejecutó SQL especulativo.

Revertir esta unidad conserva los bloques anteriores y no requiere migración.
Volver a la dependencia anterior recuperaría avisos conocidos y sólo procede
como reversión operativa excepcional. Revisión independiente pendiente antes de
archivar; sin commit, publicación o cambios remotos de negocio en esta unidad.

## Verificación final

`npm run verify:pr` terminó con exit 0 sobre el estado final:

- 4609 pruebas aprobadas, 5 omitidas, ninguna fallida; 444 archivos aprobados y
  2 omitidos. Duración Vitest: 209,30 s. Son 64 casos adicionales respecto al
  bloque anterior. Log: `verify-pr-final.log`.
- Cuatro pruebas de tooling, tipos, 70 archivos de lint incremental sin deuda
  nueva, adaptadores, arnés, supply chain, catálogo de skills, documentación y
  75 elementos OpenSpec aprobados en modo estricto.
- `npm run app:smoke:build` repetido tras el ajuste de chat: exit 0, 3275 fuentes,
  sin .env, seis artefactos presentes. [Resumen](build-summary.json) y
  [tamaños/SHA256](build-artifacts.json); log `app-build-final.log`. Sólo se
  modificó después el test SMTP para probar autenticación ficticia; el gate
  final incluye ese test y los tipos de todo el árbol.
- SMTP/chat finales: 12 casos aprobados (`smtp-chat-final.log`). El servidor de
  prueba verifica dos autenticaciones PLAIN ficticias (verify y send), sin TLS
  por ser loopback; no acredita TLS o credenciales de producción.

No hubo cambios de código después de esta compuerta; la actualización posterior
se limita a tareas/evidencia y precisión de la especificación sobre una sola
invocación desde el servicio. No se promete entrega remota exactamente una vez.
