---
name: electron-ipc-change
description: Implementa o revisa una capacidad Electron que cruza main, preload y renderer. Úsala al agregar o modificar canales IPC, servicios nativos, handlers, APIs expuestas o wrappers tipados.
---

# Implementar un cambio IPC Electron

1. Leer `docs/standards/electron-ipc.md` y localizar el patrón existente más cercano.
2. Definir un contrato de entrada y salida pequeño; evitar exponer primitivas genéricas.
3. Implementar lógica de negocio en el servicio main y validar entradas en el handler.
4. Registrar el canal en la allowlist y exponer solo el método necesario en preload.
5. Agregar o actualizar el wrapper tipado del renderer y sus tipos globales.
6. Preservar CSP, sanitización, timeouts, cancelación y compatibilidad standalone.
7. Probar éxito, error, payload inválido y canal no permitido.
8. Ejecutar `$verify-change` y registrar evidencia en el cambio OpenSpec.

Tratar como incompleto cualquier cambio que omita una de las cuatro capas del contrato.
