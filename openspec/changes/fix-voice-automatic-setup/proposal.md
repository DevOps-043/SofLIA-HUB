# Preparación automática de voz y consentimiento recordado

## Problema
El Orbe solicita de nuevo autorización tras iniciar sesión y trata de dictar
sin Python o Vosk disponibles. Ajustes delega la instalación al usuario mediante
un comando de desarrollo. Las capturas acreditan esos estados, no un fallo de
hardware específico.

## Alcance
Preparar Python privado y Vosk pequeño automáticamente, sin capturar audio ni
bloquear el arranque. Esperar esa preparación al activar voz. Recordar aprobación
explícita por cuenta, dispositivo, modelo y palabras; permitir revocarla al
detener/deshabilitar. Informar progreso y errores recuperables sin comandos.

No se modifican permisos del SO, credenciales, bases remotas ni proveedores TTS.
Una preferencia heredada enabled no acredita consentimiento por cuenta.
