/**
 * Decide qué devolver a `setCertificateVerifyProc`.
 *
 * `-3` conserva Chromium y Certificate Transparency; jamás aceptar mediante `0`.
 *
 * El veredicto llega como `net::ErrorToString()`, así que un certificado válido
 * se anuncia `net::OK`, no `OK`. La documentación de Electron describe el campo
 * como «`OK` if the certificate is trusted», y comparar contra ese literal
 * rechazaba todas las cadenas válidas: la verificación devolvía `-2` y la
 * conexión moría como `ERR_FAILED (-2)` antes de completar el handshake TLS.
 * Se normaliza el prefijo para no depender de cómo lo formatee cada versión.
 */
export function browserCertificateDecision(verificationResult: string | undefined): -3 | -2 {
  return verificationResult?.replace(/^net::/, '') === 'OK' ? -3 : -2;
}
