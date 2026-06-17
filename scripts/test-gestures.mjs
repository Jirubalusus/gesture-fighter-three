import assert from 'node:assert/strict';
import { MOVE_TYPES, recognizeGesture } from '../src/gestureRecognizer.js';

function p(x, y, t) { return { x, y, t }; }

function jitter(points, amount = 3.2) {
  return points.map((pt, i) => p(
    pt.x + Math.sin(i * 12.989) * amount + Math.cos(i * 4.7) * amount * 0.35,
    pt.y + Math.cos(i * 7.233) * amount,
    pt.t,
  ));
}

function makeSwipe(dir = 'right', len = 185) {
  const pts = [];
  for (let i = 0; i < 20; i++) {
    const k = i / 19;
    const x = dir === 'left' ? 320 - k * len : dir === 'right' ? 120 + k * len : 220 + Math.sin(k * Math.PI) * 8;
    const y = dir === 'up' ? 330 - k * len : dir === 'down' ? 120 + k * len : 220 + Math.sin(k * Math.PI) * 6;
    pts.push(p(x, y, i * 10));
  }
  return pts;
}

function makeCircle({ open = 0 } = {}) {
  const pts = [];
  const total = Math.round(74 * (1 - open));
  for (let i = 0; i <= total; i++) {
    const a = (Math.PI * 2 * i) / 74;
    pts.push(p(220 + Math.cos(a) * 88, 230 + Math.sin(a) * 84, i * 12));
  }
  return pts;
}

function makeThree({ scaleX = 1, scaleY = 1, flick = 'right', loose = 0, startX = 210, startY = 160, angular = false, topW = 1, bottomW = 1, compressed = 1 } = {}) {
  const pts = [];
  const topSteps = angular ? 9 : 30;
  const bottomSteps = angular ? 10 : 35;
  for (let i = 0; i < topSteps; i++) {
    const k = i / (topSteps - 1);
    const a = -Math.PI * (0.78 + loose * 0.04) + (Math.PI * (1.48 + loose * 0.10) * k);
    const snap = angular ? (Math.round(k * 4) / 4 - k) * 18 : 0;
    pts.push(p(startX + Math.cos(a) * 86 * scaleX * topW + snap, startY + Math.sin(a) * 62 * scaleY * compressed, i * 10));
  }
  for (let i = 0; i < bottomSteps; i++) {
    const k = i / (bottomSteps - 1);
    const a = -Math.PI * (0.66 - loose * 0.03) + (Math.PI * (1.55 + loose * 0.08) * k);
    const snap = angular ? (Math.round(k * 4) / 4 - k) * -16 : 0;
    pts.push(p(startX - 4 + Math.cos(a) * 94 * scaleX * bottomW + snap, startY + 126 * scaleY + Math.sin(a) * 72 * scaleY * compressed, 300 + i * 10));
  }
  const last = pts[pts.length - 1];
  const flickMap = { right: [72, 0], left: [-72, 0], up: [14, -72], down: [12, 74] };
  const [dx, dy] = flickMap[flick];
  pts.push(p(last.x + dx * 0.42, last.y + dy * 0.42, 660), p(last.x + dx, last.y + dy, 710));
  return pts;
}

function makeV() {
  const pts = [];
  for (let i = 0; i < 22; i++) { const k = i / 21; pts.push(p(140 + k * 78, 130 + k * 170, i * 12)); }
  for (let i = 1; i < 24; i++) { const k = i / 23; pts.push(p(218 + k * 112, 300 - k * 165, 260 + i * 12)); }
  return pts;
}

function makeZ() {
  const pts = [];
  for (let i = 0; i < 18; i++) pts.push(p(130 + i * 11, 140, i * 10));
  for (let i = 1; i < 24; i++) { const k = i / 23; pts.push(p(318 - k * 190, 140 + k * 150, 180 + i * 10)); }
  for (let i = 1; i < 20; i++) pts.push(p(128 + i * 11, 290, 430 + i * 10));
  return pts;
}

function makeW() {
  const anchors = [[120, 125], [165, 310], [210, 145], [255, 310], [310, 120]];
  const pts = [];
  let t = 0;
  for (let a = 0; a < anchors.length - 1; a++) {
    const [x1, y1] = anchors[a]; const [x2, y2] = anchors[a + 1];
    for (let i = 0; i < 15; i++) { const k = i / 14; pts.push(p(x1 + (x2 - x1) * k, y1 + (y2 - y1) * k, t)); t += 11; }
  }
  return pts;
}

