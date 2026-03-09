const fs = require('fs');
const path = require('path');

const DEFAULT_CANDIDATE_URLS = [
  process.env.PREVIEW_URL,
  ...(process.env.PREVIEW_URLS ? process.env.PREVIEW_URLS.split(',') : []),
  'http://127.0.0.1:7456',
  'http://localhost:7456',
  'http://192.168.10.100:7456',
];

const REPO_ROOT = path.resolve(__dirname, '..');
const PREVIEW_SYSTEMJS_TARGET = path.join(REPO_ROOT, 'temp', 'programming', 'preview', 'systemjs', 'system.js');
const DEFAULT_SCENE_NAMES = normalizeCandidateUrls([
  process.env.PREVIEW_SCENE,
  'main',
  'Main',
  'scenes/main',
  'assets/scenes/main',
]);
const DEFAULT_LAUNCH_SCENE = process.env.PREVIEW_LAUNCH_SCENE || 'db://assets/scenes/main.scene';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeCandidateUrls(urls = []) {
  const seen = new Set();
  const result = [];

  for (const rawUrl of urls) {
    const url = String(rawUrl ?? '').trim();
    if (!url || seen.has(url)) {
      continue;
    }
    seen.add(url);
    result.push(url);
  }

  return result;
}

function getCandidateUrls(preferredUrl) {
  return normalizeCandidateUrls([
    preferredUrl,
    ...DEFAULT_CANDIDATE_URLS,
  ]);
}

function getPreviewSystemJsSourceCandidates() {
  return normalizeCandidateUrls([
    process.env.PREVIEW_SYSTEMJS_SOURCE,
    path.join(REPO_ROOT, 'node_modules', 'systemjs', 'dist', 'system.js'),
    path.join(REPO_ROOT, 'node_modules', 'systemjs', 'dist', 's.js'),
  ]);
}

async function installPreviewBootstrap(page) {
  await page.evaluateOnNewDocument((launchScene) => {
    let currentSettings;
    Object.defineProperty(window, '_CCSettings', {
      configurable: true,
      enumerable: true,
      get() {
        return currentSettings;
      },
      set(nextValue) {
        if (nextValue && typeof nextValue === 'object') {
          if (!nextValue.launch || typeof nextValue.launch !== 'object') {
            nextValue.launch = {};
          }
          if (!nextValue.launch.launchScene) {
            nextValue.launch.launchScene = launchScene;
          }
        }
        currentSettings = nextValue;
      },
    });
  }, DEFAULT_LAUNCH_SCENE);
}

function ensurePreviewSystemJs() {
  if (fs.existsSync(PREVIEW_SYSTEMJS_TARGET)) {
    return {
      ok: true,
      created: false,
      target: PREVIEW_SYSTEMJS_TARGET,
    };
  }

  const source = getPreviewSystemJsSourceCandidates().find((candidate) => fs.existsSync(candidate));
  if (!source) {
    return {
      ok: false,
      reason: 'no systemjs source candidate found',
      target: PREVIEW_SYSTEMJS_TARGET,
      candidates: getPreviewSystemJsSourceCandidates(),
    };
  }

  fs.mkdirSync(path.dirname(PREVIEW_SYSTEMJS_TARGET), { recursive: true });
  fs.copyFileSync(source, PREVIEW_SYSTEMJS_TARGET);

  return {
    ok: true,
    created: true,
    source,
    target: PREVIEW_SYSTEMJS_TARGET,
  };
}

async function ensurePreviewSceneLoaded(page) {
  return page.evaluate(async (sceneNames) => {
    const ccRuntime = globalThis.cc;
    if (!ccRuntime?.director?.loadScene) {
      return { ok: false, reason: 'globalThis.cc unavailable' };
    }

    const existing = ccRuntime.director.getScene?.();
    if (existing) {
      return {
        ok: true,
        sceneName: existing.name || 'unknown',
        loaded: false,
      };
    }

    for (const sceneName of sceneNames) {
      try {
        const result = await new Promise((resolve) => {
          ccRuntime.director.loadScene(sceneName, (error, scene) => {
            resolve({
              sceneName,
              error: error ? String(error.message || error) : null,
              loadedScene: scene?.name || null,
            });
          });
        });

        if (!result.error) {
          const scene = ccRuntime.director.getScene?.();
          return {
            ok: true,
            sceneName: scene?.name || result.loadedScene || sceneName,
            loaded: true,
            requestedScene: sceneName,
          };
        }
      } catch (error) {
        // Try next candidate.
      }
    }

    return {
      ok: false,
      reason: `failed to load fallback scenes: ${sceneNames.join(', ')}`,
    };
  }, DEFAULT_SCENE_NAMES);
}

