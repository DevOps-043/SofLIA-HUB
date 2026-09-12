# Verificación de privacidad y fingerprinting compatible

Fecha: 2026-09-05. Rama: `codex/upgrade-integrated-browser`.

En privacidad estricta el navegador elimina client hints de alta entropía
(`Sec-CH-UA-Full-Version`, plataforma completa, arquitectura, modelo,
`Device-Memory`, `DPR`, viewport y red) y retira `Accept-CH`/`Critical-CH` de
las respuestas. Se conservan `Sec-CH-UA`, plataforma básica y User-Agent
normalizado para no romper compatibilidad. El contador local registra la
categoría `fingerprinting` cuando se retiraron cabeceras.

Evidencia: `electron/__tests__/integrated-browser-tracking-protection.test.ts`
valida eliminación case-insensitive y conservación de hints básicos; la
regresión focalizada actualizada de 59 archivos y 694 pruebas permanece aprobada.

El alcance no pretende neutralizar APIs de fingerprinting de JavaScript ni
reemplaza una navegación segura remota; esos riesgos permanecen documentados.
