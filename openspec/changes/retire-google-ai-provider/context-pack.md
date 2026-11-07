# Contexto del cambio

- Objetivo. Retirar todo uso operativo de Gemini y sus herramientas del producto.
- Actor. Usuario de SofLIA Hub y operadores del runtime.
- Alcance. Catálogo, preferencias, inferencia, claves, agentes, herramientas, SDK y build.
- Restricciones. Preservar modularidad, autorización, separación Electron, trabajo local y verificación.
- Contratos afectados. IPC, wrappers, catálogo de herramientas, DTO de modelos y configuración de proveedores.
- Riesgo. Migrar capacidades de imagen, audio, embeddings y control visual exige contratos específicos.
- Criterios verificables. Producto sin selección ni solicitudes Gemini, sin sus SDK en dependencias y build, con pruebas de capacidades migradas.
- Incertidumbres. La paridad de cada integración se debe demostrar durante la implementación.
