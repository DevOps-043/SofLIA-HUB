# Custodia y sesión de nodos remotos

Estado: vigente. Actualizado: 2026-10-26.

<!-- evidence: electron/remote-node/state-store.ts -->
<!-- evidence: electron/remote-node/session-state.ts -->
<!-- evidence: electron/remote-node/host-server.ts -->
<!-- evidence: src/components/ops/automation-ops-panel/useRemoteNodeData.ts -->

## Almacenamiento y recuperación

Cada identidad main utiliza `remote-node-credentials/<sha256 del userId>.bin`
bajo userData. El formato contiene versión, propietario exacto, configuración
y registros cifrados con safeStorage asíncrono. Reutiliza la custodia del SO y
publicación atómica del proyecto; Linux rechaza basic_text/unknown. No hay
fallback plano ni al directorio de trabajo. Sin llavero seguro, habilítalo y
vuelve a iniciar sesión; no se inicia un host con defaults ante corrupción.

Antes de importar, `remote-node-state.json` se reemplaza por un archivo cifrado
con cabecera de legado que conserva todo el objeto admitido. Sólo se restauran
nodos con owner_user_id exacto y datos válidos. El host sin propietario y los
nodos huérfanos no se asignan automáticamente: el panel informa que requieren
nuevo emparejamiento. Registros ajenos permanecen preservados y no se muestran.
Un perfil privado existente, incluso vacío o inválido, impide reimportación.
No borres el archivo preservado para resolver un error; conserva una copia
cifrada y revisa la versión compatible o vuelve a emparejar el equipo.

El host nuevo empieza apagado y con token nuevo. El panel permite seleccionar
y copiar su token desde un campo de contraseña de sólo lectura. El registro y
la habilitación conservan confirmación nativa. La migración no puede convertir
un token histórico en prueba de propiedad ni recuperar el llavero de otro SO.

## Sesión y persistencia

Todas las operaciones del servicio, incluidas las llamadas desde runtime main,
derivan identidad de main. Un propietario aportado por renderer sólo se acepta
si coincide. Logout o A/B/A invalidan autoridad, revisiones y transporte; una
carga anterior no publica sobre la nueva identidad. El host anterior pierde
autoridad inmediatamente y sus conexiones se cierran; cambiar identidad fuerza
reinicio aunque interfaz y puerto coincidan. El cierre de aplicación revoca el
servicio sin esperar una importación dinámica adicional.

Las mutaciones se serializan sobre copias y publican RAM sólo tras persistir.
Un error previo al reemplazo conserva archivo y RAM anteriores. La cola del
almacén ordena migración, cargas y escrituras incluso entre A/B/A. Un rename ya
admitido puede terminar después de revocar; permanece ligado al propietario
original y termina antes de una carga posterior. No se promete rollback físico.
La cola pertenece a la instancia del almacén en este proceso; no es un bloqueo
entre procesos independientes.
Metadata de salud se guarda desde una copia: fallo/revocación no publica datos
que no fueron confirmados. Listados no exponen referencias mutables internas.

El panel retira caché, borrador de token y captura al cambiar identidad y
descarta respuestas/setters de otra revisión, incluido A/B/A y StrictMode. Las respuestas conversacionales
mantienen la proyección sin campo token; la API manual conserva emparejamiento.

## Host y límites

El host exige perfil habilitado, identidad vigente y bearer válido. Revalida
después de leer cuerpo, antes del efecto y antes de responder. Rotar token o
revocar sesión invalida peticiones anteriores; las tareas reciben la señal.
No revierte efectos ya enviados. Cuerpo hasta 128 KiB y lectura hasta 15 s;
headers/request 10/15 s, keepalive 1 s, ocho conexiones, 32 headers y 32
peticiones por socket. Schemas de acciones compartidos con IPC.

Perfil/legado hasta 4 MiB; 256 nodos por perfil y 4096 registros preservados en
legado; campos según state-contract.ts. Cuotas salientes y revisión humana:
[integración IPC](../architecture/ipc-and-integrations.md#contratos-de-automatización)
y [parámetros](../architecture/runtime-parameters.md#nodos-remotos-ipc-y-transporte-saliente).

## Límites de la garantía

Las pruebas usan archivos temporales propios y cifrado AES-GCM de prueba; la
integración productiva reutiliza os-cipher. No acreditan el llavero nativo ni UI
de esta unidad. El cifrado del SO no protege de malware con la autoridad del
mismo usuario del SO. No acredita roles/RLS remotos ni membresía organizacional;
visibility sigue siendo metadata y no concede acceso entre propietarios.
La posesión del bearer en el equipo receptor conserva la autoridad de
emparejamiento existente: no hay nueva identidad criptográfica del cliente ni
HITL local por cada petición HTTP. Sigue pendiente endurecer esa política y
otras APIs de Computer Use/Desktop Agent. No sanea secretos arbitrarios en
respuestas de terceros. Revisión independiente del cambio pendiente.
