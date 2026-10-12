# Contexto y diseño

- Objetivo: ver próximas sesiones y unirse dentro de Hub.
- Actor: alumno o instructor autenticado, organización activa.
- Alcance: menú, agenda paginada de 20 sesiones, aula, HTTP y cuatro capas IPC.
- No objetivos: programar clases, cambiar Zoom, migraciones o despliegue remoto.
- Restricciones: conservar modificaciones previas, tokens de tema y controles académicos existentes.
- Contrato: learning-live:catalog → POST /api/auth/live/catalog; slug, página y vista alumno/instructor. Devuelve metadatos públicos, nunca URLs Zoom.
- Riesgo: cuenta/organización pueden cambiar durante la carga; descartar respuestas tardías y volver a autorizar al entrar.
- Criterios actuales: menú abre agenda; estados carga/vacío/error; paginación; clases en vivo destacadas; selección o referencia abre un lienzo vacío exclusivo, sin navegador, chat, agentes, colaboración ni medios. Volver y cerrar regresan a la agenda. Ambos temas y ancho reducido son legibles.
- Decisión del usuario del 11 de octubre: retirar por completo el diseño del aula anterior antes de reconstruirlo. Se retiran sus componentes y polling del renderer; los contratos privados y la autorización de main/Learning se conservan para la siguiente implementación.
- Incertidumbre operativa: endpoint requiere publicar Learning; validación multimedia con cuenta real sigue pendiente.
- Evolución posterior: el usuario solicitó reconstruir primero el panel del instructor; su diseño y separación por rol se especifican en `design-instructor-live-studio`. El lienzo vacío se conserva para el participante.
