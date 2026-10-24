## Purpose

Permitir lectura documental local y configuración de redacción con actor y selección verificables, conservando la protección solicitada en errores, cancelación y consumidores internos del Hub.

## ADDED Requirements

### Requirement: Autorización y contrato IPC
Las operaciones MUST comprobar sesión, ventana principal registrada, marco/documento, aridad y payload antes de acceder al servicio, selector o disco. MUST NOT aceptar una ruta libre renderer ni convertir objetos en texto/rutas por coerción.

#### Scenario: Emisor o entrada inválidos
- **WHEN** la llamada procede de otro contexto o contiene campos/argumentos fuera de contrato
- **THEN** se rechaza sin lectura, escritura ni arranque de sidecar

### Requirement: Selección y lectura temporal
La lectura renderer MUST usar selección nativa de un documento admitido y copia estable/verificada dentro de sus cuotas. MUST preservar el archivo original y descartar resultados si cambia caller o política. MUST retirar trabajo cancelado/agotado sin repetirlo y comunicar cierre/cleanup inciertos cuando corresponda.

#### Scenario: Archivo o contexto cambia
- **WHEN** el archivo cambia al preparar la copia o el contexto se invalida mientras selecciona/lee
- **THEN** no se devuelve contenido anterior y se liberan o conservan con recuperación explícita los recursos propios pendientes

### Requirement: Privacidad persistida y observable
La preferencia MUST validarse y publicarse sólo tras confirmar persistencia. Corrupción o fallo de disco MUST NOT desactivar silenciosamente protección ni producir un acuse falso de éxito. Deshabilitar protección MUST solicitar revisión humana vigente; cambiar política MUST invalidar lecturas anteriores.

#### Scenario: Fallo de guardado o confirmación tardía
- **WHEN** falla persistencia o se invalida la revisión antes de escribir
- **THEN** no se declara el cambio guardado ni se reutiliza autorización obsoleta

### Requirement: Protección coherente entre lectores
Con protección solicitada, el documento MUST redactar Markdown, celdas y etiquetas de hojas admitidas. MUST NOT recurrir a extracción cruda o imagen de Office al fallar la ruta protegida. Sin protección, la degradación compatible existente MUST conservarse. La UI MUST explicar alcance real del detector por patrones.

#### Scenario: Sidecar no disponible o etiqueta sensible
- **WHEN** el documento contiene PII en sheet o falla el lector protegido
- **THEN** no se devuelve la etiqueta cruda ni se envía un respaldo sin protección como si estuviera redactado

### Requirement: Salidas mínimas y acotadas
Los resultados MUST validar cuotas/tipos, proyectar metadata permitida y ocultar rutas/errores internos. Los lectores main autorizados MUST conservar su API de lectura con límites de operación y sin añadir capacidades runtime.

#### Scenario: Respuesta inválida o excesiva
- **WHEN** el sidecar devuelve campos o tamaños fuera de contrato
- **THEN** se informa error controlado, sin retry ni exposición del objeto interno
