// Vistas reales y actividad simulada; sólo usa contenido local temporal.
const assert = require('node:assert/strict');
const { WebContentsView } = require('electron');

module.exports = async function verifyResourcePolicy(window, BrowserResourcePolicy, check) {
  const tabs = [];
  const retired = [];
  let workActive = true;
  const createView = () => new WebContentsView({ webPreferences: {
    sandbox: true, contextIsolation: true, nodeIntegration: false,
    partition: 'pulse-smoke-private-resources',
  } });
  for (let index = 0; index < 3; index++) {
    const view = createView();
    window.contentView.addChildView(view);
    await view.webContents.loadURL('about:blank');
    tabs.push({ id: `temporal-${index}`, lastActivatedAt: index, view, snapshot: null });
  }
  const limits = { maxLiveTabs: 2, warmBackgroundTabs: 1, coldGraceMs: 90_000, hiddenGraceMs: 30_000, retryMs: 30_000 };
  const policy = new BrowserResourcePolicy({
    liveTabs: () => tabs.filter(tab => tab.view && !tab.view.webContents.isDestroyed()),
    isLayoutProtected: tab => tab === tabs[0],
    isPresented: tab => tab === tabs[0],
    hasProtectedWork: tab => tab === tabs[1] && workActive,
    isParentUsable: () => true,
    setThrottling: (tab, allowed) => tab.view.webContents.setBackgroundThrottling(allowed),
    retire: tab => {
      const view = tab.view;
      tab.snapshot = view.webContents.getURL();
      tab.view = null;
      window.contentView.removeChildView(view);
      retired.push(new Promise(resolve => view.webContents.once('destroyed', resolve)));
      view.webContents.close({ waitForBeforeUnload: false });
    },
    changed: () => {},
    periodicError: () => { throw new Error('No se esperaba un fallo de política nativa.'); },
  }, limits);
  try {
    policy.reconcile();
    await Promise.all(retired);
    assert.ok(tabs[1].view && !tabs[1].view.webContents.isDestroyed());
    assert.equal(tabs[2].view, null);
    assert.equal(tabs[0].view.webContents.getBackgroundThrottling(), false);
    assert.equal(tabs[1].view.webContents.getBackgroundThrottling(), true);
    check('presupuesto nativo conserva actividad protegida y aplica throttling a vistas reales');
    workActive = false;
    limits.maxLiveTabs = 3;
    policy.reconcile(Date.now() + 100_000);
    // La segunda es warm: añadir otra reciente permite comprobar inactividad.
    const view = createView();
    window.contentView.addChildView(view);
    await view.webContents.loadURL('about:blank');
    tabs.push({ id: 'temporal-3', lastActivatedAt: Date.now(), view, snapshot: null });
    policy.reconcile(Date.now() + 100_000);
    await Promise.all(retired);
    assert.equal(tabs[1].view, null);
    assert.equal(tabs[1].snapshot, 'about:blank');
    assert.equal(tabs[1].id, 'temporal-1');
    check('retirada nativa cierra la vista y conserva identidad y snapshot lógico');
    tabs[1].view = createView();
    window.contentView.addChildView(tabs[1].view);
    await tabs[1].view.webContents.loadURL(tabs[1].snapshot);
    assert.equal(tabs[1].view.webContents.getURL(), tabs[1].snapshot);
    check('la pestaña lógica puede rematerializarse desde su snapshot local');
  } finally {
    policy.stop();
    for (const tab of tabs) {
      if (!tab.view || tab.view.webContents.isDestroyed()) continue;
      window.contentView.removeChildView(tab.view);
      tab.view.webContents.close({ waitForBeforeUnload: false });
    }
  }
};
