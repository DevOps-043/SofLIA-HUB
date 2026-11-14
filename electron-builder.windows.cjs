const fs = require('node:fs');
const path = require('node:path');
const { signingConfiguration, runSigning } = require('./scripts/windows-signing.cjs');
const { publisher } = signingConfiguration();
const descriptor = JSON.parse(fs.readFileSync(path.join(__dirname, 'voice-engine/descriptor.json'), 'utf8'));
const { version } = require('./package.json');
if (descriptor.version !== version) throw new Error('El motor preparado no corresponde a esta versión. Ejecuta voice:prepare.');
const verified = runSigning('VerifyFile', path.join(__dirname, 'voice-engine/Soflia-Voice-Engine.exe'), { requirePublisher: true });

module.exports = {
  extends: './electron-builder.json5',
  extraMetadata: { sofliaVoiceEngine: { version, subject: verified.subject } },
  win: {
    signtoolOptions: { publisherName: publisher },
    extraResources: [{ from: 'voice-engine', to: 'voice-engine', filter: ['Soflia-Voice-Engine.exe'] }],
  },
};
