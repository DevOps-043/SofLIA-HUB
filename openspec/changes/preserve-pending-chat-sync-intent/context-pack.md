# Contexto del cambio

- Objetivo: conservar la intención pendiente más reciente del chat frente a sincronizaciones solapadas o respuestas tardías.
- Usuario o actor: persona que guarda mensajes, cambia título/pin o borra conversaciones mientras otra sincronización espera red.
- Alcance: coordinador sync renderer, pasada de sincronización, reconocimiento condicional en pending-state y contratos de consumidor.
- No objetivos: transacciones/RLS nuevas, concurrencia entre dispositivos/ventanas, cambiar autorización, rehacer cache/offline ni afirmar cancelación de peticiones ya enviadas.
- Restricciones: rama acumulativa con 443 entradas dirty, worktrees ajenos preservados, sin commit/push/despliegue/SQL/.env/secretos. Sin UI/captura ni vía alternativa para la revisión visual bloqueada anteriormente.
- Contratos afectados: misma firma pública syncPendingChatState y mismos DTO/formato localStorage; clear internos reciben el contenido esperado y confirman escritura local. Sin IPC, dependencias o tablas nuevas.
- Riesgo y HITL: servicios remotos sustituidos por promesas controladas, datos ficticios y storage de prueba. Prioridad de borrados/lápidas y rechazo de otra identidad se conservan. Ninguna mutación real.
- Criterios verificables: una pasada activa y como máximo una pendiente fusionada por identidad; scopes dirigidos unidos sin ampliar a toda la cola salvo solicitud global; respuestas anteriores no retiran ni publican otro contenido; comprobar vigencia antes de cada efecto y después de esperar; fallo transitorio conserva, permanente retira sólo el contenido vigente; fallo de persistencia no acredita retirada; errores liberan coordinación, identidades distintas no se bloquean.
- Incertidumbres: las peticiones enviadas pueden tener efecto antes de la siguiente pasada; falta CAS/versionado de servidor para otros renderers/equipos. localStorage sin transacciones entre ventanas ni garantía ante fallo/cuota. La forma de recuperación de payloads corruptos no cambia.
