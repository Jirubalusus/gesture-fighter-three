import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = process.argv[2] || 'http://127.0.0.1:5181';
const outDir = path.resolve('artifacts/qa');
fs.mkdirSync(outDir, { recursive: true });

function threePath(cx, cy, scale = 1) {
  const pts = [];
  for (let i = 0; i < 26; i++) {
    const a = -Math.PI * .78 + (Math.PI * 1.5 * i) / 25;
    pts.push([cx + Math.cos(a) * 78 * scale, cy - 70 * scale + Math.sin(a) * 56 * scale]);
  }
  for (let i = 0; i < 30; i++) {
    const a = -Math.PI * .66 + (Math.PI * 1.55 * i) / 29;
    pts.push([cx + Math.cos(a) * 86 * scale, cy + 46 * scale + Math.sin(a) * 66 * scale]);
  }
  pts.push([cx + 145 * scale, cy + 50 * scale], [cx + 210 * scale, cy + 50 * scale]);
  return pts;
}

async function drawPath(page, pts) {
  await page.mouse.move(pts[0][0], pts[0][1]);
  await page.mouse.down();
  for (const [x, y] of pts.slice(1)) await page.mouse.move(x, y, { steps: 1 });
  await page.mouse.up();
}

async function tap(page, x, y) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(45);
  await page.mouse.up();
}

async function hold(page, x, y, ms = 430) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

async function run(label, viewport) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('#game');
  await page.screenshot({ path: path.join(outDir, `${label}-initial.png`), fullPage: false });

  const cy = viewport.height * 0.56;
  await tap(page, viewport.width * 0.76, cy);
  await page.waitForTimeout(240);
  const afterMove = await page.evaluate(() => ({ live: document.querySelector('#liveRead')?.textContent, x: window.__gestureFighterDebug?.state.playerVelocity, intent: window.__gestureFighterDebug?.state.moveIntent }));

  await tap(page, Math.max(14, viewport.width * 0.04), cy);
  await page.waitForTimeout(140);
  const afterStop = await page.evaluate(() => ({ live: document.querySelector('#liveRead')?.textContent, x: window.__gestureFighterDebug?.state.playerVelocity, intent: window.__gestureFighterDebug?.state.moveIntent }));

  await drawPath(page, [[viewport.width * 0.46, cy], [viewport.width * 0.46 + Math.min(70, viewport.width * 0.16), cy - 10]]);
  await page.waitForTimeout(180);
  const afterDash = await page.evaluate(() => ({ live: document.querySelector('#liveRead')?.textContent, name: document.querySelector('#gestureName')?.textContent }));

  await hold(page, viewport.width * 0.50, cy, 450);
  await page.waitForTimeout(110);
  const afterHold = await page.evaluate(() => ({ live: document.querySelector('#liveRead')?.textContent, name: document.querySelector('#gestureName')?.textContent, blockUntil: window.__gestureFighterDebug?.state.blockUntil }));

  const pts = threePath(viewport.width * .36, viewport.height * .48, viewport.width < 600 ? .62 : .86);
  await drawPath(page, pts);
  await page.waitForTimeout(500);
  const afterCombo = await page.evaluate(() => ({
    label: document.querySelector('#gestureName')?.textContent,
    meta: document.querySelector('#gestureMeta')?.textContent,
    lastType: window.__lastGesture?.type,
    comboText: document.querySelector('#comboLog')?.textContent,
    enemyHp: document.querySelector('#enemyHp')?.style.width,
    energy: document.querySelector('#playerEnergy')?.style.width,
    hasCanvas: !!document.querySelector('canvas#game'),
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  }));
  await page.screenshot({ path: path.join(outDir, `${label}-after-combo3.png`), fullPage: false });
  await browser.close();
  return { label, viewport, errors, afterMove, afterStop, afterDash, afterHold, afterCombo };
}

const reports = [
  await run('desktop-1365x768', { width: 1365, height: 768 }),
  await run('mobile-390x844', { width: 390, height: 844 }),
];
console.log(JSON.stringify({ outDir, reports }, null, 2));
if (reports.some((r) => (
  r.errors.length ||
  r.afterMove.intent !== 1 ||
  r.afterStop.intent !== 0 ||
  !/dash-short/i.test(r.afterDash.live || '') ||
  !/Bloqueo/i.test(r.afterHold.name || '') ||
  !/Combo 3|Hadoken/i.test(r.afterCombo.label || '') ||
  r.afterCombo.lastType !== 'hadoken' ||
  !/Hadoken/i.test(r.afterCombo.comboText || '') ||
  !r.afterCombo.hasCanvas ||
  r.afterCombo.overflowX
))) process.exit(1);
