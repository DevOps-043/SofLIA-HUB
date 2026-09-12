/** Se ejecuta sólo en el mundo aislado de la bóveda, nunca en el del agente. */
function installCredentialObserver(bindingName: string) {
  if (window !== window.top || !isSecureContext) return;
  const scope = globalThis as unknown as Record<string, unknown>;
  if (typeof scope.__sofliaCredentialObserverStop === 'function') return;
  const bridge = scope[bindingName];
  if (typeof bridge !== 'function') return;
  let gesture: { form: HTMLFormElement; at: number } | null = null;
  let lastOffered = -Infinity;
  const visible = (input: HTMLInputElement) => !input.disabled && !input.readOnly
    && input.getClientRects().length > 0 && getComputedStyle(input).visibility === 'visible';
  const offer = (form: HTMLFormElement | null, submitter: Element | null) => {
    try {
      if (performance.now() - lastOffered < 1_000) return;
      const defaultSubmitter = form && !submitter ? Array.from(form.elements).find(element =>
        (element instanceof HTMLButtonElement || element instanceof HTMLInputElement) && element.type === 'submit') : null;
      const action = (submitter ?? defaultSubmitter)?.getAttribute('formaction') ?? form?.action ?? location.href;
      if (new URL(action, location.href).origin !== location.origin) return;
      const elements = form ? Array.from(form.elements) : Array.from(document.querySelectorAll('input')).filter(input => !input.form);
      if (elements.length > 200) return;
      const inputs = elements.filter((element): element is HTMLInputElement => element instanceof HTMLInputElement && visible(element));
      const passwords = inputs.filter((input) => input.type === 'password');
      const fresh = passwords.filter((input) => input.autocomplete === 'new-password');
      const chosen = fresh.length ? fresh : passwords;
      if (!chosen.length || chosen.length > 2 || (!fresh.length && passwords.length > 1)
        || chosen.some((input) => input.value !== chosen[0].value)) return;
      const usernameFields = inputs.filter((input) => input.type === 'email' || input.type === 'text');
      const named = usernameFields.filter((input) => input.autocomplete === 'username');
      const usernames = named.length ? named : usernameFields;
      if (usernames.length !== 1) return;
      const username = usernames[0].value.trim();
      const password = chosen[0].value;
      if (!username || username.length > 320 || !password || password.length > 4_096) return;
      lastOffered = performance.now();
      bridge(JSON.stringify({ origin: location.origin, username, password }));
    } catch { /* Ni errores del DOM ni secretos se publican en consola. */ }
  };
  const click = (event: MouseEvent) => {
    if (!event.isTrusted || event.button !== 0 || !(event.target instanceof Element)) return;
    const button = event.target.closest('button, input');
    if (!(button instanceof HTMLButtonElement || button instanceof HTMLInputElement) || button.disabled
      || !['button', 'submit'].includes(button.type)) return;
    if (button.type === 'submit' && button.form) gesture = { form: button.form, at: performance.now() };
    const label = (button.getAttribute('aria-label') || (button instanceof HTMLInputElement ? button.value : button.textContent) || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    // Cubre SPA sin interpretar cualquier clic como envío de credenciales.
    if (/^(iniciar sesion|inicia sesion|acceder|entrar|continuar|registrarse|crear cuenta|guardar contrasena|sign in|log in|login|sign up|continue)$/.test(label)) {
      offer(button.form, button);
    }
  };
  const keydown = (event: KeyboardEvent) => {
    if (!event.isTrusted || event.key !== 'Enter' || event.isComposing || event.repeat
      || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
    if (event.target instanceof HTMLInputElement && visible(event.target)) {
      if (event.target.form) gesture = { form: event.target.form, at: performance.now() };
      offer(event.target.form, null);
    }
  };
  const submit = (event: SubmitEvent) => {
    const approval = gesture; gesture = null;
    if (!event.isTrusted || !approval || event.target !== approval.form
      || performance.now() - approval.at > 1_000) return;
    offer(approval.form, event.submitter);
  };
  document.addEventListener('click', click, true);
  document.addEventListener('keydown', keydown, true);
  document.addEventListener('submit', submit, true);
  scope.__sofliaCredentialObserverStop = () => {
    gesture = null;
    document.removeEventListener('click', click, true);
    document.removeEventListener('keydown', keydown, true);
    document.removeEventListener('submit', submit, true);
    delete scope.__sofliaCredentialObserverStop;
  };
}

export const CREDENTIAL_WORLD = 'soflia-credential-vault';
export const CREDENTIAL_BINDING = '__sofliaCredentialCandidate';
export const CREDENTIAL_OBSERVER_SOURCE = `(${installCredentialObserver.toString()})(${JSON.stringify(CREDENTIAL_BINDING)})`;
