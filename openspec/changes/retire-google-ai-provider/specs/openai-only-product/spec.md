## ADDED Requirements

### Requirement: Proveedor de inferencia único
El producto SHALL usar OpenAI en las capacidades de IA y retirar modelos,
credenciales, endpoints, SDK y herramientas específicas de Gemini.

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
