## ADDED Requirements
### Requirement: Resultados centrados en archivos
El sistema SHALL mostrar una síntesis del trabajo en el chat y archivos agrupados
en el panel lateral, sin roles ni operaciones por agente.
#### Scenario: Trabajo con entregables
- **WHEN** un trabajo produce varios archivos
- **THEN** todos pueden abrirse desde sus tarjetas y no se muestran registros de agentes
### Requirement: Visor adaptable
El sistema SHALL ofrecer acciones en la cabecera, iconos por formato y ajuste
del ancho con puntero y teclado, sin pies permanentes de lectura o vista local.
#### Scenario: Ajustar un documento abierto
- **WHEN** el usuario arrastra el borde o utiliza las flechas del separador
- **THEN** cambia el ancho dentro del espacio disponible sin recargar el archivo
### Requirement: Delegación automática pertinente
El sistema SHALL delegar tareas con entregables independientes o investigación
comparativa sustancial sin exigir mencionar agentes y SHALL respetar modo directo.
#### Scenario: Investigación y entregables
- **WHEN** el usuario pide investigar alternativas y producir un informe y una hoja de cálculo
- **THEN** se inicia el ejecutor en segundo plano si la superficie y herramientas lo permiten
#### Scenario: Conversión sencilla
- **WHEN** el usuario pide únicamente convertir un archivo a Word sin solicitar equipo
- **THEN** se conserva el ejecutor principal
