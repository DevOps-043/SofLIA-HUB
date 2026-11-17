const path = require('node:path');
const { runSigning } = require('./windows-signing.cjs');

module.exports = async function verifySignedWindowsApp(context) {
  if (context.electronPlatformName !== 'win32') return;
  if (process.env.SOFLIA_UNSIGNED_QA === '1' && context.packager.platformSpecificBuildOptions.signExecutable === false
    && context.packager.platformSpecificBuildOptions.forceCodeSigning === false) return;
  runSigning('VerifyTree', context.appOutDir);
  runSigning('VerifyFile', path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`), { requirePublisher: true });
  runSigning('VerifyFile', path.join(context.appOutDir, 'resources/voice-engine/Soflia-Voice-Engine.exe'), { requirePublisher: true });
};
