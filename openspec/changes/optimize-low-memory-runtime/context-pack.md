# Contexto

- Objetivo: reducir consumo residente y trabajo de CPU con recursos muy limitados conservando capacidades; 4 GB/Pentium es una analogía aclarada por el usuario.
- Actor: usuario de la aplicación empaquetada; compilación en ese hardware es una medición independiente.
- Alcance: aislamiento del renderer flotante, coordinación de refrescos y carga selectiva.
- No objetivos: desactivar GPU, sandbox, voz, agentes, reuniones, herramientas o recortar datos del usuario; prometer RAM máxima global.
- Restricciones: mantener autorización y recuperar datos vigentes al volver a la ventana.
- Contratos: ninguna API pública cambia; programación interna de consultas.
- Riesgo/HITL: efectos locales reversibles; pruebas con fixtures sin cuentas ni envíos.
- Criterios: oculto no inicia consultas periódicas; eventos simultáneos se agrupan; máximo una ejecución por refresco; detener impide nuevas ejecuciones/publicaciones; ventana flotante no monta managers principales.
- Incertidumbres: no hay presupuesto universal de RAM/CPU acreditado; funciones multimedia/IA local tienen coste propio. No se requiere identificar un Pentium físico para esta entrega.
