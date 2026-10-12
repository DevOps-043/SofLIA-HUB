# Corrección de variables del release 0.9.9

Fecha: 2026-10-11. Seguimiento de la integración en main.

## Diagnóstico y decisión

La [ejecución 109](https://github.com/DevOps-043/SofLIA-HUB/actions/runs/38206031648)
falló en `Verify build-time keys`: los bloques de Windows, macOS y Linux no
escribían los tres interruptores públicos `VITE_MULTIMODAL_*` consumidos por
el runtime. El mismo error se reprodujo localmente.

Se añaden a los tres bloques usando GitHub Actions Variables, con respaldo
`true`, que coincide con el valor por omisión actual de `MULTIMODAL_FEATURES`.
La cadena `false` configurada en el repositorio permite desactivar cada función.
No son credenciales y no requieren nuevos secretos. La corrección no conecta
las interfaces pendientes de audio o de subida de medios grandes.

No se modifica el `.env` local. El validador directo también señala que en ese
archivo falta `VITE_PROJECT_HUB_API_URL`; el workflow ya escribe el valor público
de ese servicio en los tres sistemas. Por ello, la comprobación estática se
ejecuta en un directorio temporal sin `.env`, enlazando las fuentes actuales y
copiando el workflow. No se inspeccionan ni copian valores secretos locales.

## Verificación

- Validador estático con fuentes y workflow actuales: correcto.
- Caso negativo: retirar `VITE_MULTIMODAL_BROWSER_VISION` de la copia temporal
  reproduce el rechazo en los tres bloques; no se debilita la compuerta.
- `HARNESS_BASE_REF=main npm run verify:pr`: correcto. Tipos, arnés, adaptadores,
  cadena de suministro, documentación y OpenSpec aprobados; 4.157 pruebas
  aprobadas y una omitida en 392 suites aprobadas y una omitida.
- La documentación se vuelve a validar después de registrar esta evidencia.

## Ejecución remota

Se inicia una ejecución nueva desde main después de incorporar la corrección.
Reintentar el commit antiguo usaría el workflow anterior y repetiría el error.
El usuario autoriza corregir las variables y volver a correr el workflow de
release. No se cambia la versión 0.9.9 ni se eliminan releases existentes.
El estado de la nueva ejecución se consulta en [GitHub Actions](https://github.com/DevOps-043/SofLIA-HUB/actions)
y se informa al usuario con su enlace. La comprobación local no implica que el
empaquetado remoto haya terminado.
