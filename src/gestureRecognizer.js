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
      x: points[i - 1].x * 0.22 + points[i].x * 0.56 + points[i + 1].x * 0.22,
      y: points[i - 1].y * 0.22 + points[i].y * 0.56 + points[i + 1].y * 0.22,
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

export function normalize(points) {
  if (!points.length) return [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  const scale = Math.max(w, h);
  return points.map((p) => ({ x: (p.x - minX) / scale, y: (p.y - minY) / scale, t: p.t }));
}

function make3Template(variant = 0) {
  const pts = [];
  const ox = variant * 0.03;
  for (let i = 0; i < 24; i++) {
    const a = -Math.PI * 0.75 + (Math.PI * 1.45 * i) / 23;
    pts.push({ x: 0.45 + Math.cos(a) * (0.31 + ox), y: 0.30 + Math.sin(a) * 0.24, t: i });
  }
  for (let i = 0; i < 28; i++) {
    const a = -Math.PI * 0.65 + (Math.PI * 1.52 * i) / 27;
    pts.push({ x: 0.43 + Math.cos(a) * (0.34 - ox), y: 0.70 + Math.sin(a) * 0.27, t: i + 24 });
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

function directionFromTail(points) {
  const n = points.length;
  if (n < 3) return { x: 1, y: 0, label: 'derecha', strength: 0 };
  const end = points[n - 1];
  const start = points[Math.max(0, n - 9)];
  let vx = end.x - start.x;
  let vy = end.y - start.y;
  const mag = Math.hypot(vx, vy) || 1;
  vx /= mag; vy /= mag;
  let label = 'derecha';
  if (Math.abs(vx) > Math.abs(vy)) label = vx >= 0 ? 'derecha' : 'izquierda';
  else label = vy >= 0 ? 'abajo' : 'arriba';
  return { x: vx, y: vy, label, strength: mag };
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

function detectCircle(norm, raw) {
  const startEnd = distance(norm[0], norm[norm.length - 1]);
  const sweep = angularSweep(norm);
  const len = pathLength(norm);
  const confidence = Math.max(0, Math.min(1, (sweep / (Math.PI * 2)) * 0.72 + (1 - Math.min(startEnd, 0.55) / 0.55) * 0.28));
  return { ok: sweep > Math.PI * 1.45 && startEnd < 0.38 && len > 2.0, confidence, sweep, startEnd };
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
  const ok = dist > 70 && straightness > 0.72;
  const dir = directionFromTail(raw);
  return { ok, confidence: Math.min(1, straightness * 0.65 + Math.min(speed / 0.9, 1) * 0.35), dir, dist, straightness, speed };
}

function detectThree(norm) {
  // Separate the drawn digit from the final directional flick. The flick is part of
  // the command but can distort the exact end position of the digit.
  const shape = norm.length > 18 ? norm.slice(0, -8) : norm;
  const d = Math.min(...templates3.map((tpl) => templateDistance(norm, tpl)));
  const ys = shape.map((p) => p.y);
  const xs = shape.map((p) => p.x);
  const start = shape[0];
  const shapeEnd = shape[shape.length - 1];
  let turns = 0;
  let lastSign = 0;
  for (let i = 2; i < xs.length; i++) {
    const diff = xs[i] - xs[i - 2];
    const sign = Math.abs(diff) < 0.012 ? 0 : Math.sign(diff);
    if (sign && lastSign && sign !== lastSign) turns++;
    if (sign) lastSign = sign;
  }
  const topRight = shape.slice(4, Math.floor(shape.length * 0.48)).some((p) => p.x > 0.52 && p.y < 0.48);
  const bottomRight = shape.slice(Math.floor(shape.length * 0.48)).some((p) => p.x > 0.52 && p.y > 0.48);
  const hasWaist = shape.some((p) => p.x < 0.42 && p.y > 0.34 && p.y < 0.66);
  const verticalSpan = Math.max(...ys) - Math.min(...ys);
  const confidence = Math.max(0, Math.min(1, 1 - d / 0.42));
  const structural = start.y < 0.46 && shapeEnd.y > 0.42 && verticalSpan > 0.50 && turns >= 2 && topRight && bottomRight && hasWaist;
  // The template score is intentionally permissive: real finger-drawn 3s vary a lot.
  // Structural checks carry more weight than exact point-by-point distance.
  const blendedConfidence = Math.max(confidence, structural ? 0.62 - Math.min(d, 0.42) * 0.50 : confidence);
  return { ok: blendedConfidence > 0.34 && structural, confidence: blendedConfidence, distance: d, turns, structural, topRight, bottomRight, hasWaist };
}

export function recognizeGesture(points) {
  const raw = smoothPoints(points).filter((p, i, arr) => i === 0 || distance(p, arr[i - 1]) > 2.5);
  if (raw.length < 4) return { type: 'none', label: 'Sin gesto', confidence: 0, direction: { x: 1, y: 0, label: 'derecha', strength: 0 } };
  const sampledRaw = resample(raw, 64);
  const norm = normalize(sampledRaw);
  const dir = directionFromTail(raw);
  const circle = detectCircle(norm, raw);
  const three = detectThree(norm);
  const swipe = detectSwipe(raw);

  if (three.ok && three.confidence >= circle.confidence * 0.92) {
    return { type: 'hadoken', label: `Hadoken hacia ${dir.label}`, confidence: three.confidence, direction: dir, debug: { three, circle, swipe, points: raw.length } };
  }
  if (circle.ok && circle.confidence > 0.48) {
    return { type: 'shield', label: 'Escudo circular', confidence: circle.confidence, direction: dir, debug: { three, circle, swipe, points: raw.length } };
  }
  if (swipe.ok) {
    return { type: 'swipe', label: `Swipe ${swipe.dir.label}`, confidence: swipe.confidence, direction: swipe.dir, debug: { three, circle, swipe, points: raw.length } };
  }
  return { type: 'unknown', label: 'Gesto no claro', confidence: Math.max(three.confidence, circle.confidence, swipe.confidence || 0), direction: dir, debug: { three, circle, swipe, points: raw.length } };
}
