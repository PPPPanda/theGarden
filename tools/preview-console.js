#!/usr/bin/env node
/**
 * preview-console.js — Capture Cocos Creator Preview browser console logs
 * 
 * Usage:
 *   node tools/preview-console.js [url] [--wait <ms>] [--follow]
 * 
 * Defaults:
 *   url:   http://192.168.10.100:7456
 *   wait:  5000ms (time to wait after page load before exiting)
 *   follow: keep running and stream logs until Ctrl+C
 * 
 * Output format:
 *   [TYPE] message
 *   Where TYPE = LOG | WARN | ERROR | INFO | DEBUG | PAGE_ERROR | REQUEST_FAIL
 */

const puppeteer = require('puppeteer');

// Parse args
const args = process.argv.slice(2);
let url = 'http://192.168.10.100:7456';
let waitMs = 5000;
let follow = false;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--wait' && args[i + 1]) {
        waitMs = parseInt(args[i + 1], 10);
        i++;
    } else if (args[i] === '--follow' || args[i] === '-f') {
        follow = true;
    } else if (!args[i].startsWith('-')) {
        url = args[i];
    }
}

const TYPE_MAP = {
    log: 'LOG',
    warning: 'WARN',
    error: 'ERROR',
    info: 'INFO',
    debug: 'DEBUG',
    trace: 'TRACE',
    dir: 'DIR',
    assert: 'ASSERT',
};

const logs = [];

function formatLog(type, text) {
    const line = `[${type}] ${text}`;
    logs.push(line);
    // Always print immediately for real-time visibility
    process.stdout.write(line + '\n');
}

(async () => {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                // Enable WebGL in headless mode (required for Cocos Creator)
                '--enable-webgl',
                '--use-gl=swiftshader',           // Software WebGL renderer
                '--enable-unsafe-swiftshader',     // Allow SwiftShader in headless
                '--ignore-gpu-blocklist',
            ],
        });

        const page = await browser.newPage();

        // Capture console messages
        page.on('console', (msg) => {
            const type = TYPE_MAP[msg.type()] || msg.type().toUpperCase();
            const text = msg.text();
            formatLog(type, text);
        });

        // Capture uncaught page errors
        page.on('pageerror', (err) => {
            formatLog('PAGE_ERROR', err.message || String(err));
        });

        // Capture failed network requests
        page.on('requestfailed', (req) => {
            formatLog('REQUEST_FAIL', `${req.method()} ${req.url()} — ${req.failure()?.errorText || 'unknown'}`);
        });

        console.error(`[preview-console] Opening ${url} ...`);
        
        await page.goto(url, { 
            waitUntil: 'domcontentloaded',
            timeout: 15000 
        });

        console.error(`[preview-console] Page loaded. Capturing console output...`);

        // Take screenshot after initial load
        await new Promise(r => setTimeout(r, 3000));
        const screenshotPath = process.env.SCREENSHOT_PATH || '/mnt/e/clawdbot_bridge/clawdbot_workspace/preview-screenshot.png';
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.error(`[preview-console] Screenshot saved: ${screenshotPath}`);

        if (follow) {
            console.error(`[preview-console] Follow mode — press Ctrl+C to stop.`);
            // Keep running forever
            await new Promise(() => {});
        } else {
            // Wait for game to initialize and log
            await new Promise(r => setTimeout(r, waitMs));
            
            console.error(`[preview-console] Done. Captured ${logs.length} log entries.`);
        }

    } catch (err) {
        console.error(`[preview-console] Fatal: ${err.message}`);
        process.exit(1);
    } finally {
        if (browser) {
            await browser.close().catch(() => {});
        }
    }
})();
