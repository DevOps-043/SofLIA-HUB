/** -3 conserva Chromium y Certificate Transparency; jamás aceptar mediante 0. */
export function browserCertificateDecision(verificationResult: string | undefined): -3 | -2 {
  return verificationResult === 'OK' ? -3 : -2;
}
