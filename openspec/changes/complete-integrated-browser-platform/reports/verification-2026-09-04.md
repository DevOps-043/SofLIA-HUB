# Verificación parcial de la plataforma del navegador

Estado: implementación abierta; no es candidato a release.

Fecha: 2026-09-04. Rama: `codex/upgrade-integrated-browser`, base `f52c8d6`.
Trabajo aislado en `.worktrees/upgrade-integrated-browser`. El checkout original
con correcciones de organizaciones/WhatsApp se conservó sin modificar.
La [línea base inicial](../../../../reports/baseline.md) registró 82 pruebas
aprobadas y errores TypeScript en el tipado de eventos de WhatsApp.

## Resultado implementado en esta continuación

- Pestañas verticales, navegación/reordenamiento por teclado y editor de grupos
  con nombre/color. Se comparte el orden del servicio main.
- Marcadores editables y reordenables, carpetas anidadas en HTML, importación
  atómica y errores que no aparentan guardados exitosos.
- Historial SQLite: migración idempotente, filtros/paginación, retención
  confirmada de 30/90/180/365 días, precedencia administrada y reapertura
  selectiva de las últimas 25 pestañas cerradas. Los resultados de búsquedas
  antiguas no sustituyen una búsqueda posterior.
- Descargas simultáneas con nombres reservados, máximo 20 activas y 200
  registros, cancelación persistente ante eventos tardíos y limpieza de estado
  al cambiar de cuenta. No se borran los archivos ya descargados.
- Destinos de E/S capturados al iniciar operaciones en historial, marcadores,
  privacidad, política del agente, bóveda y permisos. La caché de permisos no
  concede decisiones de otra cuenta ni publica un guardado fallido.
- Guardas del agente y autofill ante cambio de pestaña, URL, revisión o cuenta.
  El driver descarta una captura si cambia el destino durante la espera y no
  envía Enter después de un cambio ocurrido al insertar texto.
- Corrección acotada del tipo de eventos de entrega de Baileys: ignora IDs
  nulos y conserva el estado numérico cero. No verifica cuentas de WhatsApp.

## Evidencia automatizada

Comando final focalizado:

```powershell
npm run test -- integrated-browser browser-history-clear-range browser-site-permissions BrowserTab BrowserPrivacyPanel IntegratedBrowserPanel password-generator whatsapp-delivery-events preload.test
```

Resultado: **42 archivos y 390 pruebas aprobadas**, 11,97 segundos.

| Compuerta | Resultado y alcance |
|---|---|
| `npm run typecheck` | Aprobada en el estado final de código |
| `npm run lint:changed` | 65 archivos revisados sin deuda nueva en el estado final de código |
| `npm run openspec:validate` | 26 cambios aprobados, modo estricto |
| `npm run verify:pr` | No aprobada: se detiene en `skills:seed:check` |
| Adaptadores / arnés / suministro | 27 adaptadores; 25 rutas y 9 skills; 11 versiones vetadas ausentes y 18 hooks revisados |
| Documentación | 28 documentos, 150 IDs, 404 canales y 411 archivos de prueba; enlaces válidos |
| `npm run runtime:stable` | Manifiesto Electron 43.4.0 aprobado; no verifica el binario instalado |
| `node --test scripts/quality/check-electron-stability.test.mjs` | Un archivo de pruebas aprobado |
| `npm run verify:release` | No ejecutada: no es un candidato a release |

`skills:seed:check` detecta divergencia entre
`database/lia/migrations/system-skills-catalog.sql` y
`src/shared/skills/registry.ts`. Esos dos archivos y el generador no tienen
diff respecto de HEAD. No se regeneró una migración ajena para ocultar el fallo.

La ejecución general `npm run test` de las 20:27 quedó sin terminar durante
693,93 segundos. Se detuvo únicamente su worker bloqueado, identificado por
PID y línea de comandos. El resultado parcial fue 242 archivos aprobados,
3 fallidos y 2 221 pruebas aprobadas; la interrupción causó además un error
de worker. No equivale a una suite general aprobada.

Fallos encontrados en esa ejecución:

1. Preload esperaba 60 canales del navegador frente a 99: prueba actualizada
   para el contrato cerrado; el contrato final tiene 102 canales (92 invokes
   y 10 eventos) y pasa en la suite focalizada.
