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

async function run(label, viewport) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base, { waitUntil: 'networkidle', timeout: 60000 });
  await page.screenshot({ path: path.join(outDir, `${label}-initial.png`), fullPage: false });
  const pts = threePath(viewport.width * .38, viewport.height * .48, viewport.width < 600 ? .72 : 1);
  await page.mouse.move(pts[0][0], pts[0][1]);
  await page.mouse.down();
  for (const [x, y] of pts.slice(1)) await page.mouse.move(x, y, { steps: 1 });
  await page.mouse.up();
  await page.waitForTimeout(450);
  const state = await page.evaluate(() => ({
    label: document.querySelector('#gestureName')?.textContent,
    meta: document.querySelector('#gestureMeta')?.textContent,
    enemyHp: document.querySelector('#enemyHp')?.style.width,
    hasCanvas: !!document.querySelector('canvas#game'),
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  }));
  await page.screenshot({ path: path.join(outDir, `${label}-after-hadoken.png`), fullPage: false });
  await browser.close();
  return { label, viewport, errors, state };
}

const reports = [
  await run('desktop-1365x768', { width: 1365, height: 768 }),
  await run('mobile-390x844', { width: 390, height: 844 }),
];
console.log(JSON.stringify({ outDir, reports }, null, 2));
if (reports.some((r) => r.errors.length || !/Hadoken/i.test(r.state.label || '') || !r.state.hasCanvas || r.state.overflowX)) process.exit(1);
