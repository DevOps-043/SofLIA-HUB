# Revisión e importación de marcadores HTML

Estado: implementación parcial de 4.6; no es cierre del cambio ni release.
Fecha: 2026-09-05. Rama: `codex/upgrade-integrated-browser`.
Continúa la [barrera de guardado e instalación](verification-shutdown-2026-09-05.md).
Se conserva el trabajo de organizaciones/WhatsApp en el checkout original.

## Resultado y contrato

- La selección de un archivo ya no escribe marcadores. Main lee HTML/HTM con
  límite de 5 MiB sobre el mismo descriptor, incluso si el archivo crece.
  El parser admite exportaciones de marcadores HTML, hasta 5.000 entradas y
  20 niveles de carpetas; no es un parser DOM general ni ejecuta contenido.
- La revisión muestra sólo conteos de nuevos, duplicados, conflictos e inválidos,
  sin títulos, URLs, contenido ni rutas. Cancelar es el valor predeterminado.
  El usuario puede importar sólo nuevos o actualizar conflictos e importar.
- Un conflicto actualiza título, carpeta y etiquetas, conservando identidad,
  URL, fecha de creación y posición. La primera entrada válida por URL prevalece;
  entradas inválidas y repeticiones se omiten y aparecen en el resumen final.
- La revisión vive únicamente en main, vence en cinco minutos y sirve una sola
  vez. Una huella de la biblioteca detecta cambios entre revisión y aplicación.
  Perfil, generación de sesión, ventana y transición se validan después de
  esperas y antes de emitir el reemplazo. Sólo hay una importación pendiente.
- El canal existente no acepta argumentos y exige sesión, emisor autorizado y
  frame principal de la ventana main. No se agregan canales de lectura o commit.
  Preload conserva el recorrido permitido; DTO, wrapper y UI añaden los conteos
  sin confundir cancelación o error con éxito.
- Los errores inesperados de selección, diálogo o escritura se convierten en
  mensajes públicos constantes. No se presentan rutas ni errores nativos crudos.
- El store serializa mutaciones y revisiones por archivo dentro del proceso. Escribe un
  temporal exclusivo y sincronizado, copia el principal a respaldo y reemplaza
  el principal al final. Un fallo previo al reemplazo conserva el principal;
  los temporales propios se limpian. El formato en disco sigue siendo v1.

Código principal: `electron/integrated-browser/bookmark-importer.ts`,
`electron/integrated-browser/bookmark-store.ts`, el servicio y handler del
navegador, y `src/components/browser/BrowserManagementPanel.tsx`.

## Evidencia automatizada

Pruebas focalizadas finales: **7 archivos / 190 pruebas aprobadas**, 9,54 segundos,
inicio 12:03:50 local. Typecheck de ambos proyectos y lint de 81 archivos aprobados.

```powershell
npm run test -- integrated-browser browser-history-clear-range browser-site-permissions BrowserTab BrowserPrivacyPanel IntegratedBrowserPanel password-generator whatsapp-delivery-events preload.test shutdown-guard app-lifecycle updater-service updater-hooks window-controller skill-workspace-service
```

Regresión ampliada: **50 archivos / 539 pruebas aprobadas**, 16,19 segundos,
inicio 12:10:36 local. No equivale a ejecutar todos los tests del repositorio.
El inventario documental aumenta a 417 archivos: 293 main, 123 renderer y 1 script.

Las pruebas cubren ausencia de escritura antes de aprobar, cancelación, conteos,
conflictos, revisión vencida/reutilizada, cambio de perfil/ventana/generación,
edición concurrente con dos instancias, cuota, archivo inválido, fallo de disco,
conservación de principal/respaldo, temporales y errores sin rutas. También
ejecutan el servicio real con dobles Electron, handler, exposición preload,
wrapper y estados renderer. Los diálogos nativos se simulan en estas suites.

| Comando | Resultado observado |
|---|---|
| `npm run typecheck` | Aprobado: ambos proyectos TypeScript |
| `npm run lint:changed` | Aprobado: 81 archivos |
| `npm run openspec:validate` | 26 cambios aprobados |
| `npm run verify:pr` | Falló en `skills:seed:check`; no ejecutó las etapas posteriores |
| Etapas previas del gate | Adaptadores 27; arnés 25 rutas/9 skills; suministro 11 vetos/18 hooks; documentación 28 documentos/150 IDs/404 canales/417 pruebas; enlaces 255 Markdown aprobados |
| `node --check` sobre runner y harness nativos | Aprobado |
| `git diff HEAD --check` | Sin errores; avisos de conversión LF/CRLF |

