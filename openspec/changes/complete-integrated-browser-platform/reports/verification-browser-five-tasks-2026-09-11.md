# Verificación: cinco cierres del navegador

Estado: reporte histórico del corte. Fecha: 2026-09-11.
Cambio: `complete-integrated-browser-platform`.
Worktree: `.worktrees/upgrade-integrated-browser`; rama `codex/upgrade-integrated-browser`.
Base Git: `f52c8d6`, con cambios previos preservados y sin commit nuevo.

Se cierra la implementación de **2.5, 4.8, 6.5, 6.8 y 6.9**.
OpenSpec informa **59/64 completas y 5 pendientes**. No equivale a release,
instalación del producto ni aprobación del despliegue de sync.

## Implementación y criterios cubiertos

| Tarea | Resultado implementado | Evidencia y límites |
|---|---|---|
| 2.5 | Zoom 50–300% por pestaña, reset, atajos, reflujo y coordenadas de entrada adaptadas | Emulación desktop por WebContents en Electron 43; usa aislamiento nativo cuando existe. Dos pestañas del mismo origen, navegación, resize, captura, entrada y PDF comprobados en runtime real. No se afirma persistencia del factor tras reiniciar la aplicación. |
| 4.8 | Desbloqueo Windows Hello/PIN vinculado a HWND; autorización de cinco minutos, bloqueo manual/SO/perfil; oferta revisada de credenciales en SPA y redirecciones SSO compatibles | Sólo main verifica; IPC no acepta PIN ni aprobación. Candidato conserva el origen inicial, nunca comparte contraseñas entre dominios. Formularios ambiguos, iframes, ventanas SSO separadas y flujos multietapa no compatibles requieren guardado manual. Verificación interactiva Windows todavía en 9.5. |
| 6.5 | Derivación obligatoria a la persona ante indicios sensibles o documentos no inspeccionables | Sonda aislada, cuotas compartidas incluso en shadow DOM, barreras antes/después de lecturas y capturas; cancela CU y espera drenaje. Bloqueo persiste hasta documento nuevo, sin botón de bypass. Detección conservadora, no clasificador universal de texto/imágenes ni protección de captura global del escritorio. |
| 6.8 | Memoria semántica opt-in para historial/marcadores con fuentes y borrado | Hasta 400 fuentes, 768 dimensiones, 30 días; SQLite protegido por SO; consentimiento nativo para enviar metadata y consultas a Google. Cancelación, cuotas y revalidación del perfil/fuentes. No incluye cuerpos de páginas, formularios ni sync. |
| 6.9 | Voz humana de Orbe para pestañas, estado, pausa, detención, toma de control y reanudación | Prefijo literal `navegador`, acciones cerradas, emisor visible/autenticado y recibos vigentes. Reanudar exige confirmación nativa. No crea otro agente ni devuelve DOM, títulos o URL al dictado. |

Los contratos cruzan servicio, handler, allowlist/preload y wrapper tipado.
La UI recibe estado autoritativo de main; acuses de geometría y respuestas
obsoletas no reemplazan el perfil o las barreras nuevas.

La ampliación de regresión detectó además un ciclo de render preexistente en el
menú de aplicaciones al omitir favoritos: el valor por defecto `[]` cambiaba
en cada render y reiniciaba el efecto que consultaba historial. Ahora conserva
identidad estable y descarta respuestas de una apertura anterior. Se detuvieron
sólo los workers Vitest propios bloqueados para repetir la suite corregida.
La prueba previa de ordenación usaba dos visitas para un sitio que esperaba
ver junto a otro de tres; se ajustó el fixture al umbral existente sin cambiar
el algoritmo de frecuencia ni debilitar las aserciones de orden.

## Verificación ejecutada

- Regresión focalizada anterior al ajuste exclusivamente tipado del entorno del
  helper: **1056 pruebas en 74 archivos aprobadas**.
- Regresión ampliada final, incluido el menú reparado: **1214 pruebas en 97
  archivos aprobadas**, 49,93 segundos. Comando:
  `npm run test -- integrated-browser Browser browser- orb-show-handler orb-conversation desktop-agent-computer-use-lifecycle gemini-cu-loop gemini-cu-client preload --maxWorkers=4 --reporter=dot --silent=passed-only`.
- `npm run typecheck`: aprobado, main y renderer. Se corrigió el conflicto entre
  la ampliación global `ProcessEnv` de Vite y el entorno mínimo del subproceso;
  no se añadieron variables de la aplicación ni secretos al helper.
- `npm run lint:changed`: 272 archivos sin deuda nueva.
- `npx openspec validate complete-integrated-browser-platform --strict`: aprobado.
- `git diff --check`: salida 0; advertencias de normalización LF/CRLF, sin errores.
- `npx openspec instructions apply --change complete-integrated-browser-platform --json`:
  64 tareas, 59 completas, 5 pendientes.

Smoke ejecutado con
`npm run browser:smoke:native -- --electron RUTA_ABSOLUTA_DEL_ELECTRON_LOCAL`.
Runtime real **Electron 43.4.0, Chromium 150.0.7871.224**; no bootstrap del producto,
`.env`, credenciales personales ni llamadas a proveedores de IA.
Resultados locales en `C:/Users/fysg5/AppData/Local/Temp/pulse-browser-smoke-blhjS7/`:

| Fase / JSON | Comprobaciones aprobadas |
|---|---:|
| exercise | 12 |
| restore | 4 |
| lifecycle | 3 |
| vault | 11 |
| autosave | 11 |
| zoom | 13 |
| safety | 12 |
| Total | 66 |

