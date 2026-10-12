const { app, BrowserWindow, WebContentsView } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const modeArg = process.argv.find((arg) => arg.startsWith('--mode='));
const mode = modeArg?.slice('--mode='.length);
if (mode !== 'baseline' && mode !== 'optimized') {
  throw new Error('Usa --mode=baseline o --mode=optimized.');
}
const profilePath = path.join(os.tmpdir(), `soflia-resource-benchmark-${mode}`);
fs.mkdirSync(profilePath, { recursive: true });
app.setPath('userData', profilePath);

const SAMPLE_INTERVAL_MS = 2_000;
const WARMUP_MS = 6_000;
const SUSPEND_AT_MS = 10_000;
const FINISH_AT_MS = 24_000;
const views = [];
const samples = [];

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1_200, height: 800, show: false });
  for (let index = 0; index < 3; index += 1) {
    const view = new WebContentsView({
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: mode === 'optimized',
      },
    });
    window.contentView.addChildView(view);
    view.setBounds({ x: 0, y: 0, width: 1_200, height: 800 });
    view.setVisible(index === 0);
    if (mode === 'optimized') view.webContents.setBackgroundThrottling(index !== 0);
    views.push(view);
  }

  await Promise.all(views.map((view, index) => view.webContents.loadURL(dynamicFixtureUrl(index))));
  app.getAppMetrics(); // Ceba el contador de CPU; la primera lectura siempre es cero.
  const startedAt = Date.now();
  let suspended = false;

  const sampler = setInterval(() => {
    const elapsedMs = Date.now() - startedAt;
    if (mode === 'optimized' && !suspended && elapsedMs >= SUSPEND_AT_MS) {
      suspended = true;
      const cold = views[1];
      window.contentView.removeChildView(cold);
      cold.webContents.close({ waitForBeforeUnload: false });
    }
    if (elapsedMs >= WARMUP_MS) samples.push(aggregate(app.getAppMetrics(), elapsedMs));
    else app.getAppMetrics();

    if (elapsedMs < FINISH_AT_MS) return;
    clearInterval(sampler);
    const summary = summarize(mode, samples);
    process.stdout.write(`[BENCHMARK_RESULT]${JSON.stringify(summary)}\n`);
    // El runtime beta usado por el proyecto puede conservar procesos auxiliares
    // después de cerrar una WebContentsView sintética. La medición ya terminó:
    // una salida determinista evita contaminar la segunda corrida.
    setTimeout(() => process.exit(0), 100);
  }, SAMPLE_INTERVAL_MS);
});

function dynamicFixtureUrl(index) {
  const html = `<!doctype html><meta charset="utf-8"><title>fixture-${index}</title>
    <style>@keyframes pulse{from{transform:translateX(0)}to{transform:translateX(300px)}}
    #box{width:80px;height:80px;background:#00d6be;animation:pulse .7s alternate infinite}</style>
    <div id="box"></div><output id="out"></output><script>
    const retained = Array.from({length: 3}, () => new Uint8Array(8 * 1024 * 1024));
    for (const block of retained) for (let i = 0; i < block.length; i += 4096) block[i] = ${index + 1};
    let tick = 0; setInterval(() => {
      let value = tick++; for (let i = 0; i < 140000; i++) value = Math.sin(value + i) * Math.cos(i);
      document.getElementById('out').textContent = String(value) + ':' + tick;
    }, 16);</script>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function aggregate(metrics, elapsedMs) {
  return {
    elapsedMs,
    cpuPercent: round(metrics.reduce((sum, metric) => sum + finite(metric.cpu?.percentCPUUsage), 0)),
    workingSetMb: round(metrics.reduce((sum, metric) => sum + finite(metric.memory?.workingSetSize) / 1024, 0)),
    processes: metrics.length,
    tabs: metrics.filter((metric) => metric.type === 'Tab').length,
  };
}

function summarize(benchmarkMode, values) {
  const steady = values.slice(Math.max(0, values.length - 5));
  return {
    mode: benchmarkMode,
    scenario: 'tres-pestanas-dinamicas-locales',
    acceleratedColdTabGraceMs: benchmarkMode === 'optimized' ? SUSPEND_AT_MS : null,
    sampleCount: steady.length,
    cpuPercentAverage: average(steady.map((sample) => sample.cpuPercent)),
    workingSetMbAverage: average(steady.map((sample) => sample.workingSetMb)),
    processCountAverage: average(steady.map((sample) => sample.processes)),
    tabProcessCountAverage: average(steady.map((sample) => sample.tabs)),
    samples: steady,
  };
}

function average(values) {
  return values.length === 0 ? 0 : round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function round(value) {
  return Math.round(value * 100) / 100;
}
