## ADDED Requirements

### Requirement: Instalación gobernada de extensión compatible
El sistema SHALL aceptar únicamente carpetas desempaquetadas validadas y MUST requerir confirmación nativa que muestre identidad, permisos y hosts antes de cargar código.

#### Scenario: Extensión aprobada
- **WHEN** el usuario selecciona una carpeta Manifest V3 válida y confirma sus permisos
- **THEN** el sistema la copia al root administrado, registra metadata y la carga en la sesión persistente

#### Scenario: Extensión inválida o peligrosa
- **WHEN** falta manifest, excede límites, contiene symlinks o solicita un permiso bloqueado
- **THEN** el sistema rechaza la instalación sin copiar ni ejecutar archivos

#### Scenario: Usuario cancela
- **WHEN** el usuario cancela selector o confirmación
- **THEN** no cambia el registro ni la sesión

### Requirement: Ciclo de vida persistido de extensiones
El sistema SHALL recargar en cada inicio las extensiones habilitadas y SHALL aislar el fallo de una extensión del resto del navegador.

#### Scenario: Reinicio
- **WHEN** la sesión del navegador se inicializa después de reiniciar la aplicación
- **THEN** carga cada extensión habilitada desde su copia administrada y actualiza su estado

#### Scenario: Extensión dañada
- **WHEN** una extensión registrada ya no puede cargarse
- **THEN** queda con estado de error visible y las demás continúan

### Requirement: Administración y remoción explícita
El usuario SHALL poder listar, habilitar, deshabilitar y remover extensiones sin exponer rutas locales al renderer o al agente.

#### Scenario: Deshabilitar
- **WHEN** el usuario deshabilita una extensión cargada
- **THEN** se descarga de la sesión y su preferencia queda persistida

#### Scenario: Remover
- **WHEN** el usuario confirma remover una extensión
- **THEN** se descarga, elimina su registro y borra únicamente su carpeta validada dentro del root administrado

#### Scenario: Solicitud del agente
- **WHEN** una tarea runtime intenta instalar, listar o remover extensiones
- **THEN** la capacidad no está disponible en su catálogo de herramientas

