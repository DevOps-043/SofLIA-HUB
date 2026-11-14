# Diseño de aislamiento y continuidad

## Decisiones

DEC-CHAT-ISO-001: el gestor asigna un UUID al borrador antes de enviar. Ese UUID es su futuro conversationId y se conserva al persistir; navegar o crear otro borrador cambia la identidad. El primer snapshot válido crea la conversación y encola mensajes localmente antes de iniciar inferencia. La sincronización remota no bloquea esa garantía.

DEC-CHAT-ISO-002: los handlers y snapshots se registran por identidad estable, nunca durante render como una única ref reemplazable. Flush espera todos los destinos pendientes. Los placeholders no se persisten ni impiden guardar el mensaje del usuario. Un resultado del origen puede persistirse aunque ya no sea el chat visible; cambiar usuario/organización invalida sus publicaciones.

DEC-CHAT-ISO-003: Skill y panel llevan conversationId. El render rechaza combinaciones de otro origen y la reanudación limpia inmediatamente al navegar. Cada activación tiene generación propia; navegación, desactivación y desmontaje descartan resultados tardíos. El enlace de workspaces legados requiere identidad explícita del borrador; no se infiere del cambio null → id.

DEC-CHAT-ISO-004: se extiende el contrato existente background-teams:start con un workspace de presentación opcional. Main verifica que pertenece a la conversación y a Presentaciones; sólo el coordinador recibe herramientas de workspace, ligadas al job. Especialistas producen aportes independientes. El coordinador escribe y relee deck.json, el host valida esquema y archivos y materializa un PowerPoint comprobado. No se conceden shell, acciones externas ni observación continua. La navegación no controla el job; cancelar/logout/revocación sí lo interrumpen.

DEC-CHAT-ISO-005: el chat conserva un acuse durable con jobId antes de abandonar su turno. Una admisión main que termine después de navegar sigue actualizando sólo el mensaje de origen. No se reintenta ciegamente ante una respuesta de admisión incierta; requestId identifica el mensaje del turno. Volver al origen muestra progreso/resultado del mismo job.

DEC-CHAT-ISO-006: externalPrompt atraviesa el mismo controlador de generación que enviar/editar/regenerar. La memoria semántica del chat consulta sólo su sesión; preferencias y skills aprendidas del propietario siguen siendo durables. Los eventos y tarjetas declaran conversación/mensaje de origen y distinguen preparación del turno de ejecución durable.

## Compatibilidad y riesgos

Los campos nuevos son opcionales para trabajos/eventos históricos. La ausencia de procedencia se muestra como origen no disponible y no se adivina. No se reasocian chats por título. Los cachés conservan conversaciones propias ausentes de una respuesta parcial, aplicando organización y tombstones; no se recuperan shares revocados como propios.

Las presentaciones con fuentes visibles reúnen primero la observación puntual autorizada y después delegan el contexto capturado. Un presupuesto agotado o un proveedor fallido deja estado incompleto y archivos existentes, sin declarar éxito. No se permite editar el mismo workspace con dos trabajos activos. La verificación usa archivos y hashes, sin prometer revisión visual no ejecutada.

## Verificación y reversión

Las seis reproducciones se convierten en regresiones normales. Se agregan pruebas con promesas controladas para A/B/A, persistencia sin red, colas múltiples, admisión tardía, workspace ajeno, logout y cancelación tardía. Se ejecutan typecheck, lint, harness, documentación y verify:pr; se comparan fallos preexistentes con la línea base.

La reversión retira la admisión de presentaciones nuevas, conserva jobs cifrados y workspaces y mantiene lectura de formatos históricos. No borra conversaciones ni archivos.
