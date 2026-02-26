const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    page.on('console', msg => {
        const type = msg.type().toUpperCase();
        if (type === 'ERROR' || type === 'WARN' || msg.text().startsWith('[DEBUG]')) {
            console.log(`[${type}] ${msg.text()}`);
        }
    });

    await page.goto('http://192.168.10.100:7456', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 6000));

    // Inject diagnostic script
    const diagnostics = await page.evaluate(() => {
        try {
            const scene = cc.director.getScene();
            if (!scene) return 'No scene loaded';
            
            const canvas = scene.getChildByName('Canvas');
            if (!canvas) return 'No Canvas';
            
            const root = canvas.getChildByName('Root');
            if (!root) return 'No Root node';
            
            const result = [];
            
            // Check HUD
            const hudNode = root.getChildByName('HUD');
            result.push(`HUD: active=${hudNode?.active}, children=${hudNode?.children?.length}`);
            if (hudNode) {
                const topBar = hudNode.getChildByName('TopBar');
                result.push(`  TopBar: pos=${JSON.stringify(topBar?.position)}`);
                const goldText = topBar?.getChildByName('GoldText');
                const goldLabel = goldText?.getComponent('cc.Label');
                result.push(`  GoldText: string="${goldLabel?.string}"`);
                const dayText = topBar?.getChildByName('DayText');
                const dayLabel = dayText?.getComponent('cc.Label');
                result.push(`  DayText: string="${dayLabel?.string}"`);
                
                const hpBar = hudNode.getChildByName('HpBar');
                result.push(`  HpBar: pos=${JSON.stringify(hpBar?.position)}`);
                const hpText = hpBar?.getChildByName('HpText');
                const hpLabel = hpText?.getComponent('cc.Label');
                result.push(`  HpText: string="${hpLabel?.string}"`);
            }
            
            // Check ShopPanel
            const shopNode = root.getChildByName('ShopPanel');
            result.push(`ShopPanel: active=${shopNode?.active}`);
            
            // Check if ShopPanel component has shopManager
            const shopComp = shopNode?.getComponent('ShopPanel');
            result.push(`  ShopPanel component found: ${!!shopComp}`);
            if (shopComp) {
                result.push(`  shopManager: ${!!shopComp.shopManager}`);
                result.push(`  slotBindings length: ${shopComp.slotBindings?.length}`);
                result.push(`  slotCount: ${shopComp.slotCount}`);
            }
            
            // Check slot data
            const slotList = shopNode?.getChildByName('SlotList');
            if (slotList) {
                for (let i = 0; i < Math.min(slotList.children.length, 3); i++) {
                    const slot = slotList.children[i];
                    const icon = slot.getChildByName('Icon');
                    const iconLabel = icon?.getChildByName('_iconLabel')?.getComponent('cc.Label');
                    const price = slot.getChildByName('Price');
                    const priceLabel = price?.getComponent('cc.Label');
                    result.push(`  ${slot.name}: iconLabel="${iconLabel?.string}" price="${priceLabel?.string}"`);
                }
            }
            
            // Check MainScene component
            const mainComp = root.getComponent('MainScene');
            result.push(`MainScene component: ${!!mainComp}`);
            if (mainComp) {
                result.push(`  isInitialized: ${mainComp.isInitialized}`);
                result.push(`  currentStage: ${mainComp.getCurrentStage?.()}`);
            }
            
            return result.join('\n');
        } catch (e) {
            return `Error: ${e.message}\n${e.stack}`;
        }
    });
    
    console.log('\n=== RUNTIME DIAGNOSTICS ===');
    console.log(diagnostics);
    
    await browser.close();
})();
