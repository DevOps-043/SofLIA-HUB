# Retirada de Project Hub

Estado: integración retirada del código de Soflia Hub. Actualizado: 2026-10-19.

La integración anterior de Project Hub/IRIS se retira para preparar un diseño nuevo. Esta entrega no implementa todavía la fusión.

Se eliminaron la vista externa, el cliente REST, el canje de tokens, los canales `project-hub:*`, las herramientas de proyectos en chat/WhatsApp y la publicación de reuniones. El arranque ya no comprueba ni inicia Project Hub. El navegador no le entrega la sesión SOFIA ni lo ofrece como acceso del ecosistema.

Las carpetas de proyectos, chats y fuentes permanecen en Lia y conservan su vista existente. El nombre interno `ProjectHub` de ese componente corresponde a carpetas locales; no es el cliente externo retirado. Meeting Ops conserva transcripciones, minutas, compromisos, aprobación y acciones históricas, sin publicación externa ni nuevos borradores de exportación.

La identidad compartida queda en `electron/sofia/`: cliente SOFIA, identificación por teléfono y consultas de usuarios. El archivo local `whatsapp-iris-sessions.json` conserva su nombre para leer las sesiones existentes sin mover ni borrar datos.

No se ejecutaron migraciones ni se modificaron datos, secretos o el repositorio Project Hub. Las migraciones y snapshots anteriores permanecen como historial. Se retiró del código la función de outbox; una instancia remota ya desplegada queda fuera de esta entrega y requiere una intervención operativa autorizada.

Evidencia y alcance: [cambio de retirada](../../openspec/changes/remove-project-hub-integration/proposal.md). La propuesta `integrate-project-hub-api` describe el estado anterior, sustituido por esta retirada. Rollback: revertir el cambio Git.
