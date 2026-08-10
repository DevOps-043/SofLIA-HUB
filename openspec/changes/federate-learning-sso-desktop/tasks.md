Las tareas marcadas **[Learning]** se implementan en el repositorio `SofLIA-Learning`; el resto en el Hub. Las de Learning van primero porque el cliente no puede verificarse contra un backend inexistente.

## 1. Datos

- [x] 1.1 Escribir la migración de la tabla de tickets de escritorio en el proyecto SOFIA: hash del ticket con índice único, desafío, `user_id` referenciando `auth.users` con borrado en cascada, expiración, marca de consumo y metadatos de auditoría. Idempotente con `IF NOT EXISTS` y con bloque de rollback comentado, siguiendo el formato de `database/sofia-learning/migrations/auth-supabase-hub.sql`.
- [x] 1.2 Habilitar RLS en la tabla sin declarar ninguna política, y dejar en el encabezado del archivo la nota de por qué: solo `service_role` la usa y la postura por defecto debe ser negar.
- [x] 1.3 Registrar la migración en `database/sofia-learning/migrations/` y añadir su gemela en el directorio de migraciones de Learning. Verificación: aplicar en un entorno de prueba dos veces seguidas y comprobar que el segundo paso no falla ni duplica objetos.

## 2. Learning — emisión del ticket

- [x] 2.1 **[Learning]** Añadir el modo escritorio al punto de entrada de autenticación: acepta `state` y `code_challenge`, los guarda en una cookie `httpOnly` de vida corta, y no los propaga por la URL durante el resto del flujo.
- [x] 2.2 **[Learning]** Crear el servicio de tickets con generación aleatoria criptográfica, almacenamiento del hash —nunca del valor— y consumo atómico mediante `UPDATE ... WHERE consumed_at IS NULL AND expires_at > now() RETURNING`, reusando las convenciones de `refresh-token.helpers.ts`.
- [x] 2.3 **[Learning]** Enganchar la emisión al cierre del callback OAuth existente: si la cookie de modo escritorio está presente, emitir el ticket para el usuario ya autenticado y redirigir a `soflia://auth/callback` en lugar del destino web habitual. La URL de destino se construye en el servidor y ningún parámetro del cliente puede influir en ella.
- [x] 2.4 **[Learning]** Verificar que el flujo web normal no cambió: sin la cookie de modo escritorio, el callback redirige exactamente como antes.

## 3. Learning — endpoint de canje

- [x] 3.1 **[Learning]** Crear el endpoint de canje que recibe ticket y verificador, resuelve la fila por hash, valida expiración y consumo, y compara el desafío con el verificador en tiempo constante.
- [x] 3.2 **[Learning]** Comprobar membresía activa del usuario del ticket antes de generar cualquier acceso, y denegar sin emitir cuando no la haya.
- [x] 3.3 **[Learning]** Generar el enlace mágico con el cliente administrativo y devolver únicamente su `hashed_token`, con cabeceras que impidan caché.
- [x] 3.4 **[Learning]** Unificar los fallos de ticket en un único código indistinguible y exponer solo los tres códigos estables del diseño. Verificación: ticket inexistente, expirado, reutilizado y con verificador incorrecto producen respuestas idénticas.
- [x] 3.5 **[Learning]** Aplicar el limitador de intentos existente al endpoint y confirmar que ningún registro incluye ticket, verificador, `hashed_token` ni correo.

## 4. Hub — protocolo y proceso principal

- [x] 4.1 Añadir el comando de callback de autenticación a `parseAppProtocolCommand` en `electron/app-protocol.ts`, con su tipo en `electron/app-protocol/types.ts`, extrayendo ticket y `state`.
- [x] 4.2 Enrutar el comando en las tres entradas: `second-instance` en `electron/main/app-lifecycle.ts`, arranque en frío en `electron/main/bootstrap.ts`, y un manejador `open-url` nuevo para macOS, que hoy no existe.
- [x] 4.3 Retener el callback en el estado del proceso principal cuando el renderer aún no esté suscrito y entregarlo al suscribirse, siguiendo el patrón de los comandos de protocolo existentes.
- [x] 4.4 Añadir el servicio que abre la URL de inicio en el navegador del sistema. Verificación: no se usa el navegador integrado en ningún punto del flujo.

## 5. Hub — IPC

