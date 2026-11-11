# Verificación de parches de noviembre

La auditoría inicial informó 33 paquetes afectados, dos high y cero critical.
Se reprodujo el reenvío de cabecera sensible de otro contexto con dos servidores
locales y datos ficticios, sin cuentas o destinos externos. El contrato fallaba
antes y pasa después del parche; se añadió a test:quality.

Se actualizaron systeminformation 5.33.1 → 5.33.19, follow-redirects 1.16.1 → 1.16.2
y gaxios 7.3.0 → 7.3.1 dentro de rangos compatibles. Sólo cambiaron estos tres
nodos del lock y el requisito directo de systeminformation. Ninguno incorpora
scripts de instalación. No hubo cambios mayores ni npm audit fix --force.

Se detectó que el lock oculto de npm declaraba versiones nuevas aunque los
archivos instalados seguían siendo anteriores. Se respaldó y retiró únicamente
node_modules/.package-lock.json, se reconcilió la instalación sin scripts y se
contrastaron package.json físicos, lock e integridades. El contrato impide dar
por seguro un árbol que sólo haya actualizado sus metadatos.

Auditoría posterior: cero high/critical, 28 moderate y tres low. Producción:
14 moderate y tres low. Persisten cadenas antiguas de imágenes, globs, herramientas
y Google Workspace; no se forzaron mayores sobre consumidores antiguos para
silenciar avisos. Gemini y Workspace son capacidades distintas: esta unidad no
retira integraciones de calendario, correo o Drive.

Los dos contratos nuevos pasan con HTTP local real. Los contratos de documentos,
imágenes y nut-js forman parte de la compuerta de calidad. No se ejecutaron
payloads de inyección, comandos destructivos ni scripts de instalación.

El build aislado pasó. La compuerta final y la revisión propia se registran en
la verificación del cambio retire-google-ai-provider; revisión independiente,
cuentas reales, instalación y certificación multiplataforma siguen pendientes.

[Auditoría y delta del lock](dependency-audit.json).
[Aviso de systeminformation](https://github.com/sebhildebrandt/systeminformation/security/advisories/GHSA-3f7j-7jwc-fxfj).
[Aviso de follow-redirects](https://github.com/follow-redirects/follow-redirects/security/advisories/GHSA-mrwp-f3q8-3g9p).


Resultado final: verify:pr y app:smoke:build con código 0; 7096 pruebas Vitest,
64 del tooling y 33 de Python aprobadas; cinco Vitest omitidas. El lint cambiante
no incorpora deuda nueva. Fuente y recibos en
[la verificación compartida](../../retire-google-ai-provider/reports/latest-verification.json).
La revisión propia no sustituye a revisión independiente.
