---
name: using-git-worktrees
description: Aísla una implementación material en una rama y worktree recuperables, preservando cambios existentes. Úsala antes de tareas largas, paralelas o de alto riesgo y cuando el worktree activo contenga trabajo no relacionado.
---

# Aislar trabajo con Git

1. Inspeccionar rama, estado, remotos y worktrees sin modificar nada.
2. Preservar cambios ajenos; no limpiar, resetear ni moverlos sin autorización.
3. Crear una rama `codex/<tema>` desde la base acordada.
4. Crear el worktree bajo `.worktrees/<tema>` y comprobar que la ruta resuelta permanezca dentro del repositorio.
5. Instalar dependencias solo si faltan y registrar la línea base de pruebas.
6. Mantener commits pequeños, sin secretos ni artefactos generados.
7. Retirar el worktree únicamente al terminar y solo después de comprobar que no tiene cambios sin guardar.

Preferir una rama en el worktree actual si el usuario ya guardó su trabajo y no se necesita concurrencia física.
