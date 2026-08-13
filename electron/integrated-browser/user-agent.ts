/**
 * Conserva la versión real de Chromium y retira únicamente las marcas que
 * Electron agrega al User-Agent. Google usa también el fallback global en
 * service workers y ventanas durante su creación, antes de que exista un
 * `WebContents` sobre el que aplicar un override individual.
 */
export function toStandardChromiumUserAgent(userAgent: string): string {
  return userAgent
    .replace(/\s+Electron\/\d+(?:\.\d+)*(?:-[\w.-]+)?/gi, '')
    .replace(/\s+[\w.-]+\/\d+(?:\.\d+)*(?:-[\w.-]+)?(?=\s+Chrome\/)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Configura y devuelve el fallback para poder verificar la mutación sin Electron. */
export function configureChromiumUserAgentFallback(target: { userAgentFallback: string }): string {
  const userAgent = toStandardChromiumUserAgent(target.userAgentFallback);
  target.userAgentFallback = userAgent;
  return userAgent;
}
