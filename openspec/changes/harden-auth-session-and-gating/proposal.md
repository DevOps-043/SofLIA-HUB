## Why

Dos defectos de seguridad y experiencia se refuerzan mutuamente:

1. **La sesión se cierra sola.** En `src/contexts/auth/useAuthLifecycle.ts`,
   `applySofiaSession` llama a `resolveSofiaContext`; si la carga de perfil o
   membresías SOFIA falla de forma transitoria (red, timeout), el resolver
   devuelve `null` o lanza, y el flujo ejecuta `signOut()`, que borra
   `sofia-session` de localStorage. Al reiniciar la computadora, un instante de
   indisponibilidad de SOFIA destruye la sesión persistida. No se distingue
   "usuario sin membresía" (denegación real) de "error recuperable" (mantener
   sesión y degradar).

2. **Funciones usables sin login.** El gate de autenticación vive solo en el
   renderer (`src/app/AppContent.tsx` muestra el login cuando no hay usuario).
   El proceso main crea la orbe por wake word, atajo global o tray
   (`electron/main/orb-window-controller.ts`) y autoconecta WhatsApp sin conocer
   el estado de sesión. El main no tiene forma de saber si hay un usuario
   autenticado, así que orbe, WhatsApp, computer-use y desktop-agent pueden
   operar sin sesión: un acceso crítico que debe negarse por defecto.

## What Changes

- **Persistencia robusta**: no cerrar sesión ante un fallo recuperable al
  resolver el contexto SOFIA. Distinguir denegación real (sin membresía activa,
  credenciales inválidas) de error transitorio; en el segundo caso conservar la
  sesión persistida y marcar estado degradado con reintento.
- **BREAKING (seguridad)**: introducir un estado de autenticación conocido por el
  proceso main mediante un canal IPC gobernado (renderer → main), como única
  fuente para gatear funciones.
- **Deny-by-default en main**: bloquear creación/uso de la orbe, autoconexión y
  comandos de WhatsApp, computer-use y desktop-agent mientras no exista sesión
  válida. Al cerrar sesión, revocar el acceso y ocultar/cerrar la orbe.
- **Gate del renderer coherente**: mantener el login como única entrada y evitar
  que la ventana orbe u otras vistas rendericen funciones sin sesión.

No objetivos: rediseñar el login o el proveedor de identidad SOFIA; completar la
migración de auth del main a Supabase Auth (las tablas con políticas permisivas
siguen igual); cambiar el catálogo de modelos (cubierto por
`expand-gemini-model-catalog`); gatear superficies puramente informativas que no
ejecutan acciones ni acceden a datos del usuario.

## Capabilities

### New Capabilities

- `auth-session-and-feature-gating`: Persistencia de sesión resistente a fallos
  transitorios y negación por defecto del uso de funciones sensibles (orbe,
  WhatsApp, computer-use, desktop-agent) hasta contar con una sesión válida,
  gobernada por un estado de auth conocido por el proceso main.

### Modified Capabilities

Ninguna especificación base publicada. Este cambio entrega la primera
especificación observable del gate de autenticación y la persistencia de sesión.

## Impact

Afecta `src/contexts/auth/*` (persistencia y degradación), un canal IPC nuevo
`auth:set-state`/`auth:get-state` con servicio, handler, allowlist de preload y
wrapper tipado del renderer (`docs/standards/electron-ipc.md`),
`electron/main/orb-window-controller.ts`, `electron/main/window-controls.ts`,
`electron/main/startup.ts` (autoconexión WhatsApp), y los handlers de
computer-use y desktop-agent que ejecutan acciones. No agrega tablas ni secretos.
Riesgo: gatear de más puede impedir el uso legítimo; se mitiga con estado de auth
observable, degradación explícita y pruebas de los caminos permitido/denegado. Al
inicio, antes de conocer el estado, se asume "no autenticado" (deny-by-default).
