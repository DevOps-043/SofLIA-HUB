export function isOrbWindow(): boolean {
  const argv = (window as Window & { process?: { argv?: unknown } }).process?.argv;
  return new URLSearchParams(window.location.search).get('view') === 'orb'
    || (Array.isArray(argv) && argv.includes('--view-mode=orb'));
}
