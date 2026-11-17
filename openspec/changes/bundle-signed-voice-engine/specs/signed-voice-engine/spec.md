## ADDED Requirements

### Requirement: Motor básico incluido
El instalador MUST contener Python privado, sus dependencias de reconocimiento,
sidecars y el modelo español pequeño verificado. El primer dictado MUST NOT
requerir pip, Python del sistema ni descarga del modelo básico.

#### Scenario: Equipo sin herramientas de desarrollo
- **WHEN** se instala SofLIA y se autoriza el primer dictado
- **THEN** el motor básico está disponible sin comandos de instalación

### Requirement: Firma de publicación
La publicación Windows MUST exigir identidad de firma, Authenticode válido para
cada binario PE y firma del editor esperado para ejecutables propios. MUST NOT
publicar si falta configuración, hay firma inválida o artefactos no verificados.

#### Scenario: Firma ausente
- **WHEN** el build de publicación carece de identidad o deja un PE sin firma válida
- **THEN** falla antes de subir instaladores

### Requirement: Reparación confiable
La reparación Windows MUST verificar firma y editor del contenedor antes de
ejecutarlo y MUST extraer en un directorio de perfil sin escapar ni seguir enlaces.
MUST NOT reconstruir Python con pip en el equipo del usuario.

#### Scenario: Contenedor alterado o editor distinto
- **WHEN** la firma del reparador no es válida o no corresponde al editor configurado
- **THEN** no se ejecuta ni instala su contenido

#### Scenario: Instalación incompleta
- **WHEN** faltan recursos del motor y el reparador firmado está disponible
- **THEN** se restaura el motor en el perfil y se comprueba antes de usarlo
