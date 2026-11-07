# Verificación de la frontera documental Python

Estado: implementación, pruebas dirigidas, compuerta PR y build aprobados.
Revisión independiente pendiente antes de archivar.
Fecha local: 2026-10-23. Rama: codex/reduce-technical-debt.

## Alcance

Cinco IPC con caller main, contexto vigente y contrato cerrado. Selección nativa
sin rutas renderer, snapshot privado estable, cuotas y limpieza propia. DTO
compartido y proyectado, privacidad persistida/revisada sin falso éxito y UI
con alcance por patrones. Word y Office protegidos fallan sin respaldo crudo;
Python redacta también etiquetas sheet. Los dos IPC desktop-context revalidan
contexto e inventario de sesión. Se preservan voz y los lectores internos.

No hay dependencias, canales, herramientas runtime ni SQL nuevos. No se usaron
perfiles, documentos ni cuentas reales; sin deployment/commit/push. Se conservan
las diecisiete unidades anteriores del worktree. La firma renderer
`parseDocument()` cambia expresamente a cero argumentos; no había consumidor de
producción de rutas. El preload transmite argumentos inesperados para que main
los rechace, sin ignorarlos silenciosamente.

## Matriz y resultados dirigidos

| Criterio | Evidencia |
| --- | --- |
| Actor, ventana, marco, documento, aridad y rechazo previo a efectos | python-tools-ipc.test.ts |
| Sesión A/B/A, selector pendiente exclusivo y política cambiada | python-tools-ipc.test.ts |
| Copia estable, firma, extensión, cuotas, cancelación y cierre fallido | python-document-snapshot.test.ts |
| Configuración ilegible, fallo de disco, colisión, commit incierto, A/B/A | python-privacy-store.test.ts y python-tools-service.test.ts |
| Unicode, cuotas acumuladas, proyección y metadata de redacción | python-tools-contract.test.ts |
| Hijo antiguo no altera estado nuevo; timeout y cleanup diferido | python-tools-contract.test.ts y suites sidecar |
| DOCX sin respaldo crudo; compatibilidad sin protección | python-protected-readers.test.ts |
| Office sin imagen ni UIA después de fallo protegido | desktop-context-cascade.test.ts |
| Inventario retirado y respuesta obsoleta descartada | desktop-context-handlers.test.ts |
| Carga desconocida, guardado incierto y descarte al desmontar | PrivacySettings.test.tsx |
| XLSX/DOCX reales ficticios, etiquetas/PII y lector concurrente | python/tools_sidecar/tests/test_documents_privacy.py |
| Cinco fachadas, allowlist e IPC real Electron | native-ipc.json |

Baseline dirigido: 84 casos en seis archivos. La ejecución ampliada terminó con
150 casos aprobados en 13 archivos; después del ajuste del montaje UI, sus dos
suites de UI/store se repitieron con 16 casos aprobados. Tipos y lint enfocado
pasaron. La compuerta final aprobó 5449 casos y mantiene cinco omitidos en
243.56 segundos: 493 archivos aprobados y dos omitidos. Las once etapas de
verify:pr terminaron con exit 0. Lint incremental revisó 262 archivos sin
incidencias nuevas; documentación validó 675 Markdown activos, 28 documentos
de sistema, 150 IDs, 665 archivos de prueba y 495 canales. Ver gate-summary.json.

Las diez pruebas Python se ejecutaron por funciones con runpy/inspect y
TemporaryDirectory para tmp_path, bajo Python QA 3.12.14, opción -B, variable
PYTHONDONTWRITEBYTECODE=1 heredada al hijo y sin pytest instalado. El test de
stdio usa sys.executable, evitando una ruta de intérprete
de producto inexistente. El subprocess real conservó respuesta ping durante
lectura XLSX. No acredita el runtime distribuible ni otros formatos no probados.

Smoke nativo final: 11 comprobaciones aprobadas con Electron 44.5.1; perfil
temporal soflia-tools-ipc-native-mwrQGd. Lector/diálogos simulados, red bloqueada,
preload sandbox y aislamiento de contexto. Original ficticio intacto y staging
retirado. No certifica interacción humana ni parsers/hardware de producción.

## Autorrevisión adversarial

Se revisaron emisor antes de efectos, A/B/A de sesión/política, payloads grandes,
copy y cierres, store corrupto, fallo antes/después de rename, colisión y salida
malformada. La prueba roja epoch-red-confirmed.log reprodujo diagnóstico de
timeout antiguo sobrescribiendo al hijo nuevo; se corrigió con publicación sólo
en su generación y antes de esperar stop. El primer intento epoch-red.log falló
en la propia fixture sin reject; se corrigió antes de reproducir el defecto.

Pruebas rojas de persistencia iniciales reprodujeron éxito falso y configuración
corrupta interpretada como false. La etiqueta de hoja con correo también se
reprodujo antes de corregir Python. La revisión posterior encontró ENOENT entre
lstat/open: ahora sólo ausencia en lstat permite false, con regresión dirigida.
Los casos de fallback, permisos y UI verifican el comportamiento final; no se
presentan como pruebas rojas previas que no se ejecutaron.

Lint inicial rechazó throw dentro de finally y limpieza de ref; se corrigieron
sin silenciar reglas ni ampliar baseline. El lint enfocado detectó además
set-state-in-effect; el montaje ahora agenda la carga y cancela el arranque al
desmontar, conservando guardias de generación. Los intentos fallidos permanecen
separados de resultados aprobados en logs temporales.

Esta es autorrevisión, no revisión independiente. No archivar este cambio hasta
contar con la revisión requerida por el estándar base.

## Límites y rollback

Detección por patrones incompleta, preferencia de máquina sin owner/cifrado,
cache sin vigilancia externa, sin límites duros de RAM/CPU ni certificación ZIP
o antivirus. Un crash puede dejar copias privadas; close no confirmado difiere
limpieza y se comunica. No hay limpieza forense ni barrido postcrash. Cancelar
tools puede afectar otras peticiones tools concurrentes, conservando voz.

Contrato operativo canónico: docs/security/python-document-boundary.md.
Rollback conjunto de servicio, handlers, contratos, preload/wrapper/UI, lectores
y redacción Python; preservar las diecisiete unidades anteriores. Reabre las
fronteras corregidas, sin cambios remotos que revertir.

No se recalcula deuda global: 50.375% es el índice experto ponderado histórico,
no SQALE. Se requiere una auditoría comparable para publicar otro porcentaje.
Logs temporales: soflia-python-tools-2026-10-23, conservando nombres y resultados
terminales en los resúmenes de esta carpeta.

Build final: 3398 fuentes copiadas y seis artefactos no vacíos. Las 20 fuentes
registradas permanecieron estables durante la compuerta; las 19 incluidas en el
build de aplicación coinciden por SHA-256. Python main queda fuera de ese build
y tiene verificación QA propia. Sandbox: pulse-app-build-ESZNjw. Resumen en
build-summary.json; huellas previas en source-before-gate.json.

El chequeo adicional git diff --check sobre todo el diff acumulado señaló
líneas vacías al final de varios archivos, incluidas áreas de unidades previas.
No se presenta como aprobado ni sustituye la compuerta de PR ejecutada. No se
mezcló una normalización masiva de formato con esta frontera funcional.
