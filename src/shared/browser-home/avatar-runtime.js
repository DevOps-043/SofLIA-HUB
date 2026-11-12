/* Adaptador nativo sin Node, IPC, red ni dependencias remotas. */
(() => {
  const root = document.getElementById('home-avatar');
  const query = document.getElementById('query');
  const config = JSON.parse(document.getElementById('home-avatar-config').content.textContent);
  const rules = config.rules.map(rule => ({ ...rule, regex: new RegExp(rule.pattern, 'i') }));
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  let expression = 'curious'; let frame = 0; let previous = 0; let elapsed = 0;
  let pointer = null; let gazeX = 0; let gazeY = 0; let blinkAt = 3200;
  const pose = { float: 0, drift: 0, sway: 0, face: 0, faceX: 0, faceTilt: 0 };
  const style = (name, value, suffix = '') => root.style.setProperty('--avatar-' + name, value.toFixed(4) + suffix);
  const mix = (a, b, dt, response = 110) => a + (b - a) * (1 - Math.exp(-dt / response));
  const select = () => {
    const value = query.value.slice(0, 4000).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const next = value.trim() ? rules.find(rule => rule.regex.test(value))?.expression || 'curious' : 'idle';
    if (next === expression) return;
    expression = next;
    const template = document.querySelector('[data-avatar-template="' + expression + '"]');
    root.querySelector('.soflia-avatar__gaze').replaceChildren(template.content.cloneNode(true));
    root.dataset.expression = expression;
    root.setAttribute('aria-label', 'SofLIA: ' + config.labels[expression]);
  };
  const update = now => {
    frame = 0;
    if (document.hidden || media.matches) return;
    const dt = previous ? Math.min(64, now - previous) : 16; previous = now; elapsed += dt;
    const profile = config.profiles[expression];
    const phase = elapsed / 1000 * Math.PI * 2 / profile.period;
    const rect = root.getBoundingClientRect();
    let x = 0; let y = 0;
    if (pointer && rect.width && rect.height) {
      const px = (pointer.x - rect.left - rect.width * .51) / (rect.width * .5);
      const py = (pointer.y - rect.top - rect.height * .51) / (rect.height * .5);
      const distance = Math.hypot(px, py);
      const falloff = Math.max(0, Math.min(1, (4.5 - distance) / 1.35));
      x = Math.max(-1, Math.min(1, px)) * falloff; y = Math.max(-1, Math.min(1, py)) * falloff;
    }
    gazeX = mix(gazeX, x, dt); gazeY = mix(gazeY, y, dt);
    const targets = { float: Math.sin(phase) * profile.vertical * rect.height, drift: Math.sin(phase * .5) * profile.horizontal * rect.width,
      sway: (profile.restTilt || 0) + Math.sin(phase * .5) * profile.tilt,
      face: Math.sin(phase + .35) * profile.face * rect.height,
      faceX: Math.sin(phase * .75) * profile.faceHorizontal * rect.width,
      faceTilt: Math.sin(phase * .5 + .5) * profile.faceTilt + gazeX * 1.8 };
    Object.keys(pose).forEach(key => { pose[key] = mix(pose[key], targets[key], dt); });
    style('float', pose.float, 'px'); style('drift', pose.drift, 'px'); style('sway', pose.sway, 'deg');
    style('face-lift', pose.face, 'px'); style('face-x', pose.faceX, 'px'); style('face-tilt', pose.faceTilt, 'deg');
    style('gaze-x', gazeX * 2.7, '%'); style('gaze-y', gazeY * 1.8, '%');
    if (elapsed > blinkAt + 170) blinkAt = elapsed + 3200 + Math.random() * 2500;
    style('blink', elapsed >= blinkAt ? 1 - Math.sin((elapsed - blinkAt) / 170 * Math.PI) * .96 : 1);
    style('pulse', .5 + Math.sin(phase) * .5); style('counter-pulse', .5 + Math.sin(phase + Math.PI * .7) * .5);
    style('eye-open', 1 + Math.sin(phase) * .06); style('brow-lift', -1 - Math.sin(phase) * 1.5, 'px');
    frame = requestAnimationFrame(update);
  };
  const reconcile = () => {
    cancelAnimationFrame(frame); frame = 0; previous = 0;
    const running = !document.hidden && !media.matches;
    root.dataset.running = String(running);
    if (running) frame = requestAnimationFrame(update);
  };
  query.addEventListener('input', select);
  window.addEventListener('pointermove', event => { if (event.pointerType !== 'touch') pointer = { x: event.clientX, y: event.clientY }; }, { passive: true });
  window.addEventListener('blur', () => { pointer = null; });
  window.addEventListener('pointerout', event => { if (!event.relatedTarget) pointer = null; });
  document.addEventListener('visibilitychange', reconcile); media.addEventListener('change', reconcile);
  reconcile();
})();
