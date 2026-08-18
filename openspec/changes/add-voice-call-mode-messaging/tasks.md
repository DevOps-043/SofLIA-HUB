## 1. Cimientos de voz

- [x] 1.1 Permitir un formato de salida por llamada en `requestElevenLabsSpeech`, aceptando Opus sin alterar el MP3 de la orbe.
- [x] 1.2 Sintetizar notas de voz OGG/Opus con timeout, tope de bytes, recorte y duración estimada.
- [x] 1.3 Configurar el modo llamada: habilitación, límites, inactividad y voz opcional propia.

## 2. Transporte

- [x] 2.1 Enviar notas de voz por WhatsApp como `ptt` y registrarlas en el historial.
- [x] 2.2 Enviar notas de voz por Telegram con `sendVoice` multipart.
- [x] 2.3 Aceptar y transcribir audio entrante de Telegram por la ruta de agente existente.

## 3. Modo llamada

- [x] 3.1 Registrar sesiones por canal y chat con apertura, cierre y vencimiento por inactividad.
- [x] 3.2 Entregar hablada la respuesta cuando el modo esté activo o el turno entre por voz, con caída a texto avisada una vez.
- [x] 3.3 Rechazar la llamada entrante de WhatsApp y reconducirla al modo llamada solo para remitentes autorizados en chat directo.
- [x] 3.4 Atender `/llamar` y `/colgar` en ambos canales, negando la apertura en grupos.

## 4. Agente

- [x] 4.1 Declarar y despachar `send_voice_note` con las guardas del catálogo existente.

## 5. Evidencia y cierre

- [x] 5.1 Cubrir síntesis, transporte, ciclo de sesión, rechazo de llamada y degradación con pruebas focalizadas.
- [x] 5.2 Ejecutar typecheck y la compuerta de pruebas del repositorio.
- [x] 5.3 Actualizar el manual de agentes runtime, configuración de operaciones y changelog.
- [ ] 5.4 Realizar revisión adversarial y registrar evidencia y riesgo residual.

## 6. Pendiente de verificación manual

- [ ] 6.1 Prueba en dispositivo real: llamar a SofLIA por WhatsApp y comprobar rechazo inmediato más saludo hablado.
- [ ] 6.2 Prueba en dispositivo real: nota de voz con petición de búsqueda web y de acción de computer use durante la llamada.
- [ ] 6.3 Prueba en Telegram con un bot configurado: nota de voz entrante y respuesta hablada.
