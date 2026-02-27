const puppeteer = require('puppeteer');

const CANDIDATE_URLS = [
  process.env.PREVIEW_URL,
  'http://127.0.0.1:7456',
  'http://localhost:7456',
  'http://192.168.10.100:7456',
].filter(Boolean);

async function openPreview(page) {
  let lastError = null;
  for (const url of CANDIDATE_URLS) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      return url;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('No preview URL available');
}

function overlap(a, b) {
  return !(a.maxX < b.minX || b.maxX < a.minX || a.maxY < b.minY || b.maxY < a.minY);
}

async function collectLayout(page) {
  return page.evaluate(() => {
    const scene = cc?.director?.getScene?.();
    if (!scene) {
      return { ok: false, reason: 'scene not loaded' };
    }

    const findByName = (root, name) => {
      if (!root) return null;
      if (root.name === name) return root;
      for (const child of root.children || []) {
        const found = findByName(child, name);
        if (found) return found;
      }
      return null;
    };

    const rectFromNode = (node) => {
      if (!node) return null;
      const transform = node.getComponent?.('cc.UITransform') || node.getComponent?.(cc.UITransform);
      if (!transform || typeof transform.getBoundingBoxToWorld !== 'function') {
        return null;
      }
      const box = transform.getBoundingBoxToWorld();
      return {
        minX: box.x,
        maxX: box.x + box.width,
        minY: box.y,
        maxY: box.y + box.height,
      };
    };

    const unionRect = (a, b) => {
      if (!a) return b;
      if (!b) return a;
      return {
        minX: Math.min(a.minX, b.minX),
        maxX: Math.max(a.maxX, b.maxX),
        minY: Math.min(a.minY, b.minY),
        maxY: Math.max(a.maxY, b.maxY),
      };
    };

    const rectOf = (node) => {
      if (!node) return null;

      const selfRect = rectFromNode(node);
      if (selfRect) {
        return selfRect;
      }

      const btn = node.getComponent?.('cc.Button') || node.getComponent?.(cc.Button);
      const targetRect = rectFromNode(btn?.target);
      if (targetRect) {
        return targetRect;
      }

      let merged = null;
      for (const child of node.children || []) {
        merged = unionRect(merged, rectOf(child));
      }
      return merged;
    };

    const centerOf = (rect) => ({
      x: (rect.minX + rect.maxX) / 2,
      y: (rect.minY + rect.maxY) / 2,
    });

    const overlap = (a, b) => !(a.maxX < b.minX || b.maxX < a.minX || a.maxY < b.minY || b.maxY < a.minY);

    const sceneRoot = findByName(scene, 'Canvas') || scene;
    const root = findByName(sceneRoot, 'Root') || sceneRoot;
    const shopPanel = findByName(root, 'ShopPanel');
    const flowControls = findByName(root, 'FlowControls') || findByName(scene, 'FlowControls');

    if (!shopPanel || !flowControls) {
      return { ok: false, reason: 'ShopPanel or FlowControls missing' };
    }

    const enterGridBtn = findByName(flowControls, 'EnterGridBtn');
    const startBattleBtn = findByName(flowControls, 'StartBattleBtn');
    const continueBtn = findByName(flowControls, 'ContinueNextDayBtn');
    const refreshBtn = findByName(shopPanel, 'RefreshButton') || findByName(shopPanel, 'refreshBtn');

    const shopComp = shopPanel.getComponent('ShopPanel');
    const firstBinding = shopComp?.slotBindings?.[0] ?? null;
    const buyBtn = firstBinding?.buyBtn ?? null;
    const lockBtn = firstBinding?.lockBtn ?? null;

    if (!enterGridBtn || !startBattleBtn || !continueBtn || !refreshBtn || !buyBtn || !lockBtn) {
      return { ok: false, reason: 'required controls missing' };
    }

    const shopRect = rectOf(shopPanel);
    const refreshRect = rectOf(refreshBtn);
    const enterRect = rectOf(enterGridBtn);
    const battleRect = rectOf(startBattleBtn);
    const continueRect = rectOf(continueBtn);
    const buyRect = rectOf(buyBtn);
    const lockRect = rectOf(lockBtn);

    if (!shopRect || !refreshRect || !enterRect || !battleRect || !continueRect || !buyRect || !lockRect) {
      return { ok: false, reason: 'failed to compute bounds' };
    }

    const overlapResult = {
      EnterGridBtn: {
        shopRootOverlap: overlap(shopRect, enterRect),
        refreshOverlap: overlap(refreshRect, enterRect),
      },
      StartBattleBtn: {
        shopRootOverlap: overlap(shopRect, battleRect),
        refreshOverlap: overlap(refreshRect, battleRect),
      },
      ContinueNextDayBtn: {
        shopRootOverlap: overlap(shopRect, continueRect),
        refreshOverlap: overlap(refreshRect, continueRect),
      },
    };

    return {
      ok: true,
      overlapResult,
      points: {
        EnterGridBtn: centerOf(enterRect),
        StartBattleBtn: centerOf(battleRect),
        ContinueNextDayBtn: centerOf(continueRect),
        RefreshButton: centerOf(refreshRect),
        BuyButton: centerOf(buyRect),
        LockButton: centerOf(lockRect),
      },
    };
  });
}