- [x] 5.1 Crear el canal de inicio del flujo federado con su handler, siguiendo la cadena completa de `docs/standards/electron-ipc.md`.
- [x] 5.2 Crear el canal de entrega del callback al renderer y su suscripción.
- [x] 5.3 Añadir ambos canales a la allowlist de preload y a los casos de `electron/__tests__/preload/channel-cases.ts`.
- [x] 5.4 Exponer los wrappers tipados del renderer. Verificación: `npm run typecheck` limpio y los canales aparecen en las pruebas de preload.

## 6. Hub — canje y sesión

- [x] 6.1 Implementar la generación del verificador y del desafío en el renderer, con `state` de correlación. El verificador no se escribe a disco ni cruza al proceso principal.
- [x] 6.2 Implementar el servicio de canje contra Learning reusando la taxonomía de errores y la política de reintento de `src/services/lia-session-exchange.ts`: sin reintento en 401 y 403, con reintento acotado en 5xx y red.
- [x] 6.3 Canjear el `hashed_token` con `verifyOtp` sobre el cliente SOFIA y confirmar que la sesión resultante es equivalente a la del inicio por contraseña.
- [x] 6.4 Reutilizar el post-login existente sin duplicarlo: perfil, `buildActiveSofiaContext`, sesión almacenada y `ensureLiaSession`. Extraer esa secuencia de `signInWithSofia` a una función compartida si es necesario, sin cambiar su comportamiento.
- [x] 6.5 Descartar un callback cuyo `state` no corresponda a una solicitud viva de esta instancia, sin alterar el estado de sesión.
- [x] 6.6 Cerrar cualquier sesión parcial cuando la autorización falle, igual que hace hoy el camino de contraseña ante falta de membresía.

## 7. Hub — interfaz y reversibilidad

- [x] 7.1 Añadir la entrada federada en `src/components/Auth.tsx` junto al formulario actual, con estados de espera, error y reintento en lenguaje no técnico.
- [x] 7.2 Añadir el interruptor de configuración y la URL base de Learning en `src/config.ts`, sin introducir ningún secreto.
- [x] 7.3 Con el interruptor apagado, ocultar la entrada e ignorar los callbacks de este flujo. Verificación: el inicio por contraseña se comporta exactamente igual que antes del cambio.

## 8. Pruebas

- [x] 8.1 Pruebas del parser de protocolo: callback válido, sin ticket, con esquema ajeno y con host desconocido.
- [x] 8.2 Pruebas del servicio de canje: éxito, ticket inválido, acceso denegado, fallo transitorio con reintento y fallo definitivo sin reintento.
- [x] 8.3 Pruebas del contexto de autenticación: sesión establecida por la vía federada, `state` no correlacionado, y autorización denegada sin dejar sesión.
- [x] 8.4 **[Learning]** Pruebas del endpoint de canje: los cuatro fallos de ticket son indistinguibles, dos canjes concurrentes emiten a lo sumo uno, y la falta de membresía deniega antes de generar acceso.
- [x] 8.5 Ejecutar `npm run typecheck` y `npm run test` en el Hub, y la suite equivalente en Learning.

## 9. Documentación

- [x] 9.1 Actualizar `docs/operations/configuration.md` con el interruptor y la URL base, indicando el efecto de su ausencia.
- [x] 9.2 Documentar el flujo en `docs/architecture/ipc-and-integrations.md` con los canales nuevos y el comando de protocolo.
- [x] 9.3 Añadir a `docs/security/security-and-privacy.md` el modelo de amenaza del retorno por esquema propio y por qué el ticket es inservible aislado.
- [x] 9.4 Registrar en `docs/operations/auth-migration.md` que las cuentas creadas por SSO no tienen contraseña, que esta es su vía de acceso al escritorio y que el inicio por WhatsApp sigue pendiente para ellas.
- [x] 9.5 Actualizar `CHANGELOG.md`.

## 10. Verificación y cierre

- [ ] 10.1 Ejecutar la verificación manual del despliegue con cuentas controladas según el plan de migración del diseño, y registrar la evidencia en `reports/`.
- [x] 10.2 Confirmar en una revisión de registros que ni el Hub ni Learning emiten ticket, verificador, `hashed_token` o correo en sus trazas.
- [ ] 10.3 Ejecutar la skill `adversarial-review` sobre el cambio completo, con foco en secuestro del retorno, reutilización del ticket, redirección abierta y estados de sesión parciales.
- [ ] 10.4 Ejecutar `npm run verify:pr` y preparar la entrega con `prepare-pull-request` en ambos repositorios, dejando explícito el orden de despliegue: Learning primero, Hub con el interruptor apagado, encendido al final.