function makeL() {
  const pts = [];
  for (let i = 0; i < 24; i++) { const k = i / 23; pts.push(p(150, 120 + k * 180, i * 12)); }
  for (let i = 1; i < 24; i++) { const k = i / 23; pts.push(p(150 + k * 170, 300, 290 + i * 12)); }
  return pts;
}

function makeTapSlash() { return [p(180, 230, 0), p(205, 228, 35), p(236, 226, 70)]; }
function makeTinyLine() { return [p(180, 230, 0), p(192, 230, 35), p(205, 231, 80)]; }
function makeHold() { return [p(210, 250, 0), p(212, 251, 240), p(211, 250, 540), p(213, 249, 900)]; }

const positiveCases = [
  [MOVE_TYPES.HADOKEN, makeThree()],
  [MOVE_TYPES.HADOKEN, jitter(makeThree({ scaleX: 0.83, scaleY: 1.08, loose: 0.35 }), 4.4)],
  [MOVE_TYPES.HADOKEN, jitter(makeThree({ scaleX: 1.12, scaleY: 0.92, loose: -0.2, flick: 'up' }), 3.5)],
  [MOVE_TYPES.HADOKEN, jitter(makeThree({ scaleX: 0.95, scaleY: 1.18, flick: 'down', startX: 190 }), 4.8)],
  [MOVE_TYPES.HADOKEN, jitter(makeThree({ scaleX: 0.72, scaleY: 1.24, topW: 0.85, bottomW: 1.1, loose: 0.45 }), 5.2)],
  [MOVE_TYPES.HADOKEN, jitter(makeThree({ scaleX: 1.28, scaleY: 0.82, topW: 1.15, bottomW: 0.9, loose: -0.35 }), 4.0)],
  [MOVE_TYPES.HADOKEN, jitter(makeThree({ angular: true, scaleX: 1.05, scaleY: 1.05, flick: 'left' }), 3.2)],
  [MOVE_TYPES.HADOKEN, jitter(makeThree({ compressed: 0.78, scaleX: 0.9, scaleY: 1.1, loose: 0.15 }), 4.6)],
  [MOVE_TYPES.SHIELD, jitter(makeCircle(), 2.5)],
  [MOVE_TYPES.DASH, jitter(makeSwipe('right'), 2.0)],
  [MOVE_TYPES.DASH, jitter(makeSwipe('left'), 2.0)],
  [MOVE_TYPES.UPPERCUT, jitter(makeSwipe('up'), 1.8)],
  [MOVE_TYPES.LOW_GUARD, jitter(makeSwipe('down'), 1.8)],
  [MOVE_TYPES.JAB, makeTapSlash()],
  [MOVE_TYPES.LAUNCHER, jitter(makeV(), 2.8)],
  [MOVE_TYPES.SWEEP, jitter(makeZ(), 2.4)],
  [MOVE_TYPES.FLURRY, jitter(makeW(), 2.4)],
  [MOVE_TYPES.THROW, jitter(makeL(), 2.0)],
  [MOVE_TYPES.CHARGE, makeHold()],
];

for (const [expected, points] of positiveCases) {
  const result = recognizeGesture(points);
  console.log(expected, '=>', result.type, result.label, result.confidence.toFixed(2), result.direction.label);
  assert.equal(result.type, expected);
  assert.ok(result.confidence > 0.35, `low confidence for ${expected}`);
}

const notThreeCases = [
  ['circle', jitter(makeCircle(), 2.5)],
  ['open-circle', jitter(makeCircle({ open: 0.20 }), 2.5)],
  ['z', jitter(makeZ(), 2.0)],
  ['v', jitter(makeV(), 2.0)],
  ['w', jitter(makeW(), 2.0)],
  ['l', jitter(makeL(), 2.0)],
  ['swipe-right', jitter(makeSwipe('right'), 1.5)],
  ['tiny-line', makeTinyLine()],
];
for (const [name, points] of notThreeCases) {
  const result = recognizeGesture(points);
  console.log('not-three', name, '=>', result.type, result.label, result.confidence.toFixed(2));
  assert.notEqual(result.type, MOVE_TYPES.HADOKEN, `${name} false-positive as 3/Hadoken`);
}
console.log('Gesture recognizer tests passed: flexible 3 variants + negative ambiguity cases.');
