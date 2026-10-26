## ADDED Requirements

### Requirement: Acceso directo de proyectos
El Hub MUST usar los clientes Supabase existentes desde main para los proyectos en producción y MUST NOT contactar la API web de Project Hub ni canjear su sesión para ese flujo.

#### Scenario: Crear sin API web
- **WHEN** una persona con sesión verificada de Learning crea un proyecto en su organización activa
- **THEN** el proyecto se inserta directamente en IRIS, sin exigir un equipo ni una sesión de Project Hub, y conserva su workspace de organización.

### Requirement: Autorización y aislamiento
Cada operación MUST comprobar identidad SOFIA, organización activa, membresía activa y relación exacta del workspace; las consultas de proyectos MUST estar restringidas a ese espacio y al acceso del actor.

#### Scenario: Organización o sesión cambia durante una operación
- **WHEN** cambia la sesión o la organización mientras hay una consulta pendiente
- **THEN** se invalida el contexto y se descarta su resultado; una escritura incierta no se reenvía automáticamente.

#### Scenario: Proyecto de otro espacio
- **WHEN** una solicitud contiene un workspace o proyecto ajeno a la organización activa
- **THEN** se rechaza antes de escribir datos y no se usa una lista global de proyectos como sustituto.

### Requirement: Compatibilidad de interfaz
El cambio MUST conservar los canales IPC, validación de payload, controles humanos existentes y destinos locales/Drive/OneDrive.

#### Scenario: API web no disponible
- **WHEN** el servidor web de Project Hub no responde
- **THEN** la carga y creación de proyectos siguen usando la base de datos directa sin intentar ese servidor.
