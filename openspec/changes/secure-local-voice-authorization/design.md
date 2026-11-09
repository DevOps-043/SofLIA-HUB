## Context

Ver context-pack/propuesta. Los dos procesos Python y la cancelación por generación ya están verificados. La autorización debe cerrar ajustes, Orbe y restauración; una preferencia enabled no constituye consentimiento. Main conoce identidad mínima y emite cambios A/B/A; no se atribuye a ese estado verificación adicional de identidad del servidor.

## Goals / Non-Goals

**Goals:** autorización consistente hasta el comando nativo, consentimiento efímero revocable, DTOs mínimos y eventos dirigidos, manteniendo los consumidores.

**Non-Goals:** nuevas herramientas, cambios en protocolo Python, autorización Meeting Live, custodia por usuario de preferencias de máquina, hashes/atomicidad/cancelación transaccional de instalaciones ya aprobadas, rotación de secretos o despliegue.

## Decisions

- Reutilizar trustedAppCaller/nativeConfirmation. Ajustes sólo main; dictado/conversación sólo Orbe; síntesis/reproducción main u Orbe según consumidor. Exactitud de objeto WebContents/marco, documento, aridad y sesión, no IDs declarados por payload. Falta de proveedor deniega.
- Coordinador de voz único en main, pasado explícitamente al registro Orbe. Runtime instala guardia deny por defecto para start_wake/start_dictation/mic_probe, también al usar sendCommand directamente. La guardia no se expone por IPC. Los tests que simulan voz autorizada declaran una guardia ficticia explícita.
- Consentimientos locales de sesión/configuración para pasiva/dictado; pasiva aprobada cubre wake/dictado y reanudación del mismo usuario y dispositivo/modelo/palabras. Probe es autorización temporal por llamada de 3 s. Logout/cambio A/B/A revoca todo antes de detener el hijo; callbacks no reactivan sin grant. Detener/deshabilitar revoca intención pendiente sin diálogo.
- Enabled y preferencias heredadas siguen siendo de máquina, no se adjudican a usuarios ni conceden captura. Tras autenticar, main puede pedir revisión nativa si enabled estaba guardado y hay ventana válida; restauración usa contexto main explícito, nunca un evento IPC fabricado. Cancelación mantiene inactiva la voz; UI ofrece activar en la sesión. El grant permite ejecución en segundo plano de la sesión, no se persiste y no cruza cambios de usuario.
- Configuración y opciones se copian/validan antes de revisión. Micrófono null/índice 0–65535/nombre hasta 512; hasta diez wakeWords de 64; velocidad 0.5–2; voz/paths acotados y sin controles. ModelPath sólo absoluto local bajo revisión cuando puede activar captura. Instalar sólo small/large y cuatro IDs Piper existentes. No convertir valores desconocidos en defaults. Texto de voz hasta 5000 y IDs de sesión propios hasta 200; sin transporte genérico.
- Cambios que inician/reinician captura piden HITL con usuario, configuración y alcance. Instalaciones siempre piden HITL antes de invocar. Preferencias reversibles sin captura y detener no abren permisos adicionales. Un efecto ya aprobado e invocado que pierde contexto devuelve uncertain/recoveryRequired; no se reintenta ni promete rollback de archivos/modelos.
- Eventos de dictado/Piper se vinculan a IDs creados por main antes de las esperas. Sólo se entregan al consumidor vigente propietario; reemplazar una voz termina la anterior sin broadcast. Cambios de sesión limpian vínculos/anuncios/wake pendientes. Orbe oculta no inicia ni recibe dictado; su control de detener sigue disponible.
- DTO público sustituye pythonPath/modelPath por modelInstalled y approvalRequired; no devuelve paths o errores remotos crudos. Contratos compartidos en src/shared; wrapper/preload tipados. Síntesis remota conserva proveedor y agrega assert/señal y lectura real acotada de respuesta/error, sin repetir solicitudes.
- Invalidación de una captura en vuelo puede requerir parar el hijo compartido; debe comunicarse indisponibilidad a Meeting Live para evitar pérdida silenciosa, sin conceder permisos ni cambiar captura renderer de reuniones.

## Risks / Trade-offs

Restaurar enabled requiere aprobación nueva por sesión: cambio deliberado frente a captura automática previa al login. Revocar un comando enviado no garantiza rollback; detener el hijo interrumpe consumidores locales compartidos y se informa. No se certifica detener descendientes del SO ni se valida semántica completa de modelos/audio. Preferencias globales y descargas siguen en su política existente; el grant de captura es independiente. Una confirmación nativa puede seguir visible hasta cerrarse; conserva exclusión y rechaza respuestas tardías.

## Migration Plan

Baseline y pruebas rojas; contratos/coordinador/guardia; handlers/cableado, routing y contexto de síntesis; cuatro capas/UI; pruebas dirigidas y nativas aisladas; docs, tipos/lint/build/gate y autorrevisión. Revertir todas las capas juntas conserva dieciséis unidades previas pero reabre captura no autorizada. No migraciones ni edición de perfiles; revisión independiente antes de archivar.
