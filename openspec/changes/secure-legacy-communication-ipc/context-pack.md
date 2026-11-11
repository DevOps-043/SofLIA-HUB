# Contexto del cambio

- Objetivo: extender guardas nativas a las diez APIs WhatsApp y cinco Telegram heredadas.
- Actor: sesión main con selección privada de organización y rol SOFIA vigente.
- Alcance: registro canónico, gateway/confirmación/cuota compartidos con channels, DTO/schema, eventos autorizados y UI que honra cancelación/error.
- No objetivos: aislamiento/cifrado del transporte físico y su historia por cuenta, cambios de RLS o mensajería/configuración reales en QA.
- Restricciones: conservar 526 canales, modularidad y delta acumulado. Respaldos contra lote 48 en TEMP/soflia-legacy-channels-2026-10-30.
- Contratos: startup/service-ipc/service-events, handlers canónicos, preload/allowlist y wrappers/hooks.
- Riesgos/HITL: configuración, conexión, clave y envío requieren snapshot aprobado y rol revalidado después. El historial es físico global y sólo se consulta por administración explícita.
- Criterios: fuente/actor inválidos sin efectos; member sin administración global; A/B/A y org invalidan; sin QR/estado a espectadores no autorizados; sin setters al abrir ni estado UI exitoso tras cancelar; SDK persistente fuera de lease.
- Incertidumbres: metadata histórica no prueba ownership de cuenta; no afirmar aislamiento integral. Los agentes runtime conservan su autorización propia.