async function emitControlEvent(page, controlName, point) {
  return page.evaluate(({ controlName, point }) => {
    const scene = cc?.director?.getScene?.();
    if (!scene) {
      return false;
    }

    const findByName = (root, name) => {
      if (!root) return null;
      if (root.name === name) return root;
      for (const child of root.children || []) {
        const found = findByName(child, name);
        if (found) return found;
      }
      return null;
    };

    const sceneRoot = findByName(scene, 'Canvas') || scene;
    const root = findByName(sceneRoot, 'Root') || sceneRoot;
    const shopPanel = findByName(root, 'ShopPanel');
    const flowControls = findByName(root, 'FlowControls') || findByName(scene, 'FlowControls');

    const emitTouch = (node) => {
      if (!node) return false;
      const mockEvent = {
        touch: {
          getLocation: () => ({ x: point.x, y: point.y })
        },
        getUILocation: () => ({ x: point.x, y: point.y })
      };
      const eventTypeA = cc?.Node?.EventType?.TOUCH_END || 'touch-end';
      node.emit(eventTypeA, mockEvent);
      if (eventTypeA !== 'touchend') {
        node.emit('touchend', mockEvent);
      }
      return true;
    };

    switch (controlName) {
      case 'EnterGridBtn':
      case 'StartBattleBtn':
      case 'ContinueNextDayBtn': {
        const node = findByName(flowControls, controlName);
        return emitTouch(node);
      }
      case 'RefreshButton': {
        const node = findByName(shopPanel, 'RefreshButton') || findByName(shopPanel, 'refreshBtn');
        return emitTouch(node);
      }
      case 'BuyButton': {
        const comp = shopPanel?.getComponent('ShopPanel');
        const node = comp?.slotBindings?.[0]?.buyBtn ?? null;
        return emitTouch(node);
      }
      case 'LockButton': {
        const comp = shopPanel?.getComponent('ShopPanel');
        const node = comp?.slotBindings?.[0]?.lockBtn ?? null;
        return emitTouch(node);
      }
      default:
        return false;
    }
  }, { controlName, point });
}

async function emitAndCheck(page, logs, controlName, point, expected = [], forbidden = []) {
  const start = logs.length;
  const emitted = await emitControlEvent(page, controlName, point);
  if (!emitted) {
    return { ok: false, reason: `${controlName} emit failed` };
  }

  await new Promise((resolve) => setTimeout(resolve, 300));
  const delta = logs.slice(start);

  for (const text of expected) {
    if (!delta.some((line) => line.includes(text))) {
      return { ok: false, reason: `${controlName} missing expected log: ${text}` };
    }
  }

  for (const text of forbidden) {
    if (delta.some((line) => line.includes(text))) {
      return { ok: false, reason: `${controlName} found forbidden log: ${text}` };
    }
  }

  return { ok: true };
}

