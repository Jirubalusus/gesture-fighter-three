export const MOVE_TYPES = {
  HADOKEN: 'hadoken',
  DASH: 'dash',
  UPPERCUT: 'uppercut',
  LOW_GUARD: 'low_guard',
  JAB: 'jab',
  LAUNCHER: 'launcher',
  SWEEP: 'sweep',
  SHIELD: 'shield',
  FLURRY: 'flurry',
  THROW: 'throw',
  CHARGE: 'charge',
  UNKNOWN: 'unknown',
  NONE: 'none',
};

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function pathLength(points) {
  let len = 0;
  for (let i = 1; i < points.length; i++) len += distance(points[i - 1], points[i]);
  return len;
}

export function smoothPoints(points) {
  if (points.length < 4) return points.slice();
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    out.push({
      x: points[i - 1].x * 0.18 + points[i].x * 0.64 + points[i + 1].x * 0.18,
      y: points[i - 1].y * 0.18 + points[i].y * 0.64 + points[i + 1].y * 0.18,
      t: points[i].t,
    });
  }
  out.push(points[points.length - 1]);
  return out;
}

export function resample(points, n = 64) {
  if (points.length === 0) return [];
  const len = pathLength(points);
  if (len <= 0.001) return Array.from({ length: n }, () => ({ ...points[0] }));
  const step = len / (n - 1);
  const out = [{ ...points[0] }];
  let acc = 0;
  let prev = { ...points[0] };
  for (let i = 1; i < points.length; i++) {
    let cur = { ...points[i] };
    let d = distance(prev, cur);
    while (acc + d >= step && d > 0) {
      const ratio = (step - acc) / d;
      const np = {
        x: prev.x + (cur.x - prev.x) * ratio,
        y: prev.y + (cur.y - prev.y) * ratio,
        t: prev.t + (cur.t - prev.t) * ratio,
      };
      out.push(np);
      prev = np;
      d = distance(prev, cur);
      acc = 0;
    }
    acc += d;
    prev = cur;
  }
  while (out.length < n) out.push({ ...points[points.length - 1] });
  return out.slice(0, n);
}

export function bounds(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  const width = Math.max(0.0001, maxX - minX);
  const height = Math.max(0.0001, maxY - minY);
  return { minX, minY, maxX, maxY, width, height, diag: Math.hypot(width, height) };
}

