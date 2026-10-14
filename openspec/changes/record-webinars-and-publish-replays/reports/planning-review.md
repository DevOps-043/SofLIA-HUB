# Revisión de la planificación

Estado: propuesta validada; implementación no iniciada. Fecha: 2026-10-13.

## Verificación

- Fuentes oficiales Zoom, Google, Microsoft y Supabase consultadas; enlaces y
  separación entre capacidad documentada y cuenta real registrados en research.md.
- Backend Learning y runtime Hub inspeccionados sin leer secretos ni `.env`;
  no se llamó a Zoom administrativo ni se modificó configuración remota.
- OpenSpec declara tres capacidades nuevas, diseño y tareas coordinadas. Todas
  las tareas de implementación permanecen pendientes.
- `openspec validate record-webinars-and-publish-replays --strict --no-interactive`:
  correcto inicialmente y después de revisión; status confirma 4/4 artefactos completos.
- `npm run docs:check` y `npm run harness:validate`: correctos inicialmente y
  después de revisión; 529 documentos con enlaces válidos y arnés válido.
- `git diff --check` focalizado en el índice y este cambio: correcto.
- No se ejecutaron pruebas de producto ni se abrieron ventanas QA: solo cambian
  artefactos de planificación y su enlace documental. No se declara implementada
  grabación ni publicación por escribir este plan.

## Revisión adversarial

| Hipótesis intentada | Resolución del plan |
| --- | --- |
| El archivo private hace privada la grabación aunque Zoom envíe links | Preflight incluye privacidad/on-demand/notificaciones del proveedor; no se confía solo en Storage/RLS propio |
| Cualquier completed permite publicar | Se espera fin, reconciliación y edición completa; no se publica el primer segmento ni el ensayo |
| Retirar durante importación puede perderse | Intención/revisión/CAS vigentes; reintento de importación no republica una edición retirada |
| Reserva de programación ya exitosa garantiza auto recording | Readback también en fast path idempotente; backfill independiente para pendientes anteriores |
| ID numérico identifica siempre el mismo webinar | Cuenta, tipo, host y UUID de ejecución; archivo/idempotencia por instancia |
| Download token dura indefinidamente | Autorización nueva por API; headers y checkpoints, sin secretos en URLs/renderer |
| Un webhook confiable puede contener URL de descarga arbitraria | Validación de URL y cada redirect; no propagar credenciales a otro host |
| Captura depende de mantener Hub abierto | El proveedor captura; ledger/worker importan independientemente del escritorio |
| Grabar todos equivale a publicar todos | Dos estados y permisos distintos; opción de repetición off por defecto |
| Una intención previa autoriza un vídeo con huecos | Ediciones degradadas se revisan explícitamente antes de exponerlas |
| Materiales de clase sirven para webinars de varias horas | Archivo y retención dedicados, transferencia reanudable y medición; no contrato de 25 MB |
| Retirar una URL firmada revoca bytes instantáneamente | Vigencia declarada y renovación autorizada; entrega autenticada si se exige control por petición |

## Riesgo residual y siguiente paso

La licencia, scopes, cuotas, layouts y comportamiento efectivo de la cuenta no
están verificados. El primer entregable de implementación es una PoC privada de
staging y su preflight, con autorización para acciones remotas. Si cloud no está
disponible, revisar la arquitectura antes de programar un fallback local.
No se probaron llamadas Zoom reales ni capacidad/costos de producción.
Se conserva el worktree con todos sus cambios previos/concurrentes; no se hicieron
commits, staging, reset, migraciones, despliegue ni envío de mensajes externos.
