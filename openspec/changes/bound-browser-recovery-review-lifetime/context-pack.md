# Contexto del cambio

- Objetivo: impedir que el reloj de pared prolongue una revisión de recuperación y revalidar vigencia antes de publicaciones tras I/O/colas/proyecciones.
- Actor: usuario que revisa recuperación de políticas/atajos/sync, historial/auditoría SQLite, memoria semántica o estado coordinado sync.
- Alcance: cuatro motores de recuperación y una primitiva interna común de vigencia/consumo; tests y evidencia con archivos propios temporales.
- No objetivos: explicar sin evidencia el fallo nativo anterior, cambiar todos los permisos temporales del producto, formato persistente, cifrado, cadencia, RPO/RTO, IPC o SQL.
- Restricciones: conservar las 27 unidades y trabajo ajeno en la rama activa; sin secretos/.env, perfiles reales, ejecución remota o commits. No trasladar este estado acumulado a un checkout limpio.
- Contratos: máximo de cinco minutos y un intento; guardas actor/archivo/respaldo y mecanismos de recuperación se conservan. Se comprueba vigencia antes de iniciar nuevos efectos, sin prometer cancelar syscalls iniciadas.
- Riesgo/HITL: restaurar datos requiere confirmación existente. Reloj de pared atrasado no debe ampliar vigencia; cambios posteriores durante I/O o un marcador sync deben dejar rechazo recuperable, sin éxito falso.
- Criterios: reloj atrasado con cinco minutos monotónicos transcurridos rechaza; reloj adelantado conserva rechazo restrictivo; no revive un plazo vencido; cola/I/O/proyección no permiten publicar después de vencer; segundo consumo falla; ninguna publicación parcial se oculta.
- Incertidumbres: diez smokes policies-only pasaron; nuevas ejecuciones revelaron EPERM en rename Windows y un bloqueo controlado lo reprodujo. No se identifica el tenedor histórico ni se garantiza publicar con un bloqueo persistente. La extensión de plazo se confirmó por separado. Plataformas/CI remoto y revisión independiente pendientes.
