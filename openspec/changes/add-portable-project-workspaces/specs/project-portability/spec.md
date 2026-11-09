## Purpose

Definir proyectos exportables e importables mediante metadatos versionados y archivos verificables, preservando relaciones de negocio sin trasladar credenciales o convertir una copia en autorización.

## ADDED Requirements

### Requirement: Manifiesto portable versionado
El sistema SHALL incluir identidad portable, versión de esquema, compatibilidad mínima, procedencia, revisión de instantánea e inventario de rutas relativas con hashes. SHALL excluir credenciales, rutas absolutas y permisos ejecutables.

#### Scenario: Abrir versión futura no soportada
- **WHEN** un manifiesto necesita una versión posterior del lector
- **THEN** informa incompatibilidad y no modifica el proyecto o sus archivos

#### Scenario: Archivo copiado declara propiedad
- **WHEN** un manifiesto contiene IDs o roles de un proyecto existente
- **THEN** se consideran sólo procedencia y se verifica la membresía actual en el servidor antes de vincularlo

### Requirement: Exportación revisada y coherente
El sistema SHALL exportar sólo contenido autorizado y seleccionado, con vista previa de inclusiones/exclusiones y límites del destino. SHALL entregar una instantánea coherente o declarar qué impide completarla.

#### Scenario: Cambios mientras se exporta
- **WHEN** una tarea o archivo cambia durante la captura
- **THEN** se fija una revisión válida o se informa conflicto/reintento; no se presenta como completo un paquete incoherente

#### Scenario: Referencia de nube sin bytes
- **WHEN** se exporta un documento nativo o una referencia inaccesible para descarga
- **THEN** indica si incluye enlace o una conversión autorizada y no afirma que contiene el archivo original

### Requirement: Modos explícitos de importación
El sistema SHALL distinguir abrir/vincular un proyecto, crear copia independiente y restaurar sobre uno existente. SHALL presentar un plan de cambios, comprobar permisos y evitar sobrescribir sin aprobación.

#### Scenario: Importar copia independiente
- **WHEN** se elige crear una copia de un paquete válido
- **THEN** genera nuevas identidades, remapea relaciones, conserva procedencia y no activa miembros o grants del paquete

#### Scenario: Restaurar con revisión desactualizada
- **WHEN** la revisión del destino cambió desde preparar la restauración
- **THEN** se detiene para comparar nuevamente y conserva ambos estados sin sobrescritura silenciosa

#### Scenario: Repetir la misma operación
- **WHEN** se reanuda una importación tras perder la respuesta
- **THEN** recupera el resultado de esa operación sin duplicar entidades

### Requirement: Paquetes no confiables y publicación segura
El sistema SHALL validar rutas, estructura, relaciones, cantidades, tamaño descomprimido y hashes antes de publicar. SHALL rechazar escape de raíz, enlaces no permitidos, nombres ambiguos o reservados y expansión excesiva; no ejecutará contenido importado.

#### Scenario: Paquete intenta escribir fuera del destino
- **WHEN** incluye rutas padre, absolutas, UNC, ADS o enlaces a archivos externos
- **THEN** se rechaza sin escribir fuera del staging y sin alterar el proyecto existente

#### Scenario: Paquete corrupto o falta espacio
- **WHEN** falla un hash, una cuota o el espacio disponible
- **THEN** se informa el motivo, no se publica una importación completa y se conserva el material original

### Requirement: Datos privados y permisos de exportación
El sistema SHALL excluir secretos y estado privado del producto, respetar política de exportación y revalidar acceso antes de publicar un paquete.

#### Scenario: Acceso revocado durante exportación
- **WHEN** se revoca el permiso antes de publicar
- **THEN** la aplicación no publica el paquete pendiente ni reutiliza la autorización anterior
