## Context
La interfaz descrita aquí es un antecedente. La solicitud del 2026-10-24 la
sustituye por [monitor y escenas compactos](../compact-studio-scenes/design.md),
sin controles de efectos ni segundo monitor.

Ver [propuesta](proposal.md). El estudio ya posee vínculos de fuentes con
consentimiento y un runtime audiovisual aislado. El SDK no ofrece un método
público para reemplazar libremente su pantalla emitida.

## Goals / Non-Goals
Implementar programa continuo con preparación explícita y recursos acotados.
No sustituir el SDK ni capturar el escritorio completo para emitir el panel.

## Decisions
1. OBS distingue escena/efecto y previo/programa. Se adoptan corte, fundido y
   barrido (100–2000 ms), dejando stingers de video, mezcla de audio y automatización fuera.
   StreamYard agrupa escenas preparadas; Ecamm anima composición. Se toma su
   preparación reutilizable sin replicar sus interfaces.
2. Canvas 1280×720 a 30 fps compone solo contenido autorizado. Prepara destino
   antes del cambio, conserva anterior si falla y evita transiciones superpuestas.
   Videos locales son silenciosos; micrófono/cámara de la llamada no se modifican.
   El reloj usa fecha límite absoluta y al llegar a cero no abre otra escena.
3. Una ventana oculta aislada recibe únicamente video del canvas mediante WebRTC
   local sin STUN/TURN; IPC transporta oferta/respuesta acotadas, nunca frames,
   credenciales ni archivos. Su preload expone solo métodos del receptor.
   El handler de pantalla del SDK entrega ese WebContents, no el renderer de UI.
   Esto mantiene una pista continua usando la API oficial de captura de Electron.
4. Preparar salida es consentimiento explícito y no inicia la llamada. El SDK
   sigue iniciando Compartir desde su control oficial. Las fuentes de pantalla
   del compositor usan el vínculo y concesión de vista previa existentes.
5. El modo anterior sigue disponible al cerrar salida. Cerrar el estudio, navegar,
   cambiar cuenta, fallar receptor o terminar peer revoca la concesión y sus pistas.
   Sin persistencia ni cambios en el contrato remoto de Learning.

## Risks / Trade-offs
- Captura de UI → ventana dedicada sin App, cuenta, navegación ni preload general.
- Respuesta/actor tardíos → dueño exacto, frame principal, ID de generación y timeout.
- Fuente desaparecida → destino no se publica, programa anterior sigue activo.
- Ventana oculta/throttling → backgroundThrottling false, smoke nativo obligatorio.
- Canvas contaminado → imágenes CORS y validación de lectura antes de publicar.
- Receso no silencia llamada → aviso explícito; sin efectos implícitos en audio/cámara.
- Capturas simultáneas → máximo saliente/intermedio/entrante durante una transición
  visual; liberar saliente e intermedio al terminar, todas al cancelar.

## Ampliación: imágenes y pantallas intermedias
El efecto Imagen o pantalla usa una escena existente de tipo imagen, lámina,
pantalla o pantalla de curso. Se prepara junto al destino antes de publicar.
El intervalo total es 500–10000 ms, con fundidos de hasta 200 ms en sus extremos;
movimiento reducido utiliza cortes manteniendo la duración. No incluye video
stinger ni audio. La imagen también puede emitirse como escena sin duración fija.
La preparación de medios recibe una señal de cancelación: cerrar libera una
captura que todavía espera su primer frame sin agotar el plazo de 10 s por fuente.
La interfaz usa el banco existente, una miniatura de contenido, campos compactos
y ayuda desplegable. No añade IPC, dependencias ni persistencia.

## Migration Plan
Sin migración de datos. Build normal incluye vista de salida. Probar unidad,
IPC/preload, compositor, captura nativa continua y UI; luego verify:pr. Rollback:
revertir este cambio y usar compartir directo. Ensayo real SDK sigue condicionado
a Learning configurado y dos cuentas; no se acredita con un smoke local.

## Fuentes primarias
- [OBS: Studio Mode y transiciones](https://obsproject.com/kb/OBS-Studio-Overview).
- [StreamYard: preparación de escenas](https://streamyard.com/blog/how-to-manage-multiple-scenes-in-streaming-software).
- [Ecamm Live Motion](https://www.ecamm.com/livemotion/).
- [Electron: captura de WebContents por WebFrameMain](https://github.com/electron/website/blob/main/docs/latest/api/session.md).
- [MDN: señalización WebRTC](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Signaling_and_video_calling).
