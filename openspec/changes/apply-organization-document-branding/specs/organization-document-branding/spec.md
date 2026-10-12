## ADDED Requirements

### Requirement: Identidad corporativa autorizada
El sistema SHALL aplicar logo y paleta de la organización autorizada a documentos nuevos sin solicitar cargas por documento.

#### Scenario: Organización activa
- **WHEN** el actor tiene membresía activa y marca habilitada
- **THEN** Word y PDF incluyen su logo normalizado y sus colores

#### Scenario: Cambio de contexto
- **WHEN** cambia sesión u organización durante la generación
- **THEN** se rechaza guardar el documento preparado

#### Scenario: Recursos no disponibles
- **WHEN** falla la descarga o consulta de marca
- **THEN** se genera con los recursos disponibles y se informa la degradación

### Requirement: Diseño profesional y personalizable
El sistema SHALL compartir jerarquía, portada adaptable, tablas y destacados entre formatos sin sobreescribir opciones explícitas.

#### Scenario: Preferencias de skill
- **WHEN** se especifican colores/fuente o se desactiva marca corporativa
- **THEN** esos ajustes tienen prioridad y se mantienen las guardas de autorización

#### Scenario: Lectura segura
- **WHEN** se abre un Word corporativo generado
- **THEN** el visor muestra su paleta y logo embebido sin ejecutar ni cargar contenido externo
