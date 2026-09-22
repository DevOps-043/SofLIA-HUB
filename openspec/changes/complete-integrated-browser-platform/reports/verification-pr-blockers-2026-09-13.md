# Cierre de bloqueos de validación — 2026-09-13

## Alcance

Continuación del navegador en `codex/finish-browser-recovery`, worktree
`.worktrees/upgrade-integrated-browser`, base `5bbf244`. Se preservan los cambios
anteriores de recuperación. No se hizo commit, despliegue, migración remota,
modificación de `.env`, envío real de WhatsApp ni instalación del producto.

## Correcciones implementadas

1. **Typecheck:** retirada de `MessageUpdateEntry`, declaración privada sin
   consumidores de `electron/whatsapp/delivery-events.ts`. Se conserva el tipo
   inferido del evento del protocolo y el comportamiento de entregas.
2. **Semilla de Skills:** el diagnóstico aislado encontró 72 CRLF: 8718 caracteres
   frente a 8646 generados. Al normalizar CRLF a LF el contenido era idéntico.
   `system-skills-seed.mjs` ahora compara sólo esa normalización; no ignora
   espacios, instrucciones, herramientas ni CR aislados. Su importación no
   ejecuta la CLI; las divergencias reales siguen terminando con código 1.
   No se regeneró ni modificó `system-skills-catalog.sql` o `registry.ts`.
3. **Presentaciones de WhatsApp:** la suite general destapó una incompatibilidad
   real: el generador pedía HTML y lo guardaba bajo el nuevo `deck.json`.
   Ahora solicita JSON v1, aplica cuota de workspace y el esquema compartido,
   serializa el resultado validado y sólo entonces escribe/exporta el HTML.
   Admite JSON directo o una valla JSON completa; rechaza HTML legado, versiones
   futuras, estructura inválida, texto externo y tamaño excesivo sin escribir
   el deck, exportar ni enviar archivo. Puede quedar el workspace y su marca
   preparados antes del rechazo; no se declara rollback de esos preparativos.
4. **Pruebas alineadas:** fixtures de WhatsApp usan un deck validado y metadata
   `deck.json`, no HTML aceptado por un mock. La prueba de accesibilidad precarga
   el módulo real de gráficas antes de medir el DOM: no sustituye Recharts ni
   amplía el timeout para ocultar fallos. Se restauran timers al limpiar.

La skill HyperFrames/React orientó la corrección al contrato declarativo vigente,
no a volver a aceptar HTML arbitrario en workspaces nuevos. La documentación
canónica del agente runtime y del verificador de semilla refleja estos límites.

## Evidencia incremental

- **Compuerta final aprobada:** `npm run verify:pr` con
  `VITEST_MAX_WORKERS=4` sólo en el proceso de verificación. Suite completa:
  **3312 pruebas en 313 archivos, todas aprobadas**, inicio 20:11:22 del
  2026-09-13, duración 118,49 s. Sin exclusiones nuevas, retries añadidos ni
  aumento de los plazos de las aserciones.
- La misma compuerta aprobó adapters (27), harness (25 rutas/9 skills),
  supply-chain (11 versiones vetadas/18 hooks), documentación (28 documentos,
  150 IDs, 427 IPC, 478 archivos de prueba), semilla, las 27 validaciones OpenSpec,
  typecheck y lint incremental (19 archivos TypeScript). El inventario cuenta
  también archivos auxiliares de pruebas; no equivale a 478 suites ejecutadas.
- `npm run docs:check` posterior al reporte: 292 Markdown con enlaces válidos.
  OpenSpec estricto y `git diff --check` aprobados; sólo avisos Git LF/CRLF.
- `npm run test -- system-skills-seed whatsapp-delivery-events whatsapp-workflow-presentacion PresentationPlayerApp system-skills-catalog --maxWorkers=4 --reporter=dot --silent=passed-only`:
  **68 pruebas aprobadas en cinco archivos**, ejecución 00:06:01, 3,19 s.
- ESLint explícito de `scripts/quality/system-skills-seed.mjs`: aprobado. El
  lint incremental sólo examina TypeScript; por eso se comprobó también el MJS.
- Primera suite completa: 3304 aprobadas y dos fallidas (3306 casos en 313
  archivos). El test WA-160 expuso el contrato HTML/deck descrito; el test de
  gráfica agotó su espera con el fallback de carga visible y pasó aislado.
  Las ejecuciones fallidas no se presentan como aprobadas.
- Una repetición perdió su sesión de ejecución durante la interrupción del
  trabajo. No se atribuye resultado; se volvió a ejecutar la compuerta completa.

## Revisión adversarial y límites

La revisión local del agente principal comprobó que normalizar finales de línea
no relaja permisos SQL ni modifica datos, y que errores reales de contenido
siguen rechazados (11 pruebas positivas/negativas del comparador). Se añadió
rechazo de cinco clases de salida del modelo y aceptación de JSON vallado válido.
No se expone una nueva herramienta, canal IPC o permiso de agente. Los secretos
y el transporte real no se probaron ni utilizaron. No se acredita calidad visual
de presentaciones generadas por un modelo real: se probaron contratos y flujos
con fixtures, no una presentación producida para un cliente.

El rollback de estas correcciones es de código; no requiere migración down ni
reparar datos remotos. Revertir el generador reinstauraría la incompatibilidad
HTML/deck y no es una ruta recomendada de recuperación.

La tarea **9.5** sigue pendiente: recorrido manual del producto/instalador,
autenticación humana del SO y pruebas Lia Auth/RLS/revocación en dos equipos
reales. El usuario se encarga del despliegue y las migraciones. La compuerta
de PR, aunque pase, no sustituye la compuerta de release ni estas pruebas.

Estado final: **63/64 tareas completas**, 9.5 abierta. Los bloqueos generales
registrados en el reporte SQLite/sync del 2026-09-12 quedan superados. No se
ejecutó `verify:release`, empaquetado ni validación humana y no se archivó el cambio.
