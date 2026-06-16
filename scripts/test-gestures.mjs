import assert from 'node:assert/strict';
import { recognizeGesture } from '../src/gestureRecognizer.js';

function p(x, y, t) { return { x, y, t }; }
function makeSwipe(dir = 'right') {
  const pts = [];
  for (let i = 0; i < 18; i++) {
    const k = i / 17;
    const x = dir === 'left' ? 320 - k * 180 : 120 + k * 180;
    const y = dir === 'up' ? 320 - k * 180 : dir === 'down' ? 120 + k * 180 : 220;
    pts.push(p(x, y, i * 9));
  }
  return pts;
}
function makeCircle() {
  const pts = [];
  for (let i = 0; i <= 72; i++) {
    const a = (Math.PI * 2 * i) / 72;
    pts.push(p(220 + Math.cos(a) * 90, 220 + Math.sin(a) * 90, i * 12));
  }
  return pts;
}
function makeThree() {
  const pts = [];
  for (let i = 0; i < 30; i++) {
    const a = -Math.PI * .78 + (Math.PI * 1.5 * i) / 29;
    pts.push(p(210 + Math.cos(a) * 85, 160 + Math.sin(a) * 62, i * 10));
  }
  for (let i = 0; i < 34; i++) {
    const a = -Math.PI * .66 + (Math.PI * 1.55 * i) / 33;
    pts.push(p(205 + Math.cos(a) * 92, 285 + Math.sin(a) * 72, 300 + i * 10));
  }
  // final directional flick to the right
  pts.push(p(330, 292, 650), p(390, 292, 690));
  return pts;
}

const cases = [
  ['hadoken', makeThree()],
  ['shield', makeCircle()],
  ['swipe', makeSwipe('right')],
  ['swipe', makeSwipe('up')],
];

for (const [expected, points] of cases) {
  const result = recognizeGesture(points);
  console.log(expected, '=>', result.type, result.label, result.confidence.toFixed(2));
  assert.equal(result.type, expected);
  assert.ok(result.confidence > 0.35, `low confidence for ${expected}`);
}
console.log('Gesture recognizer tests passed.');
