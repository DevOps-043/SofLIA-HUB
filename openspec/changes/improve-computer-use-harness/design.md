## Contexto

- Objetivo y actor. La persona que usa el chat puede elegir el nivel de intervención y recibir evidencia al encargar una tarea local o web.
- Alcance. Permisos por ventana autenticada, arranque del navegador integrado y observación de sus descargas.
- Contratos. Main valida al emisor y conserva la decisión. La revisión aparece en una vista aislada dentro del Hub. Las herramientas devuelven resultados estructurados.
- Riesgo y HITL. Aprobar por mí valida por reglas la apertura a la raíz de un dominio HTTPS ordinario. Acceso completo reúne en una autorización explícita los efectos locales, las tareas de Desktop Agent y la interacción del agente con el navegador integrado. Continúan las validaciones del emisor, del destino y de los argumentos, además de los bloqueos administrados y de seguridad.
- Criterios. Inicio en frío, navegación y lectura en la misma pestaña, cancelación, transferencia verificable y revocación por sesión.
- Incertidumbre. Las imágenes muestran la portada y un cierre prematuro. Sin trazas de la sesión no se puede atribuir el cierre original a una única causa.

## Decisions

- Codex documenta herramientas tipadas, progreso y aprobaciones con ciclo de vida explícito. Claude Code combina herramientas de Chrome con permisos por aplicación u origen. SofLIA conserva el navegador y los actuadores existentes, y usa sus APIs deterministas antes de delegar acciones visuales. [Codex App Server](https://openai.com/index/unlocking-the-codex-harness/) · [Claude Code con Chrome](https://code.claude.com/docs/en/chrome) · [Computer Use de Claude Code](https://code.claude.com/docs/en/computer-use)
- «Aprobar por mí» en Codex usa un revisor automático. Para el conjunto local cubierto, SofLIA utiliza reglas en main con revisión humana de los casos que quedan fuera. [Revisión automática de Codex](https://developers.openai.com/api/docs/guides/agents-api/sessions/approvals)
- El nivel de razonamiento del chat y la inferencia del actuador son llamadas distintas. La navegación y la comprobación de descargas se resuelven con datos del navegador. El actuador visual ejecuta directamente los encargos ordinarios y sólo prepara un equipo si se pide expresamente.
- Un cambio de tamaño invalida referencias visuales. Para validar el destino durante el arranque se conserva el token del documento, la pestaña y el perfil. La carga inicial tiene un plazo y Stop detiene la carga que pertenece a esa llamada.
- El orquestador de OpenAI retiene los anuncios intermedios del turno de acción y reintenta una vez si la respuesta sólo promete ejecutar. Si se queda sin texto tras una acción, devuelve el último resultado disponible y declara que el cierre sigue sin verificar.
- La vista de revisión carece de JavaScript, preload y red. Main interpreta únicamente sus controles internos y descarta respuestas tardías. El modo vive en memoria y se revoca al cambiar el documento o la sesión.
- La copia del usuario usa el portapapeles del documento. El movimiento con `no_overwrite` reserva el destino sin sobrescribir. El modo de sesión rige la revisión de las operaciones del agente.
- Main vincula la autorización de sesión a las llamadas admitidas del chat. El navegador usa el permiso sólo dentro de la operación autorizada. La política guardada del sitio y los demás usuarios del servicio conservan sus propios permisos.
- Editar o regenerar conserva el identificador original y escribe una revisión con los IDs de la rama conocida. El lector normalizado reconoce ese metadato en caché y Supabase y evita que la recuperación reenvíe esos mensajes. Se conserva la columna JSON existente y los registros de otras ramas.
