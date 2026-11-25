# Computer Use: autorización en main

Estado: vigente. Actualizado: 2026-11-25.

<!-- evidence: electron/computer-use/ipc-registration.ts -->
<!-- evidence: electron/computer-use/ipc-tools.ts -->
<!-- evidence: electron/computer-use/ipc-review.ts -->
<!-- evidence: electron/computer-use/approval-view.ts -->
<!-- evidence: electron/computer-use/permission-mode.ts -->
<!-- evidence: src/shared/computer-use-input.ts -->
<!-- evidence: electron/preload/computer-apis.ts -->
<!-- evidence: src/services/computer-use/confirmation.ts -->

## Recorrido autorizado

Los 33 canales de herramientas computer y confirm-action exigen Hub/Orbe
registrados, marco principal, documento propio y usuario main vigente.
Startup entrega getters de las ventanas reales. Registrar sin ventanas deniega;
no se acepta cualquier BrowserWindow encontrada por emisor. La revisión se
invalida con cambio de sesión, A/B/A, navegación o destrucción.

Se mantienen dispatcher de servicios, handler, allowlist, preload tipado y
wrappers del renderer. El registro usa schemas por tupla y DTO validados.
`computer:permission-mode` consulta o cambia el modo. `computer:cancel-review`
cancela la revisión vigente de la ventana autenticada.

## Entradas y aprobación

Snapshot de hasta 12 MiB UTF-8, profundidad ocho, 20000 nodos, 256 elementos por
array y 128 campos por objeto. Rechaza getters, prototipos ajenos, claves
peligrosas, ciclos y datos fuera de cuota antes de parsear. Admite undefined
en parámetros opcionales. Cada schema restringe sus campos/tipos y tamaños:
rutas 4096, comandos 20000, contenido Word 250000 caracteres; no recorta entradas
para ejecutarlas. URL conserva nombres sin esquema (servicio añade HTTPS) y
rechaza protocolos ajenos y credenciales embebidas.

Acciones con efectos piden confirmación en main: archivos/documentos/lotes,
aplicaciones/URL, comandos/procesos, portapapeles escrito, configuración/envío
SMTP y GUI distinta de screenshot. La revisión corresponde al snapshot copiado:
modificar el objeto original durante el diálogo no cambia la ejecución.

Comando y destinos se muestran completos; contenido/cuerpo/imagen largos muestran
preview marcado y digest completo. Reglas y lista de adjuntos admiten hasta
20000 caracteres serializados para poder revisarse completas. La contraseña
SMTP no aparece en el detalle ni en su digest. No se registran argumentos.

La revisión vive en una vista aislada dentro de SofLIA, sin JavaScript ni
preload, y vence en dos minutos. Escape cancela. Se admite una revisión por
ventana y una respuesta tardía no ejecuta. Se admite un trabajo por emisor y
cuatro globales, sin cola. Las plazas del servicio permanecen ocupadas mientras
su I/O siga pendiente.

El menú `+` del chat permite elegir **Aprobar por mí** o **Acceso completo**.
Aprobar por mí aplica reglas de main. Autoriza la raíz de un dominio HTTPS
ordinario sin parámetros y presenta al usuario los casos restantes. Acceso
completo exige autorización expresa en la vista de main al activarse. La
autorización cubre los efectos de Computer Use local, incluidos comandos,
archivos, portapapeles, Desktop Agent y las acciones del agente en el navegador
integrado. Main conserva la validación del emisor y de los parámetros. El
navegador sigue aplicando los bloqueos de sitios, documentos sensibles y las
restricciones administradas. Los servicios remotos mantienen sus permisos.
Main vuelve a comprobar el permiso de un clic o envío cuando el chat omitió
la revisión al detectar Acceso completo.

El permiso vive en memoria por ventana autenticada y se revoca al recargar,
cambiar de sesión, cerrar la ventana o elegir Aprobar por mí. Las tareas con
soporte para cancelación reciben una señal de revocación.

Los botones de copia de la interfaz usan el portapapeles del documento. La
herramienta `clipboard_write` se reserva para operaciones del agente.

## Compatibilidad y resultados

nativeActionReview del preload permite al renderer omitir su diálogo previo
sólo en las herramientas locales expresamente cubiertas. No omite revisión de
Desktop Agent, perfiles, host o nodos remotos. Consumidores anteriores pueden
mostrar dos confirmaciones. confirm-action sigue informando confirmado/cancelado;
always es false y no concede autorización persistente para otra llamada. Las
aprobaciones antiguas guardadas en renderer no permiten saltar main.

Progresos y resultados sólo se publican bajo la autoridad de la llamada.
Errores IPC son fijos: IPC_DENIED, INVALID_PAYLOAD, BUSY, CANCELLED o TOOL_FAILED.
El último incluye mayHaveApplied en operaciones con efectos: no se reintentan
automáticamente. No se reflejan excepciones privadas del servicio. El éxito
conserva su DTO y el servicio mantiene validaciones adicionales del dominio.

## Límites pendientes

No cancela ni revierte efectos ya admitidos por filesystem, SO, SMTP o un SDK.
Los servicios heterogéneos no ofrecen aún cancelación/revalidación uniforme en
cada espera interna; una operación admitida puede terminar tras revocación.
Un proveedor físico que no responde conserva su plaza. No ofrece cola durable,
atomicidad de lotes ni aislamiento de recursos por cuenta.

El [adaptador GUI heredado](computer-gui-backends.md) propaga la lease también a
capturas/OCR/proceso y separa datos de programas fijos, sin shell. Esa propagación
no cubre las otras herramientas heterogéneas. El canal computer:use-computer
mantiene su guarda main y sigue fuera de la allowlist del preload.

Esta guarda cubre el IPC computer, no el dispatcher invocado por rutas runtime
WhatsApp/HTTP, los canales desktop-agent ni todas las preferencias con prefijo
computer. Esas superficies tienen contratos separados. Los schemas y HITL no
prueban los otros backends del producto. No se ejecutó GUI, correo o shell
de automatización real para verificar estas unidades.

Pruebas de fuente, cuotas, carreras, contratos, servicio y consumidores usan
puertos sustituidos; no acreditan comportamiento del SO o SMTP real. Evidencia
en [el cambio](../../openspec/changes/secure-computer-use-ipc/reports/verification.md).
