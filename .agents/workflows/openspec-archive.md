# Archivar un cambio OpenSpec

Archiva solo un cambio terminado e integrado.

1. Confirma que todas las tareas esten completas y que el reporte de evidencia
   corresponda al estado final.
2. Verifica que el cambio ya este integrado en la rama objetivo; no archives solo
   por haber terminado una rama local.
3. Sincroniza los deltas con las especificaciones base cuando aplique.
4. Ejecuta `npx openspec validate --all --strict --no-interactive`.
5. Usa el flujo oficial de archivo de OpenSpec y comprueba que no queden enlaces
   activos hacia la ruta anterior.
6. Conserva decisiones, evidencias y riesgos residuales como historial auditable.
