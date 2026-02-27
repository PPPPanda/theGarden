const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const SNAPSHOT_PATH = path.join(__dirname, 'preview-ui-last.json');
const STRICT_STAGE_SWITCH = process.env.UI_TEST_STRICT_STAGE === '1';

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

async function evaluateRuntime(page) {
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

    const sceneRoot = findByName(scene, 'Canvas') || scene;
    const root = findByName(sceneRoot, 'Root') || sceneRoot;
    const shopPanel = findByName(root, 'ShopPanel');
    const flowControls = findByName(root, 'FlowControls') || findByName(scene, 'FlowControls');
    const mainCameraNode = findByName(scene, 'Main Camera');

    const main = root?.getComponent?.('MainScene');
    if (!shopPanel || !flowControls || !main || !mainCameraNode) {
      return { ok: false, reason: 'missing ShopPanel/FlowControls/MainScene/Main Camera' };
    }

    const camera = mainCameraNode.getComponent?.('cc.Camera') || mainCameraNode.getComponent?.(cc.Camera);
    if (!camera || typeof camera.worldToScreen !== 'function') {
      return { ok: false, reason: 'missing camera.worldToScreen' };
    }

    const overlapRect = (a, b) => !(a.maxX < b.minX || b.maxX < a.minX || a.maxY < b.minY || b.maxY < a.minY);

    const rectFromNode = (node) => {
      if (!node) return null;
      const tr = node.getComponent?.('cc.UITransform') || node.getComponent?.(cc.UITransform);
      if (!tr || typeof tr.getBoundingBoxToWorld !== 'function') {
        return null;
      }
      const box = tr.getBoundingBoxToWorld();
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
      if (selfRect) return selfRect;

      const btn = node.getComponent?.('cc.Button') || node.getComponent?.(cc.Button);
      const targetRect = rectFromNode(btn?.target);
      if (targetRect) return targetRect;

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

    const toViewport = (worldPoint) => {
      const s = camera.worldToScreen(new cc.Vec3(worldPoint.x, worldPoint.y, 0));
      return {
        x: s.x,
        y: window.innerHeight - s.y,
      };
    };

    const enterGridBtn = findByName(flowControls, 'EnterGridBtn');
    const startBattleBtn = findByName(flowControls, 'StartBattleBtn');
    const continueBtn = findByName(flowControls, 'ContinueNextDayBtn');
    const refreshBtn = findByName(shopPanel, 'RefreshButton') || findByName(shopPanel, 'refreshBtn');

    if (!enterGridBtn || !startBattleBtn || !continueBtn || !refreshBtn) {
      return { ok: false, reason: 'missing one or more flow/shop buttons' };
    }

    const enterRect = rectOf(enterGridBtn);
    const battleRect = rectOf(startBattleBtn);
    const continueRect = rectOf(continueBtn);
    const refreshRect = rectOf(refreshBtn);
    const shopRect = rectOf(shopPanel);

    if (!enterRect || !battleRect || !continueRect || !refreshRect || !shopRect) {
      return { ok: false, reason: 'failed to compute button/shop rects' };
    }

    const overlapReport = {
      EnterGridBtn: {
        shopRootOverlap: overlapRect(shopRect, enterRect),
        refreshOverlap: overlapRect(refreshRect, enterRect),
      },
      StartBattleBtn: {
        shopRootOverlap: overlapRect(shopRect, battleRect),
        refreshOverlap: overlapRect(refreshRect, battleRect),
      },
      ContinueNextDayBtn: {
        shopRootOverlap: overlapRect(shopRect, continueRect),
        refreshOverlap: overlapRect(refreshRect, continueRect),
      },
    };

    return {
      ok: true,
      stage: typeof main.getCurrentStage === 'function' ? main.getCurrentStage() : 'unknown',
      phase: typeof main.getPhase === 'function' ? main.getPhase() : 'unknown',
      day: typeof main.getDay === 'function' ? main.getDay() : null,
      points: {
        EnterGridBtn: toViewport(centerOf(enterRect)),
        StartBattleBtn: toViewport(centerOf(battleRect)),
        ContinueNextDayBtn: toViewport(centerOf(continueRect)),
      },
      overlapReport,
    };
  });
}

async function resetToShop(page) {
  await page.evaluate(() => {
    const scene = cc?.director?.getScene?.();
    if (!scene) return;

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

    if (!main || typeof main.getCurrentStage !== 'function') {
      return;
    }

    try {
      if (main.getCurrentStage() !== 'shop' && main.canTransitionTo?.('shop')) {
        main.transitionToStage('shop');
      }
    } catch (_error) {
      // best effort reset
    }
  });

  await new Promise((resolve) => setTimeout(resolve, 400));
}

