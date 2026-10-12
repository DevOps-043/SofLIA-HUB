# Sesión del ecosistema en el navegador integrado

Estado: implementado y verificado localmente; publicación autorizada en curso.
Alcance confirmado: navegador integrado de PulseHub.

## Objetivo

Al visitar Learning, Engine o Project Hub por primera vez, abrir una sesión
propia del sitio con la identidad SOFIA ya validada por main. Conservar las
sesiones existentes y el cierre de sesión o cambio de cuenta hecho en la web.

## Contrato

- RF-ECO-001: canje POST `/api/auth/hub-session`, bearer SOFIA vigente, sin
  contraseña ni refresh token del escritorio; respuesta sin credenciales.
- RF-ECO-002: ejecutar en la partición persistente del usuario; perfiles
  invitados y privados nunca reciben la identidad del escritorio.
- RF-ECO-003: recordar por origen una conexión confirmada o una sesión existente. Abrir otra
  pestaña o reiniciar no deshace un cierre de sesión ni reemplaza otra cuenta.
- RF-ECO-004: ofrecer «Usar mi cuenta de PulseHub» como reconexión explícita.
- RNF-ECO-001: destinos exactos, sin subdominios implícitos, redirecciones
  HTTP rechazadas, timeout y cancelación al cambiar de perfil o navegación.
- RNF-ECO-002: los sitios verifican el bearer en Auth y el perfil/membresía;
  rechazan orígenes cruzados y no almacenan la credencial del escritorio.

## Entrega

Los tres sitios requieren publicar el endpoint junto con PulseHub. El usuario
autorizó conectar Netlify y publicar el 2026-10-10. La publicación usa commits
aislados sobre las versiones productivas de cada web. No se incluyen
Chrome/Edge externos ni migraciones remotas.
