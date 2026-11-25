## Contexto

- Objetivo y actor. La persona que usa el chat puede elegir el nivel de intervención y recibir evidencia al encargar una tarea local o web.
- Alcance. Permisos por ventana autenticada, arranque del navegador integrado y observación de sus descargas.
- Contratos. Main valida al emisor y conserva la decisión. La revisión aparece en una vista aislada dentro del Hub. Las herramientas devuelven resultados estructurados.
- Riesgo y HITL. Acceso completo permite abrir enlaces externos válidos y crear carpetas locales tras la autorización de la sesión. Shell, escritura de contenido, borrado, envío y tareas visuales con efectos sin delimitar siguen sujetos a revisión.
- Criterios. Inicio en frío, navegación y lectura en la misma pestaña, cancelación, transferencia verificable y revocación por sesión.
- Incertidumbre. Las imágenes muestran la portada y un cierre prematuro. Sin trazas de la sesión no se puede atribuir el cierre original a una única causa.

## Decisions

- Codex documenta herramientas tipadas, progreso y aprobaciones con ciclo de vida explícito. Claude Code combina herramientas de Chrome con permisos por aplicación u origen. SofLIA conserva el navegador y los actuadores existentes, y usa sus APIs deterministas antes de delegar acciones visuales. [Codex App Server](https://openai.com/index/unlocking-the-codex-harness/) · [Claude Code con Chrome](https://code.claude.com/docs/en/chrome) · [Computer Use de Claude Code](https://code.claude.com/docs/en/computer-use)
- El nivel de razonamiento del chat y la inferencia del actuador son llamadas distintas. La navegación y comprobación de descargas se resuelven mediante datos del navegador y no dependen de que el actuador reconozca visualmente la portada o la barra de descargas.
- La vista de revisión carece de JavaScript, preload y red. Main interpreta únicamente sus controles internos y descarta respuestas tardías. El modo vive en memoria y se revoca al cambiar el documento o la sesión.
