# Arquitectura frontend

Estado: vigente. Actualizado: 2026-07-21.

<!-- evidence: src/main.tsx -->
<!-- evidence: src/app/AppContent.tsx -->
<!-- evidence: src/app/AppWorkspace.tsx -->

## Entrada y composicion

`src/main.tsx` monta `App`; `src/App.tsx` envuelve la aplicacion en
`AuthProvider`, renderiza `AppContent` y mantiene `UpdateNotification` global.
No se usa React Router: `ActiveView` es la union `chat | project | productivity |
sdo | meetings` y `AppWorkspace` selecciona el componente con render condicional.

`AppContent` coordina:

- autenticacion SOFIA/Lia y organizacion activa;
- managers de chat, carpetas e IRIS;
- tema y posicion de sidebar (`left`, `right`, `bottom`);
- enlaces compartidos y triggers de reunion recibidos por IPC;
- ventana normal frente a ventana `orb`;
- modales de share, folders y settings.

El intro de inicio dura 4200 ms, concede 700 ms adicionales al auth y anima la
salida 1250 ms. Son parametros UI en `src/app/AppContent.tsx`, no tiempos de SLA.

## Capas del renderer

| Ruta | Responsabilidad | Regla de dependencia |
|---|---|---|
| `src/app/` | composicion, vistas, notices, modales y triggers | puede usar hooks/components/services; no accede a Node |
| `src/components/` | pantallas y componentes de dominio | debe delegar I/O en services/hooks |
| `src/components/ui/` | primitives Button, Card, fields, Toggle, Badge, Select | no contiene reglas remotas |
| `src/hooks/` | estado coordinador y efectos | no crea clientes main ni secretos |
| `src/services/` | contratos renderer, Supabase y wrappers `window.*` | valida/normaliza respuestas y expone tipos |
| `src/contexts/` | sesion e identidad | SOFIA es principal; Lia se resuelve aparte |
| `src/lib/` | clientes Supabase y tipos compartidos | cada instancia usa storage key/config propia |
| `src/core/` | entidades/ports/use cases experimentales | no es aun la unica arquitectura del renderer |
| `src/adapters/` | adaptadores UI/infra de modulos migrados | implementa ports sin saltar preload |

## Flujo de datos

```text
interaccion UI
  -> componente / hook
  -> src/services/<dominio>
  -> window.<api> expuesta por preload  O  cliente Supabase renderer
  -> normalizacion/cache/estado React
  -> render de resultado, degradacion o error
```

Supabase renderer se usa para datos de UI; filesystem, procesos, canales, OAuth,
captura y automatizacion siempre cruzan preload. `createElectronSupabaseClient`
persiste sesiones en `localStorage`, deshabilita deteccion de sesion por URL y usa
fetch con timeout/retry controlados.

## Estado y cache

- Chat divide cache, remote, pending state, recovery y sync bajo
  `src/services/chat/`; no existe un store global de Redux.
- Folder sigue el mismo patron bajo `src/services/folder/`.
- Auth se descompone en hooks de ciclo de vida, SOFIA, Lia y sign-out.
- Settings usa carga/guardado y formularios por modal; la navegacion tiene once
  tabs declaradas en `src/components/unified-settings/settings-tabs.tsx`.
- Estado UI efimero (view, modal, sidebar) usa hooks locales; posicion/tema tambien
  se sincronizan con main cuando existe API.

## Estados visuales obligatorios

Cada pantalla remota debe distinguir carga, vacio, error, degradado y contenido.
Ejemplos existentes: `tool-library/ToolLibraryStates.tsx`, notices de Lia,
WhatsApp disconnected/pairing/unavailable y tarjetas de updater. Los nuevos
componentes deben reutilizar primitives y no depender de un `alert()` generico.

## Seguridad del renderer

- `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`.
- Solo APIs expuestas por `contextBridge`.
- `SafeReleaseNotes` limita a 8000 caracteres y sanitiza el contenido antes de
  renderizar notas externas.
- URLs, archivos y comandos pasan a main; el renderer no los ejecuta.

## Deuda/limites documentados

- No toda la UI esta migrada a `src/features/<dominio>`; `components` y `services`
  siguen siendo la estructura dominante.
- `any` permanece en contratos legacy; TypeScript estricto no equivale a cero
  casts ni a validacion runtime.
- El bundle renderer mantiene advertencias de tamano registradas en reportes de
  verificacion; dividirlo requiere una iniciativa de performance separada.
- No existe libreria formal de rutas ni sistema i18n; el idioma operativo es
  espanol por politica del repositorio.
