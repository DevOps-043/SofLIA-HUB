const path = require('node:path');
const { execFileSync } = require('node:child_process');

function signingConfiguration(env = process.env) {
  const provider = env.SOFLIA_SIGNING_PROVIDER;
  if (!['azure', 'certificate-store'].includes(provider)) throw new Error('Configura SOFLIA_SIGNING_PROVIDER: azure o certificate-store.');
  const required = ['SOFLIA_WINDOWS_PUBLISHER'];
  if (provider === 'azure') required.push('SOFLIA_SIGNING_ENDPOINT', 'SOFLIA_SIGNING_ACCOUNT', 'SOFLIA_SIGNING_PROFILE', 'SOFLIA_SIGNING_DLIB_PATH', 'AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET');
  else required.push('SOFLIA_SIGNING_CERTIFICATE_SHA1');
  for (const key of required) {
    if (typeof env[key] !== 'string' || !env[key].trim() || /[\r\n\0]/u.test(env[key])) throw new Error(`Falta configuración de firma válida: ${key}.`);
  }
  if (provider === 'azure') {
    const endpoint = new URL(env.SOFLIA_SIGNING_ENDPOINT);
    if (endpoint.protocol !== 'https:' || !/^[a-z0-9-]+\.codesigning\.azure\.net$/u.test(endpoint.hostname)
      || endpoint.username || endpoint.password || endpoint.port || endpoint.search || endpoint.hash || endpoint.pathname !== '/') throw new Error('Endpoint de Artifact Signing no permitido.');
  } else if (!/^[a-f\d]{40}$/iu.test(env.SOFLIA_SIGNING_CERTIFICATE_SHA1)) throw new Error('El thumbprint del certificado debe contener 40 dígitos hexadecimales.');
  return { provider, publisher: env.SOFLIA_WINDOWS_PUBLISHER };
}

function runSigning(action, target, options = {}) {
  if (!['Check', 'SignFile', 'SignTree', 'VerifyFile', 'VerifyTree'].includes(action)) throw new Error('Acción de firma no permitida.');
  const env = options.env || process.env;
  if (action.startsWith('Sign') || action === 'Check') signingConfiguration(env);
  const executable = path.join(env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const args = ['-NoProfile', '-NonInteractive', '-File', path.join(__dirname, 'windows-signing.ps1'), '-Action', action];
  if (target) args.push('-Target', path.resolve(target));
  if (options.requirePublisher) args.push('-RequirePublisher');
  const output = (options.execute || execFileSync)(executable, args, {
    env, encoding: 'utf8', windowsHide: true, timeout: 30 * 60_000, maxBuffer: 2 * 1024 * 1024,
  });
  return output.trim() ? JSON.parse(output.trim().replace(/^\uFEFF/u, '')) : null;
}

module.exports = { signingConfiguration, runSigning };
if (require.main === module) {
  try { console.log(JSON.stringify(runSigning(process.argv[2] || 'Check', process.argv[3]))); }
  catch (error) { console.error(`[Firma Windows] ${error.message}`); process.exitCode = 1; }
}
