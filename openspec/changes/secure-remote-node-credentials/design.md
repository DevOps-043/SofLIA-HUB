## Context

Ver [propuesta](proposal.md) y [contexto](context-pack.md). El lote 39 protege IPC, pero el servicio comparte JSON/RAM/host entre usuarios y publica antes de confirmar escritura.

## Goals / Non-Goals

Cerrar custodia y sesión en el servicio completo, manteniendo sus APIs y los 13 canales. Sin atribuir ownership criptográfico histórico al legado ni roles/RLS remotos; no reasignar huérfanos.

## Decisions

- Reutilizar os-cipher/private-files, con formato versionado por propietario y nombre SHA-256. Hasta 4 MiB por archivo y 256 nodos por perfil, schemas para campos y propietarios exactos. Error seguro sin fallback ni sobreescritura de corrupción.
- Reemplazar el JSON legado por archivo cifrado con cabecera propia que conserva todo el objeto. Cola del almacén serializa migración, lectura y escritura, también A/B/A. Importar sólo owner_user_id coincidente; perfiles existentes ganan. No reutilizar host sin propietario ni borrar el archivo preservado.
- Módulo de sesión separado: invalida inmediatamente identidad y configuración anteriores, espera restauración y serializa mutaciones sobre copias. Guardar antes de publicar. Mantener objeto de estado estable dentro de la identidad para que el host vea configuración confirmada, y reemplazarlo al cambiar cuenta.
- Servicio deriva identidad para renderer y runtime main; propietario enviado sólo se acepta si coincide. Metadata HTTP usa copia del nodo y callback de persistencia async, sin modificar RAM antes de confirmar. Revisión de configuración async sin cambiar canales; mantener el HITL previo.
- Host nuevo apagado, contexto/signal de identidad obligatorios y reinicio si cambia el objeto de estado aun con mismo binding. Revocar conexiones al cambiar cuenta, comprobar después de leer cuerpo y antes/después de efectos; señal interna a tarea. Cuerpo hasta 128 KiB, tiempo de lectura 15 s, ocho conexiones y cuotas HTTP locales.
- Aviso aditivo de migración en status/panel, sin API para extraer archivo legado ni revelar registros ajenos. Fallo de llavero pide activarlo y volver a iniciar sesión.
- La revisión del consumidor detectó caché, borrador de credencial y captura sin revisión de identidad. Hooks cohesivos del panel retiran datos al cambiar usuario y descartan setters/respuestas A/B/A y StrictMode; no se modifica la autoridad main ni otras integraciones del panel.

## Risks / Trade-offs

- Registro sin owner → conservar cifrado y re-emparejar, sin inventar propietario.
- Rename admitido antes de revocación puede terminar → archivo ligado a owner y cola del almacén antes de cargas/escrituras posteriores; sin promesa de rollback físico.
- Efectos externos ya enviados → señal/invalidación bloquean nuevas fases y resultados, sin revertir terceros.
- Llavero bloqueado o dato excesivo → rechazo y preservación, sin defaults que borren evidencia ni listener activo.

## Migration Plan

Respaldos relativos contra unidad 39, pruebas previas/finales de almacén/sesión/host y consumidores con archivos propios. Una compuerta final con cobertura/build sobre hashes congelados. Revertir sólo código del lote; datos runtime cifrados requieren versión compatible, no se degradan a plano. Sin secretos reales, GUI, sockets/cuentas reales ni despliegue. Revisión independiente pendiente.
