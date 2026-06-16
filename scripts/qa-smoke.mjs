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

function wPath(cx, cy, scale = 1) {
  const anchors = [
    [cx - 95 * scale, cy - 70 * scale],
    [cx - 48 * scale, cy + 72 * scale],
    [cx, cy - 58 * scale],
    [cx + 48 * scale, cy + 72 * scale],
    [cx + 104 * scale, cy - 70 * scale],
  ];
  const pts = [];
  for (let a = 0; a < anchors.length - 1; a++) {
    const [x1, y1] = anchors[a];
    const [x2, y2] = anchors[a + 1];
    for (let i = 0; i < 14; i++) {
      const k = i / 13;
      pts.push([x1 + (x2 - x1) * k, y1 + (y2 - y1) * k]);
    }
  }
  return pts;
}

async function drawPath(page, pts) {
  await page.mouse.move(pts[0][0], pts[0][1]);
  await page.mouse.down();
  for (const [x, y] of pts.slice(1)) await page.mouse.move(x, y, { steps: 1 });
  await page.mouse.up();
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
  await drawPath(page, pts);
  await page.waitForTimeout(450);
  const comboPts = wPath(viewport.width * .50, viewport.height * .50, viewport.width < 600 ? .62 : .88);
  await drawPath(page, comboPts);
  await page.waitForTimeout(350);
  const state = await page.evaluate(() => ({
    label: document.querySelector('#gestureName')?.textContent,
    meta: document.querySelector('#gestureMeta')?.textContent,
    lastType: window.__lastGesture?.type,
    comboText: document.querySelector('#comboLog')?.textContent,
    enemyHp: document.querySelector('#enemyHp')?.style.width,
    energy: document.querySelector('#playerEnergy')?.style.width,
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
if (reports.some((r) => (
  r.errors.length ||
  !/(Hadoken|Combo relámpago)/i.test(r.state.label || '') ||
  !/hadoken|flurry/i.test(r.state.lastType || '') ||
  !/Hadoken|Combo flurry|Combo relámpago/i.test(r.state.comboText || '') ||
  !r.state.hasCanvas ||
  r.state.overflowX
))) process.exit(1);
