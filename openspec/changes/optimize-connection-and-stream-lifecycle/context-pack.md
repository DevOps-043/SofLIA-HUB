# Contexto

- Objetivo: reducir carga residente y evitar recursos duplicados/rechazos sin manejar, conservando funciones.
- Actor: usuario del Hub con recursos limitados; no se exige un modelo físico de equipo.
- Alcance: preparación de conexión, reintentos, listeners y publicaciones del renderer.
- No objetivos: retirar herramientas, recortar texto, desactivar medios o prometer ausencia absoluta de crashes.
- Contratos: mismos servicios/canales; cambia programación interna.
- Restricciones: autorización vigente después de esperas, ningún envío real en pruebas, conservar cambios anteriores.
- Riesgo/HITL: cambios locales reversibles; sin mutaciones remotas de cuenta.
- Criterios: SDK ausente del import inicial, un intento/socket en preparación, desconexión cancela pendientes, listeners contienen rechazos, salida final idéntica y sin escritura de generación obsoleta.
- Incertidumbres: no hay dumps de los cierres del usuario; el ahorro de módulo no acredita RAM global.
