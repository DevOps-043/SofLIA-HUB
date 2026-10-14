# Corregir archivos y continuidad de Computer Use

## Problema
Las capturas del usuario muestran que Computer Use abre «Archivos» con una
tarjeta sin entregable y pregunta si debe continuar mientras el launcher descarga.
El prompt base y la descripción de la herramienta ordenan esa pregunta ante
cualquier resultado incompleto. La comprobación visual termina el loop al primer
cierre prematuro, incluso si solo queda esperar una carga transitoria.

## Alcance
Excluir del panel las actividades de control de pantalla sin archivos. Continuar
la misma conversación CU cuando una comprobación reciente identifique una espera
transitoria recuperable, dentro del presupuesto original. Conservar cancelación,
destino, autorizaciones y HITL. Corregir las instrucciones del chat para evitar
preguntas redundantes. No ejecutar Minecraft ni actualizar instalaciones durante
las pruebas; las capturas son evidencia del defecto, no una orden de ejecución.

## Riesgos
No repetir efectos sensibles ni reintentar indefinidamente. La comprobación debe
autorizar explícitamente la recuperación y excluir bloqueos de acceso, permisos
o efectos cuyo resultado sea incierto. Mantener un máximo de dos recuperaciones.