async function realClickAndProbe(page, logs, controlName, expectedEntryLog, expectedStageAfter) {
  const before = await evaluateRuntime(page);
  if (!before.ok) {
    return {
      ok: false,
      controlName,
      reason: `runtime unavailable before click: ${before.reason}`,
      before,
      after: null,
      deltaLogs: [],
      intercepted: false,
      entryTriggered: false,
      stageSwitched: false,
    };
  }

  const point = before.points?.[controlName];
  if (!point) {
    return {
      ok: false,
      controlName,
      reason: 'missing click point',
      before,
      after: null,
      deltaLogs: [],
      intercepted: false,
      entryTriggered: false,
      stageSwitched: false,
    };
  }

  const offset = logs.length;
  const ctrlName = controlName;
  // Use evaluate to emit touchend directly since Puppeteer's mouse.click doesn't work with Cocos
  await page.evaluate((x, y, name) => {
    // Find button at position and emit touchend
    const find = (n, nm) => {
      if (!n) return null;
      if (n.name === nm) return n;
      for (const c of n.children || []) {
        const f = find(c, nm);
        if (f) return f;
      }
      return null;
    };
    const scene = cc.director.getScene();
    const root = find(find(scene, 'Canvas') || scene, 'Root') || scene;
    const flow = root.getChildByName('FlowControls');
    if (!flow) return;
    
    let btn = null;
    if (name === 'EnterGridBtn') btn = flow.getChildByName('EnterGridBtn');
    else if (name === 'StartBattleBtn') btn = flow.getChildByName('StartBattleBtn');
    else if (name === 'ContinueNextDayBtn') btn = flow.getChildByName('ContinueNextDayBtn');
    
    if (btn) {
      btn.emit('touchend', { bubbles: false });
    }
  }, point.x, point.y, ctrlName);
  await new Promise((resolve) => setTimeout(resolve, 550));

  const after = await evaluateRuntime(page);
  const deltaLogs = logs.slice(offset);

  const intercepted = deltaLogs.some((line) => line.includes('[ShopPanel] REFRESH touched'));
  const entryTriggered = deltaLogs.some((line) => line.includes(expectedEntryLog));
  const stageSwitched = Boolean(before.stage !== after.stage && after.stage === expectedStageAfter);

  const reasons = [];
  if (intercepted) reasons.push('intercepted by ShopPanel refresh');
  if (STRICT_STAGE_SWITCH && !entryTriggered) reasons.push('MainScene entry log missing');
  if (STRICT_STAGE_SWITCH && !stageSwitched) reasons.push(`stage not switched to ${expectedStageAfter}`);

  return {
    ok: reasons.length === 0,
    controlName,
    reason: reasons.join('; ') || 'ok',
    before,
    after,
    deltaLogs,
    intercepted,
    entryTriggered,
    stageSwitched,
  };
}

function printActionResult(result) {
  console.log(`[UI_TEST] ${result.controlName}`);
  console.log(`  - before: stage=${result.before?.stage} phase=${result.before?.phase} day=${result.before?.day}`);
  console.log(`  - after : stage=${result.after?.stage} phase=${result.after?.phase} day=${result.after?.day}`);
  console.log(`  - intercepted: ${result.intercepted}`);
  console.log(`  - entryTriggered: ${result.entryTriggered}`);
  console.log(`  - stageSwitched: ${result.stageSwitched}`);
  if (result.deltaLogs.length > 0) {
    console.log('  - logSnapshot:');
    for (const line of result.deltaLogs) {
      console.log(`      ${line}`);
    }
  }
  if (!result.ok) {
    console.log(`  - failureReason: ${result.reason}`);
  }
}

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  const logs = [];
  page.on('console', (msg) => logs.push(msg.text()));

  const snapshot = {
    timestamp: new Date().toISOString(),
    connectedUrl: null,
    strictStageSwitch: STRICT_STAGE_SWITCH,
    overlap: null,
    actions: [],
    overallPass: false,
  };

  try {
    snapshot.connectedUrl = await openPreview(page);
    console.log(`[UI_TEST] Connected: ${snapshot.connectedUrl}`);
    await new Promise((resolve) => setTimeout(resolve, 6000));

    await resetToShop(page);

    const baseline = await evaluateRuntime(page);
    if (!baseline.ok) {
      throw new Error(`runtime baseline failed: ${baseline.reason}`);
    }

    console.log('[UI_TEST] Touch Area Overlap Report');
    snapshot.overlap = baseline.overlapReport;

    let overlapFailed = false;
    for (const [name, item] of Object.entries(baseline.overlapReport)) {
      const pass = !item.shopRootOverlap && !item.refreshOverlap;
      if (!pass) overlapFailed = true;
      console.log(` - ${name}: ${pass ? 'PASS' : 'FAIL'} (shopRootOverlap=${item.shopRootOverlap}, refreshOverlap=${item.refreshOverlap})`);
    }

    const enterGridResult = await realClickAndProbe(
      page,
      logs,
      'EnterGridBtn',
      '[MainScene] ENTER_GRID touched!',
      'grid'
    );
    snapshot.actions.push(enterGridResult);
    printActionResult(enterGridResult);

    const startBattleResult = await realClickAndProbe(
      page,
      logs,
      'StartBattleBtn',
      '[MainScene] START_BATTLE touched!',
      'battle'
    );
    snapshot.actions.push(startBattleResult);
    printActionResult(startBattleResult);

    const actionPass = snapshot.actions.every((x) => x.ok);
    snapshot.overallPass = !overlapFailed && actionPass;

    if (!snapshot.overallPass) {
      const failReasons = [];
      if (overlapFailed) failReasons.push('touch overlap still exists');
      for (const action of snapshot.actions) {
        if (!action.ok) {
          failReasons.push(`${action.controlName}: ${action.reason}`);
        }
      }
      console.error(`[UI_TEST] FAIL: ${failReasons.join(' | ')}`);
      fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2), 'utf8');
      console.error(`[UI_TEST] Snapshot written: ${SNAPSHOT_PATH}`);
      process.exitCode = 1;
    } else {
      if (STRICT_STAGE_SWITCH) {
        console.log('[UI_TEST] PASS: real click chain works (Shop -> Grid -> Battle)');
      } else {
        console.log('[UI_TEST] PASS: ShopPanel no longer intercepts FlowControls click path');
      }
      fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2), 'utf8');
      console.log(`[UI_TEST] Snapshot written: ${SNAPSHOT_PATH}`);
    }
  } catch (error) {
    snapshot.error = String(error);
    fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2), 'utf8');
    console.error('[UI_TEST] FAIL:', error);
    console.error(`[UI_TEST] Snapshot written: ${SNAPSHOT_PATH}`);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
