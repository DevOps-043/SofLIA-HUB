## Purpose

Completa las funciones de navegación cotidiana y recuperación necesarias para usar el navegador integrado como superficie principal de trabajo.

## ADDED Requirements

### Requirement: Descargas gobernadas
El navegador SHALL mostrar cada descarga iniciada por una página con nombre saneado, progreso, estado, origen y acciones de cancelar, reintentar, reanudar, abrir archivo y abrir carpeta. El destino SHALL permanecer dentro de una ubicación elegida por el usuario o la carpeta Descargas y nunca será decidido por contenido remoto sin validación.

#### Scenario: Descargar un archivo
- **WHEN** una página inicia una descarga HTTP(S)
- **THEN** el navegador muestra progreso y completa el archivo en un destino validado

#### Scenario: Descarga riesgosa
- **WHEN** el nombre, protocolo, origen o destino no supera la política
- **THEN** el navegador bloquea o solicita confirmación sin ejecutar el archivo

### Requirement: Herramientas de página
El navegador SHALL ofrecer búsqueda en página, zoom aislado, silencio de audio, pantalla completa, impresión y guardado como PDF desde comandos visibles y atajos de teclado.

#### Scenario: Zoom por pestaña en Electron sin aislamiento nativo
- **WHEN** el runtime no ofrece setZoomMode aislado y se cambia zoom entre 50 y 300 por ciento
- **THEN** se utiliza emulación de viewport desktop por WebContents manteniendo el zoom por origen en uno; cambia el reflujo y escala visible sólo de esa pestaña, sin cambiar partición, cookies ni User-Agent
- **AND** resize, navegación, duplicación y reactivación conservan el factor lógico; coordenadas DOM se convierten a la superficie visible y cambiar zoom invalida observaciones del agente

#### Scenario: Buscar texto
- **WHEN** el usuario abre la búsqueda, escribe texto y avanza entre coincidencias
- **THEN** la página resalta coincidencias y muestra posición y total

#### Scenario: Guardar PDF
- **WHEN** el usuario elige guardar como PDF y confirma un destino válido
- **THEN** el navegador genera el archivo e informa éxito o error sin sobrescritura silenciosa

### Requirement: Organización de pestañas
El navegador SHALL permitir fijar, silenciar, duplicar, agrupar, nombrar y colorear grupos, usar disposición horizontal o vertical y reabrir pestañas cerradas.

#### Scenario: Restaurar pestaña cerrada
- **WHEN** el usuario solicita reabrir la última pestaña cerrada
- **THEN** se recrea con su URL, grupo y posición saneados

### Requirement: Restauración de sesión
El navegador SHALL persistir de forma acotada ventanas, pestañas, grupos, orden, modo de vista y pestaña activa, y SHALL restaurarlos después de un reinicio normal o inesperado sin persistir campos de formulario.

#### Scenario: Recuperación después de cierre inesperado
- **WHEN** la aplicación inicia y existe una sesión válida incompleta
- **THEN** el usuario puede restaurarla o descartarla explícitamente

#### Scenario: Restauración con muchas pestañas
- **WHEN** el usuario restaura una sesión con vista dividida y ventanas separadas
- **THEN** conserva los identificadores relacionados mediante remapeo, grupos, orden, fijación y silencio; sólo materializa las vistas necesarias y mantiene el límite de ocho vistas vivas

#### Scenario: Restauración todavía no elegida
- **WHEN** el usuario navega o cierra la ventana sin restaurar ni descartar la sesión ofrecida
- **THEN** la navegación nueva no sustituye silenciosamente la sesión pendiente

#### Scenario: Lectura o cambio de perfil pendiente
- **WHEN** cambia el perfil o la ventana mientras se está cargando una sesión
- **THEN** el resultado tardío no publica datos del perfil anterior y no se abren vistas durante la transición de cuenta
