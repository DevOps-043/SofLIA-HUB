# Reconciliar documentos corporativos y audiovisual

## Why
La fusión iniciada por el usuario entre `codex/organization-document-branding`
y `codex/presentaciones-audiovisual` quedó detenida con doce conflictos.

## What Changes
- Conservar las correcciones verificadas de documentos, tablas/diagramas,
  métricas animadas, exportación editable y scripts de QA.
- Conservar las banderas multimodales y el apagado audiovisual por defecto
  en releases que todavía no distribuyen el motor.
- Configurar las variables audiovisuales locales en `.env`, por solicitud
  explícita del usuario, con rutas verificadas de este equipo.
- Regenerar semilla/inventario y validar la combinación antes de cerrar la fusión.

## Impact
Se conserva el código combinado sin descartar ramas ni modificar credenciales.
La configuración local no se versiona. No se publica ni se aplica SQL remoto.