async function waitForPreviewRuntime(page, timeoutMs = 8000) {
  const startedAt = Date.now();
  const fallbackDelayMs = Math.min(3000, Math.max(1000, Math.floor(timeoutMs / 2)));
  let attemptedSceneFallback = false;
  let lastReason = 'cc runtime unavailable';

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const state = await page.evaluate(() => {
        const ccRuntime = globalThis.cc;
        if (!ccRuntime?.director?.getScene) {
          return { ok: false, reason: 'globalThis.cc unavailable' };
        }

        const scene = ccRuntime.director.getScene();
        if (!scene) {
          return { ok: false, reason: 'scene not loaded' };
        }

        return {
          ok: true,
          sceneName: scene.name || 'unknown',
          loaded: false,
        };
      });

      if (state?.ok) {
        return state;
      }

      if (state?.reason === 'scene not loaded') {
        lastReason = state.reason;
        const elapsedMs = Date.now() - startedAt;
        if (!attemptedSceneFallback && elapsedMs >= fallbackDelayMs) {
          attemptedSceneFallback = true;
          const sceneState = await ensurePreviewSceneLoaded(page);
          if (sceneState?.ok) {
            return sceneState;
          }
          lastReason = sceneState?.reason || state.reason;
        }
      } else {
        lastReason = state?.reason || lastReason;
      }
    } catch (error) {
      lastReason = error instanceof Error ? error.message : String(error);
    }

    await delay(250);
  }

  return {
    ok: false,
    reason: lastReason,
  };
}

async function probePreviewUrl(browser, url, options = {}) {
  const {
    navigationTimeoutMs = 15000,
    runtimeTimeoutMs = 8000,
  } = options;

  const page = await browser.newPage();
  await installPreviewBootstrap(page);
  const responseErrors = [];
  const requestFailures = [];
  const pageErrors = [];

  const onResponse = (response) => {
    if (response.status() >= 400) {
      responseErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  };
  const onRequestFailed = (request) => {
    requestFailures.push(`${request.method()} ${request.url()} — ${request.failure()?.errorText || 'unknown'}`);
  };
  const onPageError = (error) => {
    pageErrors.push(error?.message || String(error));
  };

  page.on('response', onResponse);
  page.on('requestfailed', onRequestFailed);
  page.on('pageerror', onPageError);

  try {
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: navigationTimeoutMs,
    });

    if (!response) {
      return {
        ok: false,
        url,
        reason: 'no main document response',
        diagnostics: { responseErrors, requestFailures, pageErrors },
      };
    }

    if (response.status() >= 400) {
      return {
        ok: false,
        url,
        reason: `main document returned HTTP ${response.status()}`,
        diagnostics: { responseErrors, requestFailures, pageErrors },
      };
    }

    const runtime = await waitForPreviewRuntime(page, runtimeTimeoutMs);
    const brokenSystemJs = responseErrors.find((entry) => entry.includes('/scripting/systemjs/system.js'));

    if (brokenSystemJs) {
      return {
        ok: false,
        url,
        reason: `system.js fetch failed (${brokenSystemJs})`,
        diagnostics: { responseErrors, requestFailures, pageErrors },
      };
    }

    if (!runtime.ok) {
      return {
        ok: false,
        url,
        reason: runtime.reason,
        diagnostics: { responseErrors, requestFailures, pageErrors },
      };
    }

    return {
      ok: true,
      url,
      runtime,
      diagnostics: { responseErrors, requestFailures, pageErrors },
    };
  } catch (error) {
    return {
      ok: false,
      url,
      reason: error instanceof Error ? error.message : String(error),
      diagnostics: { responseErrors, requestFailures, pageErrors },
    };
  } finally {
    page.off('response', onResponse);
    page.off('requestfailed', onRequestFailed);
    page.off('pageerror', onPageError);
    await page.close().catch(() => {});
  }
}

async function findHealthyPreviewUrl(browser, options = {}) {
  const {
    preferredUrl,
    navigationTimeoutMs = 15000,
    runtimeTimeoutMs = 8000,
  } = options;

  const systemJsResult = ensurePreviewSystemJs();
  const candidateUrls = getCandidateUrls(preferredUrl);
  const failures = [];

  if (!systemJsResult.ok) {
    failures.push({
      url: 'local-preview-scaffold',
      reason: systemJsResult.reason,
      diagnostics: {
        target: systemJsResult.target,
        candidates: systemJsResult.candidates,
      },
    });
  }

  for (const url of candidateUrls) {
    const probe = await probePreviewUrl(browser, url, {
      navigationTimeoutMs,
      runtimeTimeoutMs,
    });

    if (probe.ok) {
      return {
        url: probe.url,
        runtime: probe.runtime,
        failures,
      };
    }

    failures.push({
      url: probe.url,
      reason: probe.reason,
      diagnostics: probe.diagnostics,
    });
  }

  const summary = failures.map((item) => `${item.url} => ${item.reason}`).join(' | ');
  const error = new Error(`No healthy preview URL available: ${summary || 'no candidates'}`);
  error.failures = failures;
  throw error;
}

module.exports = {
  delay,
  ensurePreviewSystemJs,
  findHealthyPreviewUrl,
  getCandidateUrls,
  installPreviewBootstrap,
  normalizeCandidateUrls,
  waitForPreviewRuntime,
  PREVIEW_SYSTEMJS_TARGET,
};
