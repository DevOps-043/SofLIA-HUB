## ADDED Requirements

### Requirement: RF-SHARE-001 Selector propio con vistas previas
El Hub SHALL presentar una ventana propia con miniaturas reales de pantallas,
ventanas y pestañas materializadas del navegador integrado, categorías, búsqueda,
actualización manual y confirmación explícita. No SHALL iniciar transmisión al
abrir ni seleccionar una tarjeta. SHALL usar los tokens visuales del sistema.

#### Scenario: Confirmación de una ventana
- **WHEN** el usuario elige una ventana disponible y pulsa Compartir
- **THEN** el solicitante recibe únicamente la fuente elegida

#### Scenario: Cancelación
- **WHEN** el usuario cancela, pulsa Escape, cierra el selector o la ventana padre
- **THEN** la solicitud termina sin entregar fuente ni audio

### Requirement: RF-SHARE-002 Consentimiento y aislamiento
Solo el frame principal del selector local SHALL poder consultar miniaturas o
confirmar. Los IDs SHALL pertenecer al inventario de esa solicitud y comprobarse
de nuevo al confirmar. El selector SHALL exponer únicamente list/select/cancel,
sin las APIs del Hub. El audio del sistema SHALL estar desactivado inicialmente
y disponible únicamente si fue solicitado y la plataforma es Windows.

#### Scenario: Fuente desaparecida o pestaña que cambió
- **WHEN** la fuente desaparece o la pestaña navega durante la elección
- **THEN** se rechaza compartir y se ofrece actualizar las miniaturas

#### Scenario: Solicitante no autorizado
- **WHEN** otro renderer o subframe invoca los canales del selector
- **THEN** no recibe miniaturas ni puede confirmar o cancelar otra solicitud

### Requirement: RNF-SHARE-001 Recursos limitados y recuperación
El inventario SHALL limitarse a 100 fuentes y miniaturas de 480 por 270.
No SHALL haber polling ni persistencia de capturas. Cerrar, navegación del padre,
fallo de carga o crash SHALL liberar solicitud y miniaturas. Un límite de dos
minutos SHALL cancelar solicitudes abandonadas. El selector SHALL mostrar carga,
vacío, miniatura no disponible y error recuperable.

#### Scenario: Concurrencia
- **WHEN** otra solicitud intenta abrir un selector para la misma ventana
- **THEN** se cancela la segunda y se conserva la primera

#### Scenario: Navegadores externos
- **WHEN** el usuario abre la categoría Pestañas
- **THEN** se explica que contiene pestañas del navegador del Hub y que Chrome
  y Edge externos se comparten como ventanas
