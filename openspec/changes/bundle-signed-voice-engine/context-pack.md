# Contexto del cambio

- Objetivo: distribuir el motor de reconocimiento local completo y con binarios
  firmados, evitando preparación pip en equipos Windows de usuarios.
- Actor: persona que instala SofLIA y mantenedor que publica un instalador.
- Alcance: Python/dependencias, Vosk español pequeño, firma Authenticode, reparación
  local desde paquete ejecutable firmado, instaladores NSIS/visual, CI y guía de firma.
- No objetivos: cambiar políticas de Windows, crear credenciales/certificados,
  publicar versiones, instalar modelo grande/Whisper/Piper opcionales ni prometer
  funcionamiento offline de los proveedores de síntesis/conversación remotos.
- Restricciones: conservar cambios previos de voz, sesiones y límites IPC; no
  guardar secretos ni emitir una publicación Windows sin firma configurada.
- Contratos: recursos empaquetados y metadata del editor; mismas APIs de voz.
- HITL: usuario autorizó implementar empaquetado/firma; no autorizó publicar ni
  mutar identidades en Azure/GitHub. Instalar dependencias del build está en alcance.
- Aceptación: modelo básico incluido; inventario PE íntegro y firmas verificadas;
  reparación valida editor antes de ejecutar, extrae sin escape y revalida imports;
  falta de identidad o firma inválida rechaza publicación; documentación operable.
- Incertidumbres: identidad de firma no proporcionada; prueba real de firma y
  Smart App Control necesita certificado/servicio y Windows de QA configurado.