async function resetToShop(page) {
  await page.evaluate(() => {
    const scene = cc?.director?.getScene?.();
    if (!scene) {
      return;
    }

    const findByName = (root, name) => {
      if (!root) return null;
      if (root.name === name) return root;
      for (const child of root.children || []) {
        const found = findByName(child, name);
        if (found) return found;
      }
      return null;
    };

    const main = findByName(scene, 'Root')?.getComponent?.('MainScene')
      || findByName(scene, 'Canvas')?.getChildByName?.('Root')?.getComponent?.('MainScene');

    if (!main || typeof main.getCurrentStage !== 'function' || typeof main.transitionToStage !== 'function') {
      return;
    }

    try {
      if (main.getCurrentStage() !== 'shop' && main.canTransitionTo?.('shop')) {
        main.transitionToStage('shop');
      }
    } catch (_e) {
      // best-effort reset only
    }
  });
  await new Promise((resolve) => setTimeout(resolve, 300));
}

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  const logs = [];
  page.on('console', (msg) => logs.push(msg.text()));

  let url;
  try {
    url = await openPreview(page);
  } catch (error) {
    console.error('[UI_TEST] FAIL: unable to open preview URL');
    console.error(String(error));
    await browser.close();
    process.exit(1);
  }

  console.log(`[UI_TEST] Connected: ${url}`);
  await new Promise((resolve) => setTimeout(resolve, 5000));

  const layout = await collectLayout(page);
  if (!layout.ok) {
    console.error(`[UI_TEST] FAIL: ${layout.reason}`);
    await browser.close();
    process.exit(1);
  }

  console.log('[UI_TEST] Touch Area Overlap Report');
  let overlapFailed = false;
  for (const [name, result] of Object.entries(layout.overlapResult)) {
    const pass = !result.shopRootOverlap && !result.refreshOverlap;
    if (!pass) overlapFailed = true;
    console.log(` - ${name}: ${pass ? 'PASS' : 'FAIL'} (shopRootOverlap=${result.shopRootOverlap}, refreshOverlap=${result.refreshOverlap})`);
  }

  if (overlapFailed) {
    console.error('[UI_TEST] Touch Area Overlap: FAIL');
    await browser.close();
    process.exit(1);
  }

  const flowChecks = [
    ['EnterGridBtn', '[MainScene] ENTER_GRID touched!'],
    ['StartBattleBtn', '[MainScene] START_BATTLE touched!'],
    ['ContinueNextDayBtn', '[MainScene] CONTINUE_NEXT_DAY touched!'],
  ];

  for (const [controlName, expectedLog] of flowChecks) {
    await resetToShop(page);
    const currentLayout = await collectLayout(page);
    if (!currentLayout.ok) {
      console.error(`[UI_TEST] FAIL: ${currentLayout.reason}`);
      await browser.close();
      process.exit(1);
    }

    const r = await emitAndCheck(
      page,
      logs,
      controlName,
      currentLayout.points[controlName],
      [expectedLog],
      ['[ShopPanel] REFRESH touched']
    );
    if (!r.ok) {
      console.error(`[UI_TEST] FAIL: ${r.reason}`);
      await browser.close();
      process.exit(1);
    }
  }

  await resetToShop(page);
  const shopLayout = await collectLayout(page);
  if (!shopLayout.ok) {
    console.error(`[UI_TEST] FAIL: ${shopLayout.reason}`);
    await browser.close();
    process.exit(1);
  }

  const refreshCheck = await emitAndCheck(page, logs, 'RefreshButton', shopLayout.points.RefreshButton, ['[ShopPanel] REFRESH touched']);
  if (!refreshCheck.ok) {
    console.error(`[UI_TEST] FAIL: ${refreshCheck.reason}`);
    await browser.close();
    process.exit(1);
  }

  const buyCheck = await emitAndCheck(page, logs, 'BuyButton', shopLayout.points.BuyButton, ['[ShopPanel] BUY touched']);
  if (!buyCheck.ok) {
    console.error(`[UI_TEST] FAIL: ${buyCheck.reason}`);
    await browser.close();
    process.exit(1);
  }

  const lockCheck = await emitAndCheck(page, logs, 'LockButton', shopLayout.points.LockButton, ['[ShopPanel] LOCK touched']);
  if (!lockCheck.ok) {
    console.error(`[UI_TEST] FAIL: ${lockCheck.reason}`);
    await browser.close();
    process.exit(1);
  }

  console.log('[UI_TEST] Touch Area Overlap: PASS');
  console.log('[UI_TEST] Flow controls click path: PASS');
  console.log('[UI_TEST] Shop interactions (refresh/buy/lock): PASS');

  await browser.close();
})();
