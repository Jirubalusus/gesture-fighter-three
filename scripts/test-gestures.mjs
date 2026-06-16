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

function makeSwipe(dir = 'right') {
  const pts = [];
  for (let i = 0; i < 20; i++) {
    const k = i / 19;
    const x = dir === 'left' ? 320 - k * 185 : dir === 'right' ? 120 + k * 185 : 220 + Math.sin(k * Math.PI) * 8;
    const y = dir === 'up' ? 330 - k * 190 : dir === 'down' ? 120 + k * 190 : 220 + Math.sin(k * Math.PI) * 6;
    pts.push(p(x, y, i * 10));
  }
  return pts;
}

function makeCircle() {
  const pts = [];
  for (let i = 0; i <= 74; i++) {
    const a = (Math.PI * 2 * i) / 74;
    pts.push(p(220 + Math.cos(a) * 88, 230 + Math.sin(a) * 84, i * 12));
  }
  return pts;
}

function makeThree({ scaleX = 1, scaleY = 1, flick = 'right', loose = 0, startX = 210, startY = 160 } = {}) {
  const pts = [];
  for (let i = 0; i < 30; i++) {
    const a = -Math.PI * (0.78 + loose * 0.04) + (Math.PI * (1.48 + loose * 0.10) * i) / 29;
    pts.push(p(startX + Math.cos(a) * 86 * scaleX, startY + Math.sin(a) * 62 * scaleY, i * 10));
  }
  for (let i = 0; i < 35; i++) {
    const a = -Math.PI * (0.66 - loose * 0.03) + (Math.PI * (1.55 + loose * 0.08) * i) / 34;
    pts.push(p(startX - 4 + Math.cos(a) * 94 * scaleX, startY + 126 * scaleY + Math.sin(a) * 72 * scaleY, 300 + i * 10));
  }
  const last = pts[pts.length - 1];
  const flickMap = {
    right: [72, 0],
    left: [-72, 0],
    up: [14, -72],
    down: [12, 74],
  };
  const [dx, dy] = flickMap[flick];
  pts.push(p(last.x + dx * 0.42, last.y + dy * 0.42, 660), p(last.x + dx, last.y + dy, 710));
  return pts;
}

function makeV() {
  const pts = [];
  for (let i = 0; i < 22; i++) {
    const k = i / 21;
    pts.push(p(140 + k * 78, 130 + k * 170, i * 12));
  }
  for (let i = 1; i < 24; i++) {
    const k = i / 23;
    pts.push(p(218 + k * 112, 300 - k * 165, 260 + i * 12));
  }
  return pts;
}

function makeZ() {
  const pts = [];
  for (let i = 0; i < 18; i++) pts.push(p(130 + i * 11, 140, i * 10));
  for (let i = 1; i < 24; i++) {
    const k = i / 23;
    pts.push(p(318 - k * 190, 140 + k * 150, 180 + i * 10));
  }
  for (let i = 1; i < 20; i++) pts.push(p(128 + i * 11, 290, 430 + i * 10));
  return pts;
}

function makeW() {
  const anchors = [[120, 125], [165, 310], [210, 145], [255, 310], [310, 120]];
  const pts = [];
  let t = 0;
  for (let a = 0; a < anchors.length - 1; a++) {
    const [x1, y1] = anchors[a];
    const [x2, y2] = anchors[a + 1];
    for (let i = 0; i < 15; i++) {
      const k = i / 14;
      pts.push(p(x1 + (x2 - x1) * k, y1 + (y2 - y1) * k, t));
      t += 11;
    }
  }
  return pts;
}

function makeL() {
  const pts = [];
  for (let i = 0; i < 24; i++) {
    const k = i / 23;
    pts.push(p(150, 120 + k * 180, i * 12));
  }
  for (let i = 1; i < 24; i++) {
    const k = i / 23;
    pts.push(p(150 + k * 170, 300, 290 + i * 12));
  }
  return pts;
}

function makeTapSlash() {
  return [p(180, 230, 0), p(205, 228, 35), p(236, 226, 70)];
}

function makeHold() {
  return [p(210, 250, 0), p(212, 251, 240), p(211, 250, 540), p(213, 249, 900)];
}

const cases = [
  [MOVE_TYPES.HADOKEN, makeThree()],
  [MOVE_TYPES.HADOKEN, jitter(makeThree({ scaleX: 0.83, scaleY: 1.08, loose: 0.35 }), 4.4)],
  [MOVE_TYPES.HADOKEN, jitter(makeThree({ scaleX: 1.12, scaleY: 0.92, loose: -0.2, flick: 'up' }), 3.5)],
  [MOVE_TYPES.HADOKEN, jitter(makeThree({ scaleX: 0.95, scaleY: 1.18, flick: 'down', startX: 190 }), 4.8)],
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

for (const [expected, points] of cases) {
  const result = recognizeGesture(points);
  console.log(expected, '=>', result.type, result.label, result.confidence.toFixed(2), result.direction.label);
  assert.equal(result.type, expected);
  assert.ok(result.confidence > 0.35, `low confidence for ${expected}`);
}
console.log('Gesture recognizer tests passed.');
