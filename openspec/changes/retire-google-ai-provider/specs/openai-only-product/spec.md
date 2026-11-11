## ADDED Requirements

### Requirement: Proveedor de inferencia único
El producto SHALL usar OpenAI en las capacidades de IA y retirar modelos,
credenciales, endpoints, SDK y herramientas específicas de Gemini.

#### Scenario: Selección de SofLIA Pro
- **WHEN** el usuario abre el selector conversacional
- **THEN** puede elegir SofLIA Pro (`gpt-6.1-terra`) junto a SofLIA y SofLIA Max
- **AND** los turnos con Pro usan OpenAI Responses con el nivel elegido entre Bajo y Máximo, Medio por defecto y preferencias independientes por modelo
- **AND** los trabajos en segundo plano iniciados con Pro conservan Terra al ejecutarse y al recuperarse
- **AND** Pro está disponible aun cuando se agotan los tres usos mensuales de Max

#### Scenario: Selección guardada retirada
- **WHEN** se abre el selector con un modelo Gemini anterior
- **THEN** se persiste el modelo OpenAI por defecto y se conserva razonamiento compatible

#### Scenario: Trabajo en segundo plano
- **WHEN** se admite un trabajo nuevo o se recupera una selección anterior
- **THEN** se usa un proveedor OpenAI autorizado y se conserva el contrato de herramientas

#### Scenario: Empaquetado
- **WHEN** se compila el producto
- **THEN** renderer y preload excluyen las claves de inferencia y el producto final carece de los SDK Gemini

#### Scenario: Capacidades existentes
- **WHEN** se invocan chat, agentes, audio, imágenes, memoria o control visual
- **THEN** cada ruta mantiene sus guardas y usa la capacidad OpenAI verificada correspondiente
