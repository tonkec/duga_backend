const { redactForLogs } = require('./logRedaction');

const PATCHED = Symbol.for('duga.safeConsole.patched');
const METHODS = ['error', 'info', 'log', 'warn'];

if (!console[PATCHED]) {
  METHODS.forEach((method) => {
    const original = console[method].bind(console);
    console[method] = (...args) =>
      original(...args.map((arg) => redactForLogs(arg)));
  });

  Object.defineProperty(console, PATCHED, {
    value: true,
    enumerable: false,
  });
}

module.exports = console;
