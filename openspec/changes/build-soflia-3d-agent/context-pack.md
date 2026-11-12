# Contexto del cambio

- Objetivo: construir el agente tridimensional usando las tres referencias proporcionadas.
- Usuario: equipo de producto e integradores web/Electron.
- Alcance: geometría, identidad, seis clips, controles, render, exportación y visor.
- No objetivos: cambiar chat, permisos, IPC, proveedores IA o publicar remotamente.
- Restricciones: español, preservar trabajo ajeno, hardware local, sin instalaciones globales.
- Contratos: nombres de nodos/clips, archivos glTF y API del controlador visual.
- Riesgo y HITL: generación local reversible autorizada; sin acciones destructivas o remotas.
- Criterios: geometría real, archivos Blender reabribles, seis clips distintos, reproducción
  Three.js, entradas acotadas, cierre de recursos, reducción de movimiento y fallback.
- Incertidumbres: fidelidad estética requiere inspección visual; FPS depende del dispositivo.