Autosave utiliza gestos confiables de Chromium y también prueba gestos sintéticos
rechazados, destino de otro origen, formulario ambiguo, navegación, recuperación
de CDP y desactivación. La fase de bóveda usa DPAPI real y datos ficticios.
Un intento previo de zoom falló porque la superficie del compositor no estaba
lista. El harness ahora espera esa condición con plazo acotado y sin relajar
las comprobaciones de escala; el recorrido completo posterior pasó.

La sonda Windows compiló el helper y obtuvo `available`, también con el entorno
restringido de PowerShell. Sólo consulta disponibilidad/interop: **no se ejecutó
aceptación ni cancelación de una autenticación real**. Esos caminos se cubren
con dobles en las pruebas y siguen requiriendo validación humana del producto.
El proveedor semántico se probó con dobles, sin petición facturable a Google.

`npm run verify:pr` falla en **`skills:seed:check`**, por la discrepancia previa
entre `database/lia/migrations/system-skills-catalog.sql` y
`src/shared/skills/registry.ts`. Ambos archivos permanecen sin diferencias frente
a HEAD. No se regeneró ni aplicó SQL ajeno a este alcance.
Antes de ese fallo pasan 27 adaptadores, harness (25 rutas y 9 skills), cadena
de suministro (11 versiones vetadas y 18 hooks), documentación del sistema
(28 documentos, 150 IDs, 424 canales, 463 archivos de prueba) y enlaces en
280 Markdown activos.
El gate no ejecuta las fases posteriores al fallo: **no se declara PR verde ni
suite global aprobada**.

## Revisión adversarial

Se intentó refutar la separación de perfiles, la vigencia de consentimiento y
la ausencia de acceso a secretos mediante: logout/login de la misma cuenta,
marcos secundarios, emisor oculto, campos adicionales, respuestas tardías,
cambio de documento durante diálogo, expiración, cancelación durante captura,
autofill, shadow DOM sobredimensionado y proveedor no disponible.

Se corrigieron cuotas reiniciadas al recorrer shadow DOM, herencia innecesaria
de variables hacia PowerShell, reaprovechamiento de contextos autenticados y
acuses de viewport que podían sobrescribir eventos nuevos. Guardas de bóveda
se revalidan también dentro de la cola de borrado y antes de publicar resultados.
La implementación impide liberar el control mientras se drena entrada nativa;
no promete deshacer acciones ya enviadas ni cancelar costes de un proveedor.

## Riesgo residual, configuración y reversión

La autenticación Windows es una barrera de la aplicación sobre una bóveda
protegida por DPAPI, no cifrado ligado criptográficamente a Windows Hello ni
aislamiento de malware ejecutado por el mismo usuario. Otros SO fallan cerrado.
La derivación sensible puede producir falsos positivos y no identifica todo
contenido médico, identitario o secreto. No amplía garantías al agente desktop.

Eliminar una fuente del historial/marcadores la excluye y depura del índice en
la siguiente búsqueda; no promete purga física instantánea. Desactivar memoria
borra explícitamente su instantánea local. Metadata ya enviada a Google no se
puede retirar mediante ese borrado. Consentimiento explica envío y coste posible.

Se conservan los flags: `BROWSER_AGENT_GOVERNANCE_ENABLED` apagado por defecto y
activación de memoria separada, explícita. No se modificaron `.env`, secretos,
flags locales, instalación del padre ni backend remoto. Para desactivar la
memoria, usar su acción de desactivación antes de retirar la UI. Mantener intacta
la bóveda cifrada y sus respaldos. Revertir contratos main/preload/renderer en
conjunto, sin quitar la barrera de autenticación dejando operaciones sensibles
expuestas. No restaurar todo el worktree, que contiene trabajo previo.

La documentación canónica se actualizó después de implementar: arquitectura,
IPC, seguridad, parámetros, diccionario de datos, requisitos, historias,
inventario de pruebas y manual runtime. Las skills de verificación y revisión
adversarial guiaron las pruebas negativas y mantuvieron abiertos los cierres
que requieren sistemas reales.

## Cinco tareas pendientes

1. **4.10:** proveedor nativo de passkeys sin exposición de material privado.
2. **5.6:** permisos de extensiones configurables por sitio.
3. **5.7:** catálogo curado, autenticidad del editor y actualización explícita.
4. **8.7:** migraciones, respaldos y rollback de los stores restantes.
5. **9.5:** smoke del producto/instalador Windows, autenticación interactiva y,
   antes del rollout de sync, despliegue autorizado y Lia Auth/RLS/revocación
   con dos equipos reales.

## Fuentes técnicas consultadas

El helper usa la API de escritorio con HWND documentada por
[Microsoft](https://learn.microsoft.com/en-us/windows/win32/api/userconsentverifierinterop/nf-userconsentverifierinterop-iuserconsentverifierinterop-requestverificationforwindowasync)
y los encabezados oficiales de
[interop](https://raw.githubusercontent.com/microsoft/win32metadata/main/generation/WinSDK/RecompiledIdlHeaders/um/UserConsentVerifierInterop.h).
La compatibilidad se comprueba en ejecución; no se presume disponible en todas
las versiones de Windows.

Zoom usa [emulación de dispositivo de Electron](https://www.electronjs.org/docs/latest/api/web-contents#contentsenabledeviceemulationparameters),
con geometría desktop y pruebas nativas propias para el aislamiento.
El contrato del proveedor se contrastó con la documentación de
[embeddings de Gemini](https://ai.google.dev/gemini-api/docs/embeddings).
