# Validación de cuentas, marcas y carpetas

Fecha: 2026-10-24. Complementa el [reporte de proveedores](provider-verification.md).

## Cambios verificados

- Google Drive y OneDrive quedan deshabilitados mientras se comprueban las cuentas y cuando no están vinculadas. Se muestra «Inicia sesión para continuar» y una indicación de Ajustes > Conexiones.
- Recursos oficiales empaquetados, sin peticiones de imágenes durante el uso; procedencia en `public/brands/README.md`.
- Crear carpeta dentro del selector remoto mediante `create-cloud-folder`, selección opaca, validación de nombre y guardas de cuenta. El selector local conserva `openDirectory/createDirectory`. No hay reintento automático de escrituras remotas.
- Reintento explícito de negocio local después de un rechazo confirmado: conserva la operación y sólo reutiliza la carpeta preparada cuyo destino y manifiesto coinciden exactamente. Una edición o un resultado incierto impide reutilizarla.
- El error HTTP 422 `TEAM_REQUIRED` tiene explicación local segura. Otros rechazos incluyen el estado HTTP; no se presentan mensajes ni detalles arbitrarios del servidor. El cuerpo de error reconocido se limita a 16 KiB.

## Evidencia

- 123 pruebas focalizadas aprobadas, cero fallos: UI del modal, servicio de creación, nube, contrato IPC de cuatro capas, bridge, transporte y HTTP loopback.
- Lint incremental: 43 archivos revisados sin deuda nueva.
- Smoke Electron correcto con cuentas simuladas: logos, opciones deshabilitadas, formulario de nueva carpeta, temas, 320 px, zoom 200 %, foco y creación. No usa cuentas reales ni escribe en proveedores.
- La compuerta `verify:pr` pasó arnés, documentación, inventario, supply chain, OpenSpec y pruebas de calidad; se detuvo en el diagnóstico preexistente `electron/gmail/raw-message.ts:19` de `newline`. No se oculta el bloqueo ni se declara aprobada la compuerta global.

## Rechazo real todavía sin confirmar

Actualización: la aclaración del usuario y la corrección preparada de la API se documentan en [Espacio automático de la organización](organization-space.md). La precondición de equipo se retiró para los proyectos sin equipo explícito; falta publicar ese cambio. No se necesita crear otro espacio ni un equipo manualmente.

La captura no contiene estado HTTP ni código de dominio. La petición `{ name, priority, tags }` coincide con `createProjectSchema` del [servidor público](https://github.com/DevOps-043/Project-Hub/blob/main/apps/web/src/lib/api-v1/schemas.ts). Su [resolución de equipo](https://github.com/DevOps-043/Project-Hub/blob/main/apps/web/src/lib/api-v1/auth.ts) exige un equipo activo y puede devolver `TEAM_REQUIRED`/422. Esta es una causa posible, no una comprobación sobre la cuenta del usuario ni el despliegue efectivo.

Se solicitó confirmar si existe un equipo activo. No se crearon equipos ni se cambió el servidor para eludir esa precondición. La creación original en la cuenta real no se declara resuelta por haber aprobado pruebas con dobles. Para cerrarla hace falta el código seguro del siguiente rechazo o la confirmación de la precondición.

## Revisión adversarial

Se intentó reutilizar una operación de otro usuario, introducir una ruta como nombre, repetir una creación remota y reutilizar un manifiesto editado; las pruebas rechazan esos casos. El transporte descarta detalles remotos incluso cuando el código es conocido y descarta cuerpos excesivos. Persiste la falta de transacción entre proveedor, disco y API; los resultados inciertos requieren revisión humana.
