# Precedencia de políticas empresariales

Fecha: 2026-09-05. Rama: `codex/upgrade-integrated-browser`.
Tarea 8.2 implementada; no es release ni despliegue.

## Resultado

La política se verifica antes de cambiar privacidad, agente, retención o
extensiones. La respuesta se fija al perfil, generación, transición y ventana;
un cambio de cuenta o una ventana nueva invalida la operación pendiente. Si la
lectura falla, el estado queda en error y las rutas administradas siguen
bloqueadas hasta un reintento válido.

El nivel forzado de privacidad se aplica aunque la bandera local esté apagada,
conserva el nivel más estricto del sitio y elimina excepciones que reducirían la
política. Los interceptores de la sesión combinan bloqueo de origen empresarial,
parámetros de rastreo, cookies de terceros y cabeceras de privacidad. Las
peticiones HTTP(S) de documento, subframe y recursos se cancelan para orígenes
bloqueados, incluidos popups y reintentos de descarga. Extensiones, historial y
agente consultan la política antes de actuar.

El diagnóstico muestra `disabled`, `loading`, `ready` o `error`; un estado de
error no se presenta como política cargada. No se añadió un proveedor remoto,
ni un canal IPC para modificar políticas desde el renderer.

## Verificación

```powershell
npm run test -- integrated-browser-service integrated-browser-handlers BrowserRuntimeSupportPanel --maxWorkers=1
npm run test -- integrated-browser-download-manager integrated-browser-service --maxWorkers=1
npm run typecheck
npm run lint:changed
npm run docs:check
npm run openspec:validate
```

Resultado focalizado: **5 archivos / 134 pruebas aprobadas**; TypeScript
aprobado; lint incremental aprobado en 91 archivos; enlaces documentales y
OpenSpec estrictos aprobados (259 Markdown activos y 26 cambios). La regresión
ampliada posterior pasó **56 archivos / 669 pruebas**.

`verify:pr` se ejecutó: aprobó adaptadores, arnés, suministro, documentación y
enlaces, pero se detuvo en `skills:seed:check` por la discrepancia preexistente
entre `database/lia/migrations/system-skills-catalog.sql` y
`src/shared/skills/registry.ts`. No se regeneró SQL ni se modificaron esos tres
archivos.

## Riesgo residual

La política es un store local; todavía no existe proveedor remoto autorizado ni
actualización en vivo. Un cambio en disco se observa en la siguiente operación o
materialización. La navegación del historial interno depende de los interceptores
de `will-navigate`/`will-redirect`; no se afirma cobertura de APIs de Chromium que
salten esos eventos. La política no impide que una extensión ya cargada termine
una acción iniciada antes del cambio; se impide habilitarla o restaurarla después.
Las pruebas usan Electron simulado y archivos temporales, no un instalador real.

## Revisión adversarial

Se intentó refutar: navegación directa, redirección, subframe, popup y
reintento de descarga hacia un origen bloqueado; privacidad local en `off`
frente a una política forzada; mutaciones mientras la política estaba pendiente;
respuesta tardía de otro perfil; errores de lectura; y acceso del agente cuando
la organización lo prohíbe. Las negativas quedaron cubiertas por los casos
focalizados. No se encontró una ruta que permita al renderer cambiar la política
ni una causa de error sensible que cruce estos contratos.

La revisión no demuestra revocación de una acción de extensión que ya empezó,
ni reemplaza una política remota en vivo. Esas capacidades permanecen fuera de
8.2 y deben resolverse junto con el proveedor administrado y el catálogo de
extensiones.
