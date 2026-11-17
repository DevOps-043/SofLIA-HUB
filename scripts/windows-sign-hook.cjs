const { runSigning } = require('./windows-signing.cjs');
module.exports = async function signWindowsFile(configuration) {
  runSigning('SignFile', configuration.path);
};
