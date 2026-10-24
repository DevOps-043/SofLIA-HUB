# Autorrevisión adversarial

Fecha: 2026-10-22. Revisión del autor; independiente pendiente antes de archivar.

Se revisaron contratos, componente, navegación, consumidores, fixture y runner,
pruebas rojas/verdes, mediciones nativas y seguimiento de IRIS.

| Hipótesis / riesgo | Evidencia y resultado |
|---|---|
| Confirmar otro valor por reordenar opciones | Reproducido antes del arreglo; identidad por valor y regresión del callback exacto corrigen el fallo sin escribir al explorar. |
| aria-activedescendant ausente/deshabilitado | Casos de eliminación, vaciado, todas deshabilitadas y cambio de disabled; la referencia se deriva de una habilitada actual o se omite. |
| ID del popup colisiona con otro control válido | La revisión posterior al primer gate reprodujo colisión con ids device/device-listbox. Se restableció useId en el id interno del popup y su formato previo; una regresión comprueba el nodo real apuntado por aria-controls. |
| Popup cierra también el modal o atrapa al usuario | Primer/segundo Escape, Tab/Shift+Tab, blur y portal modal cubiertos en DOM; Electron real con foco emulado verifica cancelación del diálogo y navegación nativa. |
| Reapertura latente | Deshabilitar/habilitar y vaciar/reponer permanecen cerrados; sin setter de estado en efecto ni baseline ampliado. |
| Prefijos interfieren con atajos, IME o acumulan memoria | Guardas de modificadores/composición y tests; timestamp del evento, ventana de 500 ms y buffer limitado a etiqueta más larga, sin timer. |
| Altura/scroll aprobados sólo con jsdom | Chromium reprodujo geometría animada intermedia y opción final fuera de viewport. Medición y captura finales prueban popup y opción completos a 200%, con transición geométrica desactivada y scroll local. |
| El arreglo impide desplazar opciones con rueda | El scroll propio no reposiciona; caso DOM y comprobación nativa permiten apartarse de la opción activa. |
| Se rompe API o integración | AST conserva diez props y cuatro campos de opción con reexport nombrado; consumidores Studio y typecheck/build/gate verifican integración. No hay IPC ni dependencias nuevos. |
| El smoke toca perfiles/cuentas/red del usuario | Fuente copiada a sandbox que excluye .env, entorno allowlisted, config Vite independiente, ventana oculta, perfil temporal, red bloqueada y datos ficticios. No arranca App/Supabase. Foco emulado, no interacción humana. |
| RLS IRIS queda arreglado por documento o cliente | No. Catálogos/asesores prueban la brecha; no se modificaron permisos ni datos remotos. Se documenta transición de identidad/consumidores y transacción de servidor requerida, sin RPC inventado ni archivado sustituyendo borrado. |

El arnés se corrigió al refutar supuestos de foco oculto y de transición:
`transition-property=none` puede conservar duration y aun así impedir transición.
El defecto real de max-height se corrigió después de medirlo; no se flexibilizó
la comprobación final de visibilidad con tolerancias ni se aceptó el primer verde
DOM como evidencia suficiente. Los diagnósticos temporales no forman parte del
producto y los intentos quedan registrados en verification.

Riesgo residual: valores de opción deben ser únicos como exige su key de React;
no se crean valores nuevos para corregir al caller. No hay auditoría AT/axe
global ni contraste de todas las pantallas. Formas de movimiento del resto de
la aplicación siguen pendientes. IRIS conserva la brecha de acceso y borrado,
que requiere backend/rollout autorizado; no se considera remediada. No hay
porcentaje global nuevo ni afirmación de capacidad/rendimiento.
