import type { WebContents } from 'electron';
import { AGENT_WORLD_ID } from './agent-world';
import { validateBrowserSensitiveReason, type BrowserSensitiveReason } from '../../src/shared/browser-sensitive-handoff';

/** Sólo devuelve una categoría. La sonda y su indicador nunca salen del mundo aislado. */
export const BROWSER_SENSITIVE_PROBE = `(() => {
  const key = '__sofliaSensitiveDocumentV1';
  if (!window[key]) {
    const state = { reason: null };
    Object.defineProperty(window, key, { value: state, configurable: false, writable: false });
    const normalize = value => String(value || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
    const sensitiveText = text => {
      const value = normalize(text);
      if (/\\b(password|contrasena|passphrase|seed phrase|recovery phrase|frase de recuperacion|api[_ -]?key|clave privada|one.time.password|codigo de verificacion)\\b/.test(value)) return 'secret';
      if (/\\b(credit.card|debit.card|tarjeta de credito|tarjeta de debito|card.number|numero de tarjeta|cvv|cvc|checkout|confirmar pago|pagar|pay now|place order|confirm purchase|confirmar compra|transferir dinero)\\b/.test(value)) return 'payment';
      if (/\\b(historia clinica|historial medico|medical record|diagnostico medico|prescripcion|prescription|patient record|expediente clinico)\\b/.test(value)) return 'medical';
      if (/\\b(passport|pasaporte|social.security|seguro social|national.id|curp|documento de identidad)\\b/.test(value)) return 'identity';
      return null;
    };
    const visible = element => {
      if (!(element instanceof Element)) return false;
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
    };
    const scan = (root, budget = { count: 0, chars: 0, started: performance.now() }) => {
      if (state.reason || !document?.documentElement) return;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
      let node = root;
      while (node && !state.reason) {
        if (++budget.count > 4000 || performance.now() - budget.started > 50) { state.reason = 'uninspectable'; break; }
        const element = node instanceof Element ? node : node.parentElement;
        if (element && visible(element)) {
          if (node.nodeType === Node.TEXT_NODE && !['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(element.tagName)) {
            const text = node.textContent || ''; budget.chars += text.length;
            if (budget.chars > 50000) { state.reason = 'uninspectable'; break; }
            state.reason = sensitiveText(text);
          } else if (node instanceof Element) {
            const tag = node.tagName;
            if (['IFRAME', 'FRAME', 'CANVAS', 'EMBED', 'OBJECT'].includes(tag) || (tag.includes('-') && !node.shadowRoot)) state.reason = 'uninspectable';
            if (node.shadowRoot) scan(node.shadowRoot, budget);
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || node.isContentEditable) {
              const meta = [node.getAttribute('type'), node.getAttribute('autocomplete'), node.getAttribute('name'), node.getAttribute('id'), node.getAttribute('aria-label'), node.getAttribute('placeholder')].join(' ');
              const token = normalize(meta);
              if (node.type === 'password' || /current-password|new-password|one-time-code/.test(token)) state.reason = 'secret';
              else if (/\\bcc-(name|number|exp|csc|type)/.test(token)) state.reason = 'payment';
              else if (/\\b(name|given-name|family-name|email|tel|street-address|address-line|postal-code|bday)\\b/.test(normalize(node.autocomplete))) state.reason = 'identity';
              else state.reason = sensitiveText(meta) || state.reason;
              if (!state.reason) {
                let autofilled = false; try { autofilled = node.matches(':-webkit-autofill'); } catch {}
                if (autofilled) state.reason = 'autofill';
                const search = tag === 'INPUT' && (node.type === 'search' || (node.name === 'q' && node.closest('[role="search"],form[action*="search"]')));
                if (!state.reason && node.type !== 'hidden' && !['button', 'submit', 'reset', 'image'].includes(node.type) && !search) state.reason = 'form';
              }
            }
          }
        }
        node = walker.nextNode();
      }
    };
    state.scan = () => { if (state.reason || !document?.documentElement) return; state.reason = sensitiveText(location.pathname); scan(document.documentElement); };
    const observer = new MutationObserver(records => {
      const started = performance.now(); let count = 0;
      for (const record of records) {
        if (state.reason) break;
        if (++count > 128 || performance.now() - started > 50) { state.reason = 'uninspectable'; break; }
        if (record.oldValue) state.reason = record.oldValue.length > 50000 ? 'uninspectable' : sensitiveText(record.oldValue);
        for (const node of record.addedNodes) {
          if (state.reason) break;
          if (++count > 128 || performance.now() - started > 50) { state.reason = 'uninspectable'; break; }
          scan(node);
        }
      }
      state.scan();
    });
    observer.observe(document, { subtree: true, childList: true, attributes: true, characterData: true, attributeOldValue: true, characterDataOldValue: true });
    document.addEventListener('input', state.scan, true); document.addEventListener('change', state.scan, true);
  }
  window[key].scan();
  return { reason: window[key].reason };
})()`;

export async function inspectBrowserSensitivePage(contents: WebContents): Promise<BrowserSensitiveReason | null> {
  if (typeof contents.executeJavaScriptInIsolatedWorld !== 'function') return 'uninspectable';
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      contents.executeJavaScriptInIsolatedWorld(AGENT_WORLD_ID, [{ code: BROWSER_SENSITIVE_PROBE }]),
      new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('Inspección vencida.')), 3000); }),
    ]);
    if (!result || typeof result !== 'object' || Object.keys(result).join(',') !== 'reason') return 'uninspectable';
    return validateBrowserSensitiveReason(result.reason);
  } catch { return 'uninspectable'; }
  finally { clearTimeout(timer); }
}