La semilla `database/lia/migrations/system-skills-catalog.sql` no coincide con
`src/shared/skills/registry.ts`. Ambos archivos y el generador
`scripts/quality/system-skills-seed.mjs` siguen sin cambios frente a HEAD de
esta rama; el mismo bloqueo consta en el reporte anterior. No se regeneró SQL
fuera de alcance para convertir el gate en verde. No se ejecutó `verify:release`.

## Electron estable aislado

```powershell
npm run browser:smoke:native -- --electron C:\Users\fysg5\AppData\Local\Temp\pulse-browser-smoke-2XqWst\runtime\electron.exe
```

Se reutilizó el binario 43.4.0 cuyo origen y SHA-256 están registrados en el
reporte anterior; no se instalaron dependencias ni se cambió el runtime compartido.
El runner transpila ahora ocho módulos reales, incluido el store de marcadores.

Resultado: **11 comprobaciones de ejercicio y 4 de recuperación aprobadas**.
Las tres añadidas comprueban revisión sin escribir/rechazo de protocolos locales,
actualización conservando identidad/respaldo y persistencia en otro proceso.
La aprobación se llama desde el harness: no valida interacción humana con los
diálogos nativos ni el flujo completo del producto.

El smoke sigue siendo **parcial** por el zoom compartido entre pestañas del
mismo origen en Electron 43. El runner declara código 2; npm reporta código 1.
Los artefactos se conservan en
`C:\Users\fysg5\AppData\Local\Temp\pulse-browser-smoke-Cr23Wa`.
No se usaron cuentas, perfiles reales, bootstrap, agentes, instalador ni `.env`.

## Revisión adversarial

| Hipótesis | Evidencia y decisión |
|---|---|
| P1: un cambio de contexto durante el diálogo permite aplicar una aprobación vieja | Una prueba negativa detectó captura por referencia; se cambió a snapshot. `integrated-browser-bookmark-importer.test.ts`, caso parametrizado «invalida la confirmación al cambiar %s», verifica perfil, generación, ventana y transición. |
| P2: un error de disco filtra ruta o contenido al renderer | El caso «no filtra rutas ni mensajes arbitrarios del proveedor al fallar el commit» en la misma suite reproduce ruta/token ficticios y exige sólo el mensaje público constante. |
| P1: un fallo al reemplazar elimina la biblioteca actual | Copia de respaldo sin mover el principal; `integrated-browser-bookmark-store.test.ts`, casos «un fallo de commit conserva el principal y limpia temporales» y «una invalidación durante la escritura temporal impide reemplazar el principal». |
| Dos revisiones aplican sobre una biblioteca distinta | Cola compartida por archivo y huella de revisión; dos instancias no pueden aprobar ambas contra el mismo estado obsoleto. |
| Un atributo ajeno se interpreta como URL | Casos de `data-href` y texto `href` dentro de otro atributo; el lector consume valores completos y exige nombre exacto. |
| El renderer evita HITL o recibe datos del archivo | Handler rechaza argumentos/frame ajeno, preload sólo llama al canal existente y los diálogos/DTO sólo contienen conteos. |

Los hallazgos anteriores quedaron corregidos y cubiertos en la regresión final.
No se afirma redacción global de todos los errores del navegador: esta garantía
se limita al importador. Las colas son del proceso actual, no un bloqueo contra
editores o procesos externos. Una operación de reemplazo ya emitida al sistema
de archivos no es cancelable; el destino siempre es el capturado, nunca otro perfil.
No hay garantía de durabilidad frente a corte eléctrico ni recuperación automática
del respaldo de marcadores. No se verificaron diálogos con interacción humana,
importación desde perfiles reales de otros navegadores o UI completa empaquetada.

## Pendientes y reversión

4.6 permanece abierta: historial y credenciales no se importan en este bloque.
También siguen abiertos autenticación del SO, passkeys, perfiles privados,
gobierno avanzado del agente, sync, cobertura de flags y zoom aislado, entre
otros pendientes del [plan](../tasks.md). El avance global sigue en 28/64.

Para revertir este bloque hay que retirar coordinador, integración del servicio,
handler y cambios del store de forma coherente; retirar DTO/UI opcionales si
corresponde. No hay migración SQL ni cambio de esquema de marcadores. Conservar
el principal v1 y su `.bak`; no sustituir archivos con la aplicación abierta.
No se habilitó ninguna capacidad remota, se publicó PR, se hizo merge ni despliegue.
