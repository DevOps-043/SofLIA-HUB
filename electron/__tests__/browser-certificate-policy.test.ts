import { describe, expect, it } from 'vitest';
import { browserCertificateDecision } from '../integrated-browser/certificate-policy';

/**
 * Electron entrega el veredicto como `net::ErrorToString()`, de modo que una
 * cadena válida llega como `net::OK`. Comparar contra el literal `OK` que
 * documentan los typings rechazaba todos los certificados públicos y dejaba el
 * navegador sin poder cargar ningún sitio (`ERR_FAILED (-2)`). El camino de
 * aceptación no estaba cubierto: sólo se probaba el rechazo, así que el fallo
 * pasaba desapercibido.
 */
describe('browserCertificateDecision', () => {
  it('acepta con -3 el veredicto real de una cadena válida', () => {
    expect(browserCertificateDecision('net::OK')).toBe(-3);
  });

  it('acepta con -3 el literal documentado, por si cambia el formato', () => {
    expect(browserCertificateDecision('OK')).toBe(-3);
  });

  it('rechaza con -2 los errores de certificado', () => {
    for (const result of [
      'net::ERR_CERT_AUTHORITY_INVALID',
      'net::ERR_CERT_DATE_INVALID',
      'net::ERR_CERT_REVOKED',
      'net::ERR_CERT_COMMON_NAME_INVALID',
      'ERR_CERT_AUTHORITY_INVALID',
    ]) {
      expect(browserCertificateDecision(result)).toBe(-2);
    }
  });

  it('rechaza con -2 cuando no hay veredicto', () => {
    expect(browserCertificateDecision(undefined)).toBe(-2);
    expect(browserCertificateDecision('')).toBe(-2);
  });

  it('no acepta mediante 0, que desactivaría Certificate Transparency', () => {
    for (const result of ['net::OK', 'OK', 'net::ERR_CERT_REVOKED', undefined]) {
      expect(browserCertificateDecision(result)).not.toBe(0);
    }
  });

  it('no confunde un error que contenga OK con un veredicto válido', () => {
    expect(browserCertificateDecision('net::ERR_CERT_OK_UNKNOWN')).toBe(-2);
    expect(browserCertificateDecision('NOT_OK')).toBe(-2);
  });
});
