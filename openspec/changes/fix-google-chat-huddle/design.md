## Context

Ver [propuesta](proposal.md) y [diagnóstico](../evolve-integrated-browser-workspace/reports/huddle-diagnosis-2026-10-06.md).
La capacidad base aún vive en cambios activos, no está archivada en specs main.

## Goals / Non-Goals

**Goals:** preservar la semántica web del componente embebido y del popup de
llamada, con sesión del abridor y gobernanza antes de entregar el webContents.

**Non-Goals:** interpretar RPC de Google, reescribir SDP, fabricar capacidades
o iniciar llamadas desde timers o restauración de SofLIA.

## Decisions

- DEC-HUDDLE-01: retirar la prohibición por host/ruta en navegación y subframes.
  La carga del componente de Meet no es autorización para que SofLIA cree una
  reunión. SofLIA deja el inicio al control de Google accionado por la persona.
- DEC-HUDDLE-02: la ruta exacta HTTPS `/call` o `/call/` abierta por Gmail/Chat
  usa el creador nativo existente de popups. Convertirla en pestaña devuelve
  `null` al abridor; la ventana real conserva su relación con el chat.
- DEC-HUDDLE-03: comprobar política empresarial y seguridad local antes de
  admitir un popup con destino. Mantener comprobaciones de red, certificados,
  permisos por origen y opciones heredadas sin aumentar privilegios.
- DEC-HUDDLE-04: adopción idempotente para evitar duplicar listeners cuando
  `createWindow` y `did-create-window` notifican la misma ventana.
- DEC-HUDDLE-05: desactivar `DocumentPictureInPictureAPI` en las vistas del
  navegador. La API resuelve sin crear una ventana gobernada. Ocultarla hace
  que Google utilice su panel compatible; el smoke real confirma tarjeta y
  controles de llamada. La API PiP de vídeo es distinta y no se desactiva.
  El efecto se aplica a todos los sitios de estas vistas. Retiro: soporte
  upstream confirmado por sonda nativa y regresión de Huddle real aprobada.
- DEC-HUDDLE-06: fijar Electron 44.5.1 estable probado y alinear ejecutable,
  paquete, lockfile y manifiesto. La actualización sola no corrige Huddle;
  evita entregar sobre una beta local discordante con el proyecto.

Referencia: [ventanas del renderer en Electron](https://www.electronjs.org/docs/latest/api/window-open).
La API instalada de Electron no aporta `userGesture` en `HandlerDetails`; no se
inventa esa propiedad ni una aprobación basada en temporizadores heurísticos.

## Risks / Trade-offs

- Fallo de arranque remoto persistente → validar la llamada real después del
  desbloqueo y recoger errores saneados sin cookies, tokens ni parámetros.
- Apertura originada por script web → aplica la política de popups del navegador;
  SofLIA no crea, recarga ni traslada llamadas por iniciativa propia.
- Trabajo concurrente → snapshot en worktree y transferencia solo de nuestro
  diff, comprobando que los archivos originales no cambiaron mientras tanto.

## Migration Plan

Sin migración de datos. Validar, integrar el diff y reiniciar el runtime mediante
su flujo de desarrollo existente. Rollback: revertir únicamente este diff para
restaurar el rechazo histórico. No cerrar sesiones Google ni borrar datos.
