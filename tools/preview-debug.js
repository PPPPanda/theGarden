const puppeteer = require('puppeteer');
const { delay, findHealthyPreviewUrl, installPreviewBootstrap, waitForPreviewRuntime } = require('./preview-common');

async function stabilizeMainScene(page) {
    await page.evaluate(() => {
        const ccRuntime = globalThis.cc;
        const scene = ccRuntime?.director?.getScene?.();
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

        const canvas = findByName(scene, 'Canvas');
        const root = findByName(canvas || scene, 'Root') || canvas || scene;
        const shopNode = findByName(root, 'ShopPanel');
        const mainComp = root?.getComponent?.('MainScene');
        const shopComp = shopNode?.getComponent?.('ShopPanel');

        if (mainComp && !mainComp.isInitialized && typeof mainComp.start === 'function') {
            mainComp.start();
        }

        if (shopComp && !shopComp.getShopManager?.() && mainComp?.gameLoop && typeof shopComp.init === 'function') {
            shopComp.init(mainComp.gameLoop);
        }

        if (mainComp?.getCurrentStage?.() === 'loading' && typeof mainComp.transitionToStage === 'function') {
            mainComp.transitionToStage('shop');
        }
    });
}

(async () => {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
    });

    try {
        const selected = await findHealthyPreviewUrl(browser, {
            navigationTimeoutMs: 15000,
            runtimeTimeoutMs: 8000,
        });

        const page = await browser.newPage();
        await installPreviewBootstrap(page);
        await page.setViewport({ width: 1280, height: 720 });

        page.on('console', (msg) => {
            const type = msg.type().toUpperCase();
            if (type === 'ERROR' || type === 'WARN' || msg.text().startsWith('[DEBUG]')) {
                console.log(`[${type}] ${msg.text()}`);
            }
        });

        console.log(`[preview-debug] Connected: ${selected.url}`);
        await page.goto(selected.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await waitForPreviewRuntime(page, 8000);
        await delay(1500);
        await stabilizeMainScene(page);
        await delay(1500);

        const diagnostics = await page.evaluate(() => {
            try {
                const ccRuntime = globalThis.cc;
                if (!ccRuntime?.director?.getScene) {
                    return {
                        ok: false,
                        reason: 'globalThis.cc unavailable',
                    };
                }

                const scene = ccRuntime.director.getScene();
                if (!scene) {
                    return {
                        ok: false,
                        reason: 'scene not loaded',
                    };
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

                const canvas = findByName(scene, 'Canvas');
                const root = findByName(canvas || scene, 'Root') || canvas || scene;
                const shopNode = findByName(root, 'ShopPanel');
                const mainComp = root?.getComponent?.('MainScene');
                const shopComp = shopNode?.getComponent?.('ShopPanel');

                return {
                    ok: true,
                    scene: scene.name || 'unknown',
                    canvas: Boolean(canvas),
                    root: root?.name || null,
                    shopPanel: Boolean(shopNode),
                    mainScene: Boolean(mainComp),
                    shopManager: Boolean(shopComp?.getShopManager?.() || shopComp?.shopManager),
                    gameLoop: Boolean(mainComp?.gameLoop),
                    isInitialized: Boolean(mainComp?.isInitialized),
                    currentStage: typeof mainComp?.getCurrentStage === 'function' ? mainComp.getCurrentStage() : null,
                    phase: typeof mainComp?.getPhase === 'function' ? mainComp.getPhase() : null,
                    day: typeof mainComp?.getDay === 'function' ? mainComp.getDay() : null,
                    slotBindings: Array.isArray(shopComp?.slotBindings) ? shopComp.slotBindings.length : null,
                };
            } catch (error) {
                return {
                    ok: false,
                    reason: error instanceof Error ? error.message : String(error),
                };
            }
        });

        console.log('\n=== RUNTIME DIAGNOSTICS ===');
        console.log(JSON.stringify(diagnostics, null, 2));

        if (!diagnostics.ok) {
            process.exitCode = 1;
        }
    } finally {
        await browser.close();
    }
})();
