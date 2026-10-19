# Contexto del cambio

- Objetivo: cambiar entre escenas y sostener pantallas del curso en una salida continua.
- Usuario o actor: instructor autorizado; grupo recibe la pantalla por la llamada.
- Alcance: previo/programa, corte/fundido/barrido e imagen o pantalla intermedia,
  cuatro plantillas, reloj opcional,
  compositor local y ventana de salida capturable por el SDK existente.
- No objetivos: audio/música, stingers de video, cámara virtual, sincronizar bancos en Learning.
- Restricciones: no transmitir por seleccionar una tarjeta ni activar dispositivos
  automáticamente. No afirmar En vivo por preparar el programa. Texto en español.
- Contratos afectados: nueva API studio-output acotada a señalización de una
  conexión WebRTC local entre renderer dueño y ventana de salida. Captura existente
  se conserva para fuentes y SDK; firma y autorización de Learning no cambian.
- Riesgo y HITL: pantalla real requiere consentimiento del selector existente;
  preparar salida requiere acción explícita y compartir usa control oficial de llamada.
- Criterios verificables: preparar no cambia programa; transiciones conservan pista;
  cuenta llega a 00:00 y permanece; fallo de fuente conserva programa anterior;
  cerrar/cambiar actor revoca ventana y pistas; no audio ni paneles en salida.
- Incertidumbres: ingreso SDK sigue dependiendo de configuración externa de Learning.
  Smoke nativo debe acreditar captura continua del WebContents aislado; no sustituye
  ensayo con dos cuentas. Uso local 1280×720/30 fps, sin promesa de rendimiento masivo.
