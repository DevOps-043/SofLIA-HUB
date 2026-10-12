## ADDED Requirements

### Requirement: Resaltar comandos y código del chat

Los bloques de código SHALL distinguir con colores los tokens de los lenguajes
admitidos y mantener el contenido literal, la sangría y los saltos de línea.

#### Scenario: Comandos de Windows

- **WHEN** SoflIA muestra un bloque BAT, CMD o PowerShell
- **THEN** los comandos, variables y cadenas reciben colores legibles
- **AND** el marcado del contenido se escapa y nunca se ejecuta

#### Scenario: Texto plano, lenguaje desconocido o contenido excesivo

- **WHEN** el bloque es prosa, su lenguaje no se admite o supera 120000 caracteres
- **THEN** se muestra como texto sin resaltado y sigue pudiendo copiarse

### Requirement: Confirmar únicamente copias exitosas

La copia del chat SHALL usar el puente nativo existente cuando está disponible,
esperar la respuesta y copiar el contenido original sin etiquetas de resaltado.

#### Scenario: Copia en Electron

- **WHEN** se pulsa Copiar y la API nativa confirma éxito
- **THEN** el contenido completo llega al portapapeles
- **AND** el botón muestra Copiado durante dos segundos

#### Scenario: Copia rechazada o fallida

- **WHEN** la API nativa devuelve un rechazo o lanza un error
- **THEN** no se muestra Copiado ni se intenta eludir el rechazo con otra API
- **AND** se muestra un aviso breve y puede reintentarse

#### Scenario: Uso en navegador

- **WHEN** no existe puente nativo
- **THEN** se intenta el portapapeles web y, si no está disponible o falla, la copia mediante selección
- **AND** se restaura el foco y se retira el elemento temporal incluso si falla

#### Scenario: Copia de un bloque con líneas vacías iniciales

- **WHEN** el código empieza con líneas vacías
- **THEN** el renderizado y la copia mantienen esas líneas
