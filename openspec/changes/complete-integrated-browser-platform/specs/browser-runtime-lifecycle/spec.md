## Purpose

Mantiene el motor web actualizado, diagnosticable y apto para release sin depender accidentalmente de versiones beta.

## ADDED Requirements

### Requirement: Instalador con runtime privado verificable
El instalador Windows SHALL mostrar identidad Pulse Hub, explicar Python privado y conservar ubicación, cancelación y progreso real. La preparación SHALL comprobar integridad del archivo Python y dependencias de voz/documentos antes de promover el runtime; el paquete SHALL verificar ambos sidecars sin modificar Python del sistema.

#### Scenario: Fuente o preparación fallida
- **WHEN** falla el digest, la descarga, los imports o la promoción del nuevo runtime
- **THEN** no se marca válido un runtime incompleto y se conserva la copia anterior o su respaldo recuperable

#### Scenario: Paquete de prueba
- **WHEN** se ejecuta el smoke local del instalador
- **THEN** compila sin .env ni claves heredadas, no publica ni inicia la aplicación y registra el resultado del paquete

### Requirement: Motor estable para release
Un build de release SHALL usar una versión estable y soportada de Electron/Chromium, salvo excepción temporal documentada con fecha de retiro, riesgos y pruebas específicas.

#### Scenario: Dependencia beta
- **WHEN** la compuerta de release detecta una versión prerelease sin excepción vigente
- **THEN** el build falla antes del empaquetado

#### Scenario: Instalación divergente
- **WHEN** manifiesto, lockfile, paquete instalado o versión del ejecutable real no coinciden, o la versión no es exacta
- **THEN** la compuerta falla aunque el manifiesto declare una versión estable

### Requirement: Diagnóstico de runtime
El navegador SHALL exponer versión de aplicación, Electron, Chromium, Node, partición saneada, estado de protecciones y última comprobación de actualización sin revelar rutas o identificadores sensibles.

#### Scenario: Reporte de soporte
- **WHEN** el usuario genera un diagnóstico
- **THEN** obtiene un reporte reproducible y saneado

### Requirement: Zoom seguro durante el arranque de pestañas
El navegador SHALL diferir la emulación de zoom hasta que exista un documento
cargado y un renderer operativo. El zoom normal SHALL evitar desactivar una
emulación que nunca fue activada. La corrección SHALL conservar la aceleración
gráfica predeterminada y verificarse con Electron real.

#### Scenario: Primera pestaña o restauración con zoom
- **WHEN** se crea una WebContentsView y se configura su geometría antes de cargar
- **THEN** no invoca emulación nativa todavía y aplica el último zoom solicitado
  al terminar la carga, sin cerrar la aplicación

#### Scenario: Navegación o renderer caído
- **WHEN** se solicita zoom durante una carga principal o después de un crash
- **THEN** difiere la emulación hasta finalizar una carga válida y no opera sobre
  una vista destruida

### Requirement: Recuperación ante actualización
Las migraciones de stores y sesión SHALL ser versionadas, idempotentes y recuperables; un fallo SHALL conservar el archivo anterior y permitir iniciar con funciones degradadas.

#### Scenario: Migración fallida
- **WHEN** una actualización no puede migrar datos del navegador
- **THEN** conserva el respaldo, informa el fallo y no destruye el perfil

#### Scenario: Creación SQLite interrumpida
- **WHEN** falla la creación o validación del esquema de historial, bitácora o memoria semántica
- **THEN** revierte DDL y versión juntos; un reintento puede crear un almacén nuevo y una base ajena, futura o v1 incompleta no se reinterpreta como vacía

#### Scenario: Archivo de permisos no legible
- **WHEN** el archivo está corrupto, es de versión no compatible o no se permite leerlo
- **THEN** se usan defaults para navegar, se informa degradación y se rechaza guardado/restablecimiento sin sobrescribirlo ni restaurar concesiones antiguas

#### Scenario: Principal de sesión ausente o corrupto
- **WHEN** existe un respaldo de sesión validado y el principal no se puede recuperar por ausencia o corrupción de formato
- **THEN** ofrece restaurar el respaldo sin consumirlo; los errores de permisos y las versiones futuras se conservan sin reinterpretarlos como corrupción

#### Scenario: Descartar con interrupción
- **WHEN** el proceso se interrumpe después de persistir el descarte y antes de retirar el respaldo
- **THEN** la sesión vacía válida prevalece y no vuelve a ofrecer la sesión descartada

#### Scenario: Salida normal o instalación solicitada
- **WHEN** el usuario sale de la aplicación o solicita instalar una actualización descargada
- **THEN** main espera el guardado pendiente de sesión antes de permitir el cierre o iniciar el instalador; un timeout de cinco segundos o error ofrece reintentar, cancelar o salir sin guardar con confirmación explícita

#### Scenario: Salidas repetidas o canceladas
- **WHEN** llegan varias solicitudes de salida durante la espera o se cancela el cierre
- **THEN** se mantiene una sola preparación por intento, no se duplica la instalación ni se interpreta una respuesta tardía como autorización para salir
