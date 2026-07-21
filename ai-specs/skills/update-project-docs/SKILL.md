---
name: update-project-docs
description: Actualiza la documentación canónica afectada por un cambio y evita copias de código, rutas rotas o guías divergentes. Úsala cuando cambien arquitectura, contratos, operaciones, datos, comandos o estructura del repositorio.
---

# Actualizar documentación del proyecto

1. Leer `docs/README.md` y `docs/standards/documentation.md`.
2. Elegir una sola ubicación canónica según arquitectura, producto, operación, estándar, plan, reporte o archivo histórico.
3. Actualizar la documentación junto con el código y enlazarla desde el índice apropiado.
4. Reemplazar snapshots de código por enlaces a los archivos reales.
5. Mover contenido obsoleto a `docs/archive/` con contexto temporal; no presentarlo como norma vigente.
6. Ejecutar `npm run docs:check` y corregir enlaces relativos rotos introducidos por el cambio.
7. Registrar decisiones duraderas en diseño o especificaciones, no en reportes efímeros.