2. `whatsapp-workflow-presentacion`: esperaba `index.html`, recibió `deck.json`.
3. `PresentationPlayerApp`: no encontró la gráfica accesible mientras aparecía
   «Preparando visualizacion…».

Los archivos de los dos últimos módulos no fueron modificados. No se ejecutó
un checkout limpio de comparación; se registran como fallos fuera del diff,
no como una demostración definitiva de que no exista interacción con el cambio.

## Prueba visual

Se usó la skill de navegador disponible durante la revisión y la página local
`test/manual/browser-workspace` con controles reales y puente en memoria.
Se verificaron creación/asignación de grupo, flechas para cambiar pestaña,
edición de marcador, etiquetas/carpetas y temas claro/oscuro.

La inspección detectó solapamiento de ocho pestañas de administración: se
cambió a dos filas de cuatro. El tema de la fixture se corrigió para aplicarlo
en `document.documentElement`, como en la aplicación. Página y servidor se
cerraron al terminar. No se usaron cuentas ni archivos personales.

No es un smoke de Electron. Retención y reapertura selectiva, añadidas después
de esa revisión visual, se comprobaron con pruebas renderer/main, no con esa
página. No se verificaron particiones, diálogos nativos ni empaquetado.

## Revisión adversarial y casos negativos

| Hipótesis intentada | Evidencia o corrección |
|---|---|
| Dos descargas reciben el mismo destino antes de crear el archivo | Reserva entre registros; prueba de nombres diferentes |
| Se pierde el control de una descarga viva por cuota o eventos tardíos | Límite activo y poda sólo de registros terminales; canceladas no resucitan |
| Una migración informa éxito aunque no pudo escribir | Importación de marcadores propaga E/S; la fuente legacy se conserva |
| Cambiar cuenta mueve una escritura a otro perfil | Pruebas de historial, marcadores, bóveda, privacidad y permisos con destinos alternados |
| Permitir una vez queda persistido o sirve para otra página | Consentimiento no persistido y guardas de destino antes/después de esperas |
| Autofill escribe el secreto en una página que acaba de cambiar | Prueba con resolución tardía de bóveda; ninguna inserción |
| Borrar historial deja recuperables visitas antiguas en JSONL | Se elimina el respaldo completo; advertencia explícita antes de confirmar |
| Cambiar retención no modifica datos reales | Pruebas de purga inmediata, envejecimiento posterior, reinicio y precedencia administrada |
| Una reapertura fallida consume la entrada | Se conserva hasta una navegación exitosa y se impide reapertura concurrente |
| Renderer remoto puede cambiar retención | Pruebas de emisor, payloads inválidos y cuatro capas IPC |

## Riesgos y siguiente trabajo

- Plan aún incompleto: perfiles efímeros, autenticación del SO/passkeys,
  importación de credenciales, navegación segura/fingerprinting, extensiones
  administradas, handoff/cancelación/auditoría del agente, sync remoto y
  proveedor de políticas empresariales.
- Privacidad, gobierno del agente, empresa y restauración siguen opt-in.
  No todos los flags son gates efectivos; la arquitectura enumera cuáles.
  No activar funciones incompletas para aparentar paridad con otros navegadores.
- La lista de rastreo es inicial y pequeña; no constituye protección completa.
  Falta aplicación empresarial de privacidad cuando el flag local está apagado
  y cobertura de actualizaciones en vivo/todos los ciclos del navegador.
- SQLite se usa aunque `advancedHistory=false`: ese flag no revierte la
  migración. El rollback de código debe conservar la base SQLite y no asumir
  que un JSONL antiguo contiene las visitas nuevas.
- Las dependencias locales compartidas aún contienen Electron **44.0.0-beta.3**;
  fijar 43.4.0 en manifiesto/lockfile no instala ni valida ese binario. Hace
  falta instalación aislada y smoke Windows antes de release.
- Quedan por verificar red real, impresión/PDF, descargas nativas, restauración
  tras cierre inesperado, ventanas separadas, perfil y rendimiento prolongado.
- La bóveda conserva cifrado del SO, pero todavía no reautentica con el SO al
  operar. Las capturas autorizadas pueden contener información visible.

No hubo despliegue, migración remota, envío de mensajes, PR ni integración en
el checkout original. El cambio OpenSpec permanece abierto.
