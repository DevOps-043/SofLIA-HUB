# Contexto del cambio

- Objetivo: reducir avisos de dependencias mediante parches compatibles y conservar el comportamiento integrado.
- Usuario o actor: usuarios del Hub y desarrolladores que ejecutan Vite/Vitest.
- Alcance: Sharp y herramientas Vite/Vitest, transitivas corregibles dentro de los rangos existentes, lock raíz y evidencia de consumo real. Reparar el smoke aislado para incluir las fuentes de la cadena build:app que se omitían.
- No objetivos: migraciones mayores de correo/modelos/documentos, overrides incompatibles, cambios de IPC/datos, instalaciones remotas o publicación.
- Restricciones: preservar el bloque de refactorización anterior y su rama; no leer secretos ni ejecutar ganchos de instalación sin revisión; no usar audit fix --force ni retroceder dependencias para ocultar avisos.
- Contratos afectados: resolución reproducible de paquetes, procesamiento de imágenes, pruebas y compilación de la aplicación. No cambia la API del producto.
- Riesgo y HITL: riesgo de incompatibilidad binaria o de herramientas; revisar lock/ganchos antes de instalar con ignore-scripts y ejecutar consumidores reales. Sin efectos externos de negocio.
- Criterios verificables: versiones corregidas en lock e instalación; cantidad y conjunto de avisos decrecientes; sin ganchos nuevos; casos de imágenes/documentos y gate de PR aprobados; build aislado sin configuraciones locales.
- Incertidumbres: avisos del registro cambian con el tiempo; audit no acredita explotabilidad. ABI y plataformas distintas de Windows se verifican por sus pipelines, no por inferencia local.