export function normalize(points) {
  if (!points.length) return [];
  const b = bounds(points);
  const scale = Math.max(b.width, b.height);
  return points.map((p) => ({ x: (p.x - b.minX) / scale, y: (p.y - b.minY) / scale, t: p.t }));
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function make3Template(variant = 0) {
  const pts = [];
  const ox = variant * 0.035;
  for (let i = 0; i < 26; i++) {
    const a = -Math.PI * 0.78 + (Math.PI * 1.5 * i) / 25;
    pts.push({ x: 0.48 + Math.cos(a) * (0.31 + ox), y: 0.29 + Math.sin(a) * 0.23, t: i });
  }
  for (let i = 0; i < 30; i++) {
    const a = -Math.PI * 0.66 + (Math.PI * 1.56 * i) / 29;
    pts.push({ x: 0.46 + Math.cos(a) * (0.34 - ox), y: 0.70 + Math.sin(a) * 0.27, t: i + 26 });
  }
  return normalize(resample(pts, 64));
}

const templates3 = [make3Template(-1), make3Template(0), make3Template(1)];

function templateDistance(a, b) {
  const n = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += distance(a[i], b[i]);
  return sum / n;
}

function directionFromVector(dx, dy, strength = Math.hypot(dx, dy)) {
  let label = 'derecha';
  if (Math.abs(dx) > Math.abs(dy)) label = dx >= 0 ? 'derecha' : 'izquierda';
  else label = dy >= 0 ? 'abajo' : 'arriba';
  const mag = Math.hypot(dx, dy) || 1;
  return { x: dx / mag, y: dy / mag, label, strength };
}

function directionFromTail(points, count = 9) {
  const n = points.length;
  if (n < 3) return { x: 1, y: 0, label: 'derecha', strength: 0 };
  const end = points[n - 1];
  const start = points[Math.max(0, n - count)];
  return directionFromVector(end.x - start.x, end.y - start.y, distance(end, start));
}

function angularSweep(points) {
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  let sweep = 0;
  let last = Math.atan2(points[0].y - cy, points[0].x - cx);
  for (let i = 1; i < points.length; i++) {
    const a = Math.atan2(points[i].y - cy, points[i].x - cx);
    let da = a - last;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    sweep += da;
    last = a;
  }
  return Math.abs(sweep);
}

function countReversals(values, minDelta = 0.045) {
  let turns = 0;
  let lastSign = 0;
  for (let i = 2; i < values.length; i++) {
    const diff = values[i] - values[i - 2];
    const sign = Math.abs(diff) < minDelta ? 0 : Math.sign(diff);
    if (sign && lastSign && sign !== lastSign) turns++;
    if (sign) lastSign = sign;
  }
  return turns;
}

function detectCircle(norm) {
  const startEnd = distance(norm[0], norm[norm.length - 1]);
  const sweep = angularSweep(norm);
  const len = pathLength(norm);
  const confidence = clamp01((sweep / (Math.PI * 2)) * 0.72 + (1 - Math.min(startEnd, 0.55) / 0.55) * 0.28);
  return { ok: sweep > Math.PI * 1.45 && startEnd < 0.40 && len > 2.0, confidence, sweep, startEnd };
}

function detectSwipe(raw) {
  const first = raw[0];
  const last = raw[raw.length - 1];
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const dist = Math.hypot(dx, dy);
  const duration = Math.max(1, last.t - first.t);
  const straightness = dist / Math.max(1, pathLength(raw));
  const speed = dist / duration;
  const ok = dist > 62 && straightness > 0.68 && duration < 760;
  const direction = directionFromVector(dx, dy, dist);
  return { ok, confidence: clamp01(straightness * 0.62 + Math.min(speed / 0.75, 1) * 0.38), direction, dist, straightness, speed, duration };
}

function splitFinalFlick(raw) {
  if (raw.length < 16) return { shape: raw, flick: directionFromTail(raw), hasFlick: false };
  let best = null;
  for (let tailCount = 4; tailCount <= Math.min(13, raw.length - 8); tailCount++) {
    const tail = raw.slice(-tailCount);
    const flick = directionFromTail(raw, tailCount);
    const tailLen = pathLength(tail);
    const straightness = flick.strength / Math.max(1, tailLen);
    const candidateShape = raw.slice(0, Math.max(8, raw.length - tailCount + 1));
    const candidateBounds = bounds(candidateShape);
    const strongEnough = flick.strength > Math.max(30, candidateBounds.diag * 0.11);
    const score = (strongEnough ? 0.42 : 0) + straightness * 0.42 + Math.min(flick.strength / 90, 1) * 0.16 - tailCount * 0.008;
    if ((!best || score > best.score) && straightness > 0.58) {
      best = { shape: candidateShape, flick, hasFlick: strongEnough && straightness > 0.62, tailLen, straightness, score };
    }
  }
  if (!best || !best.hasFlick) return { shape: raw, flick: directionFromTail(raw), hasFlick: false };
  return best;
}

function detectThree(raw) {
  const split = splitFinalFlick(raw);
  const sampled = resample(split.shape, 64);
  const norm = normalize(sampled);
  const b = bounds(norm);
  const d = Math.min(...templates3.map((tpl) => templateDistance(norm, tpl)));
  const xs = norm.map((p) => p.x);
  const ys = norm.map((p) => p.y);
  const xTurns = countReversals(xs, 0.035);
  const yTurns = countReversals(ys, 0.025);
  const firstHalf = norm.slice(3, Math.floor(norm.length * 0.50));
  const secondHalf = norm.slice(Math.floor(norm.length * 0.42));
  const middle = norm.slice(Math.floor(norm.length * 0.32), Math.floor(norm.length * 0.68));
  const start = norm[0];
  const end = norm[norm.length - 1];
  const rightCut = b.minX + b.width * 0.62;
  const waistCut = b.minX + b.width * 0.55;
  const midCut = b.minX + b.width * 0.50;
  const topRight = firstHalf.some((p) => p.x > rightCut && p.y < 0.48);
  const bottomRight = secondHalf.some((p) => p.x > rightCut && p.y > 0.48);
  const waist = middle.some((p) => p.x < waistCut && p.y > 0.30 && p.y < 0.72);
  const verticalSpan = Math.max(...ys) - Math.min(...ys);
  const rightBias = norm.filter((p) => p.x > midCut).length / norm.length;
  const structural = verticalSpan > 0.52 && xTurns >= 2 && yTurns >= 1 && topRight && bottomRight && waist && rightBias > 0.34 && start.y < 0.58 && end.y > 0.36;
  const templateScore = clamp01(1 - d / 0.50);
  const structuralScore = (
    (verticalSpan > 0.52 ? 0.18 : 0) +
    (xTurns >= 2 ? 0.18 : 0) +
    (topRight ? 0.14 : 0) +
    (bottomRight ? 0.14 : 0) +
    (waist ? 0.14 : 0) +
    (rightBias > 0.34 ? 0.10 : 0) +
    (split.hasFlick ? 0.12 : 0)
  );
  const confidence = clamp01(Math.max(templateScore * 0.72, structuralScore));
  return { ok: structural && split.hasFlick && confidence > 0.46, confidence, direction: split.flick, distance: d, xTurns, yTurns, structural, topRight, bottomRight, waist, hasFlick: split.hasFlick, flick: split.flick, bounds: b };
}

function detectVOrCheck(norm) {
  const b = bounds(norm);
  const first = norm[0];
  const last = norm[norm.length - 1];
  let maxY = -Infinity;
  let maxIndex = 0;
  for (let i = 0; i < norm.length; i++) {
    if (norm[i].y > maxY) { maxY = norm[i].y; maxIndex = i; }
  }
  const leftArm = norm.slice(0, maxIndex + 1);
  const rightArm = norm.slice(maxIndex);
  const downIntoCorner = leftArm.length > 6 && maxY - first.y > 0.32;
  const risingOut = rightArm.length > 6 && maxY - last.y > 0.30;
  const travelsRight = last.x - first.x > -0.05 && b.width > 0.42;
  const confidence = clamp01((downIntoCorner ? 0.32 : 0) + (risingOut ? 0.32 : 0) + (travelsRight ? 0.18 : 0) + (maxIndex > 8 && maxIndex < norm.length - 8 ? 0.18 : 0));
  return { ok: confidence > 0.68, confidence, maxIndex, downIntoCorner, risingOut, travelsRight };
}

function detectZ(norm) {
  const b = bounds(norm);
  const first = norm[0];
  const last = norm[norm.length - 1];
  const thirds = [norm.slice(0, 21), norm.slice(21, 43), norm.slice(43)];
  const segs = thirds.map((seg) => directionFromVector(seg[seg.length - 1].x - seg[0].x, seg[seg.length - 1].y - seg[0].y));
  const topFlat = Math.abs(segs[0].x) > 0.72 && Math.abs(segs[0].y) < 0.70;
  const diagonal = Math.abs(segs[1].x) > 0.42 && Math.abs(segs[1].y) > 0.42;
  const bottomFlat = Math.abs(segs[2].x) > 0.62 && Math.abs(segs[2].y) < 0.72;
  const topToBottom = first.y < 0.38 && last.y > 0.52 && b.width > 0.58 && b.height > 0.42;
  const confidence = clamp01((topFlat ? 0.22 : 0) + (diagonal ? 0.26 : 0) + (bottomFlat ? 0.22 : 0) + (topToBottom ? 0.30 : 0));
  return { ok: confidence > 0.66 && topFlat && diagonal && bottomFlat && topToBottom, confidence, topFlat, diagonal, bottomFlat, topToBottom };
}

function detectW(norm) {
  const b = bounds(norm);
  const ys = norm.map((p) => p.y);
  const yTurns = countReversals(ys, 0.075);
  const first = norm[0];
  const last = norm[norm.length - 1];
  const confidence = clamp01((yTurns >= 3 ? 0.48 : yTurns * 0.14) + (b.width > 0.50 ? 0.18 : 0) + (b.height > 0.42 ? 0.16 : 0) + (Math.abs(last.x - first.x) > 0.38 ? 0.18 : 0));
  return { ok: confidence > 0.72, confidence, yTurns };
}

function detectL(norm) {
  const b = bounds(norm);
  const first = norm[0];
  const last = norm[norm.length - 1];
  const sampled = resample(norm, 16);
  let best = { score: 0, index: 0 };
  for (let i = 4; i < sampled.length - 4; i++) {
    const a = sampled[0], c = sampled[i], e = sampled[sampled.length - 1];
    const v1 = directionFromVector(c.x - a.x, c.y - a.y);
    const v2 = directionFromVector(e.x - c.x, e.y - c.y);
    const orthogonal = Math.abs(v1.x * v2.x + v1.y * v2.y) < 0.42;
    const axisAligned = (Math.abs(v1.y) > 0.78 && Math.abs(v2.x) > 0.78) || (Math.abs(v1.x) > 0.78 && Math.abs(v2.y) > 0.78);
    const leg1 = distance(a, c);
    const leg2 = distance(c, e);
    const score = (orthogonal ? 0.30 : 0) + (axisAligned ? 0.22 : 0) + clamp01(leg1 / 0.55) * 0.22 + clamp01(leg2 / 0.55) * 0.22 + (b.width > 0.38 && b.height > 0.38 ? 0.04 : 0);
    if (score > best.score) best = { score, index: i };
  }
  const looksLikeL = b.width > 0.38 && b.height > 0.38 && Math.abs(last.x - first.x) > 0.25 && Math.abs(last.y - first.y) > 0.25;
  return { ok: best.score > 0.74 && looksLikeL, confidence: clamp01(best.score), cornerIndex: best.index, looksLikeL };
}

function result(type, label, confidence, direction, debug = {}) {
  return { type, label, confidence: clamp01(confidence), direction, debug };
}

export function recognizeGesture(points) {
  const fallbackDirection = { x: 1, y: 0, label: 'derecha', strength: 0 };
  if (points.length >= 2) {
    const originalBounds = bounds(points);
    const originalDuration = Math.max(1, points[points.length - 1].t - points[0].t);
    const originalTravel = pathLength(points);
    if (originalDuration > 520 && originalBounds.diag < 42 && originalTravel < 100) {
      return result(MOVE_TYPES.CHARGE, 'Carga de energía', Math.min(0.94, originalDuration / 1100), fallbackDirection, {
        points: points.length,
        duration: originalDuration,
        travel: Math.round(originalTravel),
        bounds: originalBounds,
      });
    }
  }
  const raw = smoothPoints(points).filter((p, i, arr) => i === 0 || distance(p, arr[i - 1]) > 2.2);
  if (raw.length < 2) return result(MOVE_TYPES.NONE, 'Sin gesto', 0, fallbackDirection);

  const b = bounds(raw);
  const duration = Math.max(1, raw[raw.length - 1].t - raw[0].t);
  const travel = pathLength(raw);
  const displacement = distance(raw[0], raw[raw.length - 1]);
  const direction = directionFromTail(raw);
  const sampledRaw = resample(raw, 64);
  const norm = normalize(sampledRaw);
  const circle = detectCircle(norm);
  const three = detectThree(raw);
  const swipe = detectSwipe(raw);
  const v = detectVOrCheck(norm);
  const z = detectZ(norm);
  const w = detectW(norm);
  const l = detectL(norm);
  const baseDebug = { points: raw.length, duration, travel: Math.round(travel), bounds: b, three, circle, swipe, v, z, w, l };

  if (duration > 520 && b.diag < 42 && travel < 95) {
    return result(MOVE_TYPES.CHARGE, 'Carga de energía', Math.min(0.94, duration / 1100), direction, baseDebug);
  }
  if (three.ok && three.confidence >= Math.max(circle.confidence * 0.82, 0.46)) {
    return result(MOVE_TYPES.HADOKEN, `Hadoken hacia ${three.direction.label}`, three.confidence, three.direction, baseDebug);
  }
  if (circle.ok && circle.confidence > 0.50) {
    return result(MOVE_TYPES.SHIELD, 'Escudo circular', circle.confidence, direction, baseDebug);
  }
  if (w.ok && travel > 150) {
    return result(MOVE_TYPES.FLURRY, 'Combo relámpago', w.confidence, direction, baseDebug);
  }
  if (z.ok && travel > 120) {
    return result(MOVE_TYPES.SWEEP, 'Barrido pesado', z.confidence, direction, baseDebug);
  }
  if (l.ok && travel > 105) {
    return result(MOVE_TYPES.THROW, 'Agarre y lanzamiento', l.confidence, direction, baseDebug);
  }
  if (v.ok && travel > 95) {
    return result(MOVE_TYPES.LAUNCHER, 'Patada ascendente', v.confidence, direction, baseDebug);
  }
  if (swipe.ok) {
    if (swipe.direction.label === 'arriba') return result(MOVE_TYPES.UPPERCUT, 'Uppercut anti-aéreo', swipe.confidence, swipe.direction, baseDebug);
    if (swipe.direction.label === 'abajo') return result(MOVE_TYPES.LOW_GUARD, 'Guardia baja', swipe.confidence, swipe.direction, baseDebug);
    return result(MOVE_TYPES.DASH, `Dash ${swipe.direction.label}`, swipe.confidence, swipe.direction, baseDebug);
  }
  if ((travel < 100 && duration < 360) || (displacement < 80 && travel < 135)) {
    return result(MOVE_TYPES.JAB, 'Jab rápido', clamp01(0.58 + (1 - Math.min(travel, 120) / 120) * 0.25), direction, baseDebug);
  }

  const confidence = Math.max(three.confidence, circle.confidence, swipe.confidence, v.confidence, z.confidence, w.confidence, l.confidence, 0);
  return result(MOVE_TYPES.UNKNOWN, 'Gesto no claro', confidence, direction, baseDebug);
}
