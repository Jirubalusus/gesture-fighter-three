import * as THREE from 'three';
import './styles.css';
import { MOVE_TYPES, recognizeGesture } from './gestureRecognizer.js';

const canvas = document.querySelector('#game');
const trailCanvas = document.querySelector('#gestureTrail');
const trailCtx = trailCanvas.getContext('2d');
const hpPlayerEl = document.querySelector('#playerHp');
const hpEnemyEl = document.querySelector('#enemyHp');
const energyPlayerEl = document.querySelector('#playerEnergy');
const gestureName = document.querySelector('#gestureName');
const gestureMeta = document.querySelector('#gestureMeta');
const debugText = document.querySelector('#debugText');
const toast = document.querySelector('#toast');
const resetBtn = document.querySelector('#resetBtn');
const moveGuide = document.querySelector('#moveGuide');
const comboLog = document.querySelector('#comboLog');
const liveRead = document.querySelector('#liveRead');
const roundState = document.querySelector('#roundState');

const MOVE_INFO = {
  [MOVE_TYPES.HADOKEN]: { name: 'Hadoken', cost: 24, cooldown: 520, damage: 15 },
  [MOVE_TYPES.DASH]: { name: 'Dash / esquiva', cost: 8, cooldown: 220, damage: 0 },
  [MOVE_TYPES.UPPERCUT]: { name: 'Uppercut', cost: 18, cooldown: 420, damage: 10 },
  [MOVE_TYPES.LOW_GUARD]: { name: 'Guardia baja', cost: 0, cooldown: 260, damage: 0 },
  [MOVE_TYPES.JAB]: { name: 'Jab', cost: 4, cooldown: 170, damage: 5 },
  [MOVE_TYPES.LAUNCHER]: { name: 'Patada ascendente', cost: 18, cooldown: 520, damage: 12 },
  [MOVE_TYPES.SWEEP]: { name: 'Barrido pesado', cost: 16, cooldown: 540, damage: 11 },
  [MOVE_TYPES.SHIELD]: { name: 'Escudo', cost: 20, cooldown: 780, damage: 0 },
  [MOVE_TYPES.FLURRY]: { name: 'Combo flurry', cost: 30, cooldown: 850, damage: 18 },
  [MOVE_TYPES.THROW]: { name: 'Agarre', cost: 14, cooldown: 620, damage: 14 },
  [MOVE_TYPES.CHARGE]: { name: 'Carga', cost: 0, cooldown: 650, damage: 0 },
};

const GUIDE = [
  ['tap', 'Mover / parar', 'M 16 44 L 74 44'],
  ['hold', 'Bloquear', 'M 44 44 m -20 0 a 20 20 0 1 0 40 0 a 20 20 0 1 0 -40 0'],
  ['línea', 'Dash corto', 'M 18 48 L 58 42'],
  ['3→', 'Combo 3 Hadoken', 'M 16 14 C 52 2 56 38 24 38 C 60 38 62 78 18 70 L 76 70'],
  ['V', 'Combo Launcher', 'M 16 16 L 42 72 L 74 18'],
  ['Z', 'Combo Barrido', 'M 14 18 L 74 18 L 18 72 L 76 72'],
  ['O', 'Escudo', 'M 44 14 C 82 14 82 76 44 76 C 6 76 6 14 44 14'],
  ['W', 'Flurry', 'M 10 16 L 26 72 L 42 20 L 58 72 L 76 16'],
  ['L', 'Combo Agarre', 'M 22 14 L 22 72 L 72 72'],
];

const state = {
  playerHp: 100,
  enemyHp: 100,
  energy: 76,
  playerBaseX: -2.8,
  enemyBaseX: 2.75,
  projectiles: [],
  impacts: [],
  floaters: [],
  points: [],
  drawing: false,
  lastActionAt: 0,
  gameOver: false,
  shieldUntil: 0,
  lowGuardUntil: 0,
  chargeUntil: 0,
  blockUntil: 0,
  holdTimer: null,
  holdStarted: false,
  playerVelocity: 0,
  moveIntent: 0,
  enemyCooldown: 1.0,
  enemyStun: 0,
  enemyVy: 0,
  cooldowns: new Map(),
  combo: [],
};

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x061018);
scene.fog = new THREE.Fog(0x061018, 8, 18);
const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 100);

const hemi = new THREE.HemisphereLight(0x9bf7d5, 0x060811, 1.45);
scene.add(hemi);
const keyLight = new THREE.DirectionalLight(0xffffff, 2.15);
keyLight.position.set(-3, 7, 5);
keyLight.castShadow = true;
scene.add(keyLight);
const rim = new THREE.PointLight(0x23f8c2, 2.0, 11);
rim.position.set(0, 2.5, -2.6);
scene.add(rim);

function mat(color, emissive = 0x000000, intensity = 0.08) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.42,
    metalness: 0.08,
    emissive,
    emissiveIntensity: intensity,
  });
}

const floor = new THREE.Mesh(new THREE.BoxGeometry(10, 0.14, 4.2), mat(0x102134, 0x061018, 0.2));
floor.position.y = -0.08;
floor.receiveShadow = true;
scene.add(floor);
const grid = new THREE.GridHelper(10, 18, 0x29f1a1, 0x1b5264);
grid.position.y = 0.01;
scene.add(grid);
for (let i = -5; i <= 5; i++) {
  const line = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 4.4), mat(0x1ce59b, 0x1ce59b, 0.55));
  line.position.set(i, 0.04, 0);
  line.material.transparent = true;
  line.material.opacity = i === 0 ? 0.42 : 0.13;
  scene.add(line);
}

function makeFighter(color, accent, side = 1) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1.08, 8, 18), mat(color, accent, 0.18));
  body.position.y = 1.05;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 16), mat(0xf2cfa8, accent, 0.05));
  head.position.y = 1.92;
  head.castShadow = true;
  group.add(head);
  const armGeo = new THREE.CapsuleGeometry(0.095, 0.72, 6, 10);
  const leftArm = new THREE.Mesh(armGeo, mat(color, accent, 0.12));
  leftArm.position.set(-0.42 * side, 1.24, 0.04);
  leftArm.rotation.z = 0.7 * side;
  leftArm.castShadow = true;
  group.add(leftArm);
  const rightArm = leftArm.clone();
  rightArm.position.x = 0.42 * side;
  rightArm.rotation.z = -0.95 * side;
  group.add(rightArm);
  const legGeo = new THREE.CapsuleGeometry(0.11, 0.78, 6, 10);
  const leftLeg = new THREE.Mesh(legGeo, mat(0x111827, accent, 0.08));
  leftLeg.position.set(-0.18, 0.42, 0);
  leftLeg.castShadow = true;
  group.add(leftLeg);
  const rightLeg = leftLeg.clone();
  rightLeg.position.x = 0.18;
  group.add(rightLeg);
  const aura = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.025, 8, 72), mat(accent, accent, 1));
  aura.position.y = 0.72;
  aura.rotation.x = Math.PI / 2;
  aura.material.transparent = true;
  aura.material.opacity = 0;
  group.add(aura);
  group.userData = { body, head, leftArm, rightArm, leftLeg, rightLeg, aura, punch: 0, kick: 0, flash: 0, side };
  return group;
}

const player = makeFighter(0x246bff, 0x22f3ff, 1);
const enemy = makeFighter(0xff365f, 0xffb020, -1);
player.position.x = state.playerBaseX;
enemy.position.x = state.enemyBaseX;
scene.add(player, enemy);

function renderGuide() {
  moveGuide.innerHTML = GUIDE.map(([glyph, name, path]) => `
    <div class="moveChip">
      <svg viewBox="0 0 88 88" aria-hidden="true">
        <path d="${path}" pathLength="100"></path>
      </svg>
      <span>${glyph}</span>
      <b>${name}</b>
    </div>
  `).join('');
}
renderGuide();

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function signedDir(direction) {
  if (direction.label === 'izquierda') return -1;
  if (direction.label === 'derecha') return 1;
  return enemy.position.x >= player.position.x ? 1 : -1;
}

function fighterDistance() {
  return Math.abs(enemy.position.x - player.position.x);
}

function addImpact(x, y, color = 0x41f6ff, size = 0.34) {
  state.impacts.push({ x, y, life: 0.45, color, size });
}

function addFloatingText(text, x, y, color = '#d9fff3') {
  state.floaters.push({ text, x, y, life: 0.85, color });
}

function showToast(text) {
  toast.textContent = text;
  toast.classList.remove('hidden');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add('hidden'), 820);
}

function logCombo(text) {
  state.combo.unshift(text);
  state.combo = state.combo.slice(0, 5);
  comboLog.innerHTML = state.combo.map((item) => `<li>${item}</li>`).join('');
}

function resetGame() {
  state.playerHp = 100;
  state.enemyHp = 100;
  state.energy = 76;
  state.gameOver = false;
  state.shieldUntil = 0;
  state.lowGuardUntil = 0;
  state.chargeUntil = 0;
  state.blockUntil = 0;
  state.holdStarted = false;
  state.playerVelocity = 0;
  state.moveIntent = 0;
  state.enemyCooldown = 1.0;
  state.enemyStun = 0;
  state.enemyVy = 0;
  state.cooldowns.clear();
  state.combo = [];
  comboLog.innerHTML = '';
  for (const p of state.projectiles) scene.remove(p.mesh);
  for (const im of state.impacts) if (im.mesh) scene.remove(im.mesh);
  for (const fl of state.floaters) if (fl.el) fl.el.remove();
  state.projectiles = [];
  state.impacts = [];
  state.floaters = [];
  player.position.set(state.playerBaseX, 0, 0);
  enemy.position.set(state.enemyBaseX, 0, 0);
  gestureName.textContent = 'Dibuja un gesto';
  gestureMeta.textContent = 'Tap lateral mueve · tap contrario para · línea corta dash · mantener bloquea · dibuja combos';
  roundState.textContent = 'Combos por gestos · movimiento por taps';
  showToast('Combate reiniciado');
}
resetBtn.addEventListener('click', resetGame);

function makeProjectile(x, y, direction, owner = 'player', power = 1) {
  const color = owner === 'player' ? 0x41f6ff : 0xff9f1c;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.17 + power * 0.035, 24, 16), mat(color, color, 1.8));
  mesh.position.set(x, y, 0);
  mesh.castShadow = true;
  scene.add(mesh);
  const light = new THREE.PointLight(color, 2.4, 3.8);
  mesh.add(light);
  const xSign = Math.abs(direction.x) > 0.22 ? Math.sign(direction.x) : owner === 'player' ? 1 : -1;
  const yDir = clamp(-direction.y, -0.75, 0.75);
  const speed = owner === 'player' ? 5.6 + power * 0.8 : 3.7;
  state.projectiles.push({
    mesh,
    dir: { x: xSign, y: yDir * 0.44 },
    owner,
    speed,
    power,
    life: 2.45,
    damage: owner === 'player' ? Math.round(13 * power) : 8,
  });
}

function animateStrike(group, kind = 'punch', amount = 0.22) {
  group.userData.punch = kind === 'punch' ? 0.24 : 0.08;
  group.userData.kick = kind === 'kick' ? 0.30 : 0;
  group.userData.punchAmount = amount;
  group.userData.flash = 0.20;
}

function damageEnemy(amount, source = 'golpe') {
  if (state.gameOver) return;
  state.enemyHp = Math.max(0, state.enemyHp - amount);
  state.enemyStun = Math.max(state.enemyStun, 0.22);
  addImpact(enemy.position.x, 1.25, 0x41f6ff, 0.34 + amount * 0.01);
  addFloatingText(`-${amount}`, enemy.position.x, 1.95, '#97fff5');
  logCombo(`${source} · ${amount}`);
  if (state.enemyHp <= 0) {
    state.gameOver = true;
    roundState.textContent = 'Victoria';
    showToast('¡VICTORIA! Reset para otra ronda');
  }
}

function damagePlayer(amount, source = 'rival') {
  if (state.gameOver) return;
  const now = performance.now();
  let finalAmount = amount;
  if (now < state.shieldUntil || now < state.blockUntil) finalAmount = Math.ceil(amount * 0.18);
  else if (now < state.lowGuardUntil) finalAmount = Math.ceil(amount * 0.45);
  state.playerHp = Math.max(0, state.playerHp - finalAmount);
  addImpact(player.position.x, 1.25, 0xff9f1c, 0.34 + finalAmount * 0.012);
  addFloatingText(`-${finalAmount}`, player.position.x, 1.95, '#ffd18a');
  if (finalAmount < amount) showToast('Bloqueo');
  if (state.playerHp <= 0) {
    state.gameOver = true;
    roundState.textContent = 'Derrota';
    showToast('DERROTA · Reset para reintentar');
  } else if (source) {
    roundState.textContent = `Rival: ${source}`;
  }
}

function hasMoveReady(type, now) {
  return now >= (state.cooldowns.get(type) || 0);
}

function setMoveCooldown(type, now) {
  state.cooldowns.set(type, now + (MOVE_INFO[type]?.cooldown || 250));
}

function spendEnergy(type) {
  const cost = MOVE_INFO[type]?.cost || 0;
  if (state.energy < cost) {
    showToast('Sin energía');
    return false;
  }
  state.energy -= cost;
  return true;
}

function applyGesture(result) {
  const now = performance.now();
  window.__lastGesture = result;
  if (state.gameOver) return;
  if (result.type === MOVE_TYPES.UNKNOWN || result.type === MOVE_TYPES.NONE) {
    showToast('Gesto no claro');
    return;
  }
  if (!hasMoveReady(result.type, now)) {
    showToast('Recuperando');
    return;
  }
  if (!spendEnergy(result.type)) return;
  setMoveCooldown(result.type, now);
  state.lastActionAt = now;

  const dir = signedDir(result.direction);
  const dist = fighterDistance();
  const charged = now < state.chargeUntil ? 1.35 : 1;
  const name = MOVE_INFO[result.type]?.name || result.label;
  roundState.textContent = name;
  logCombo(`${name} · ${Math.round(result.confidence * 100)}%`);

  if (result.type === MOVE_TYPES.HADOKEN) {
    makeProjectile(player.position.x + dir * 0.62, 1.24, result.direction, 'player', charged);
    animateStrike(player, 'punch', 0.24 * dir);
    state.chargeUntil = 0;
    showToast(`HADOKEN ${result.direction.label}`);
    return;
  }
  if (result.type === MOVE_TYPES.DASH) {
    player.position.x = clamp(player.position.x + dir * 0.86, -4.25, 2.15);
    animateStrike(player, 'punch', 0.08 * dir);
    showToast(`DASH ${result.direction.label}`);
    return;
  }
  if (result.type === MOVE_TYPES.UPPERCUT) {
    animateStrike(player, 'punch', 0.38 * (enemy.position.x > player.position.x ? 1 : -1));
    player.position.y = 0.12;
    if (dist < 1.65) {
      enemy.position.y = 0.28;
      state.enemyVy = 2.2;
      damageEnemy(Math.round(MOVE_INFO[result.type].damage * charged), 'Uppercut');
    } else addImpact(player.position.x + 0.55, 1.7, 0x41f6ff, 0.28);
    return;
  }
  if (result.type === MOVE_TYPES.LOW_GUARD) {
    state.lowGuardUntil = now + 1300;
    player.scale.y = 0.86;
    showToast('GUARDIA BAJA');
    return;
  }
  if (result.type === MOVE_TYPES.JAB) {
    animateStrike(player, 'punch', 0.30 * (enemy.position.x > player.position.x ? 1 : -1));
    if (dist < 1.22) damageEnemy(MOVE_INFO[result.type].damage, 'Jab');
    else addImpact(player.position.x + 0.52, 1.25, 0x41f6ff, 0.23);
    return;
  }
  if (result.type === MOVE_TYPES.LAUNCHER) {
    animateStrike(player, 'kick', 0.34);
    if (dist < 1.70) {
      enemy.position.y = 0.42;
      state.enemyVy = 2.8;
      damageEnemy(Math.round(MOVE_INFO[result.type].damage * charged), 'Launcher');
    } else addImpact(player.position.x + 0.70, 1.55, 0x41f6ff, 0.30);
    return;
  }
  if (result.type === MOVE_TYPES.SWEEP) {
    animateStrike(player, 'kick', -0.22);
    if (dist < 1.78) {
      enemy.rotation.z = 0.16 * (enemy.position.x > player.position.x ? -1 : 1);
      state.enemyStun = 0.60;
      damageEnemy(MOVE_INFO[result.type].damage, 'Barrido');
    } else addImpact(player.position.x + 0.75, 0.48, 0x41f6ff, 0.36);
    return;
  }
  if (result.type === MOVE_TYPES.SHIELD) {
    state.shieldUntil = now + 1750;
    showToast('ESCUDO');
    return;
  }
  if (result.type === MOVE_TYPES.FLURRY) {
    animateStrike(player, 'punch', 0.42);
    if (dist < 1.82) {
      damageEnemy(6, 'Flurry 1');
      setTimeout(() => damageEnemy(6, 'Flurry 2'), 120);
      setTimeout(() => damageEnemy(6, 'Flurry 3'), 230);
    } else addImpact(player.position.x + 0.65, 1.25, 0x41f6ff, 0.44);
    return;
  }
  if (result.type === MOVE_TYPES.THROW) {
    animateStrike(player, 'punch', 0.20);
    if (dist < 1.20) {
      enemy.position.x = clamp(enemy.position.x + (enemy.position.x > player.position.x ? 0.75 : -0.75), -0.5, 4.3);
      enemy.position.y = 0.18;
      damageEnemy(MOVE_INFO[result.type].damage, 'Agarre');
    } else showToast('Muy lejos');
    return;
  }
  if (result.type === MOVE_TYPES.CHARGE) {
    state.energy = clamp(state.energy + 28, 0, 100);
    state.chargeUntil = now + 4200;
    addImpact(player.position.x, 1.0, 0x41f6ff, 0.50);
    showToast('CARGA LISTA');
  }
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const portrait = h > w;
  camera.position.set(0, portrait ? 4.75 : 4.25, portrait ? 10.6 : 9.1);
  camera.lookAt(0, 1.05, 0);
  camera.fov = portrait ? 47 : 42;
  camera.updateProjectionMatrix();
  trailCanvas.width = Math.floor(w * window.devicePixelRatio);
  trailCanvas.height = Math.floor(h * window.devicePixelRatio);
  trailCanvas.style.width = `${w}px`;
  trailCanvas.style.height = `${h}px`;
  trailCtx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
}
window.addEventListener('resize', resize);
resize();

function drawTrail() {
  trailCtx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
  if (!state.points.length) return;
  trailCtx.lineCap = 'round';
  trailCtx.lineJoin = 'round';
  trailCtx.shadowColor = '#31f6ff';
  trailCtx.shadowBlur = 18;
  trailCtx.strokeStyle = 'rgba(54, 246, 255, .94)';
  trailCtx.lineWidth = 8;
  trailCtx.beginPath();
  state.points.forEach((p, i) => { if (i === 0) trailCtx.moveTo(p.x, p.y); else trailCtx.lineTo(p.x, p.y); });
  trailCtx.stroke();
  const last = state.points[state.points.length - 1];
  trailCtx.shadowBlur = 0;
  trailCtx.fillStyle = '#ffffff';
  trailCtx.beginPath();
  trailCtx.arc(last.x, last.y, 7, 0, Math.PI * 2);
  trailCtx.fill();
}

function pointerPoint(e) {
  return { x: e.clientX, y: e.clientY, t: performance.now() };
}

function inputStats(points) {
  if (!points.length) return { travel: 0, displacement: 0, duration: 0, direction: { x: 1, y: 0, label: 'derecha', strength: 0 } };
  let travel = 0;
  for (let i = 1; i < points.length; i++) travel += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  const first = points[0];
  const lastPoint = points[points.length - 1];
  const dx = lastPoint.x - first.x;
  const dy = lastPoint.y - first.y;
  const displacement = Math.hypot(dx, dy);
  const mag = displacement || 1;
  const direction = {
    x: dx / mag,
    y: dy / mag,
    label: Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'derecha' : 'izquierda') : (dy >= 0 ? 'abajo' : 'arriba'),
    strength: displacement,
  };
  return { travel, displacement, duration: Math.max(1, lastPoint.t - first.t), direction, first, last: lastPoint };
}

function interpretPointerInput(points) {
  const stats = inputStats(points);
  if (state.holdStarted || (stats.duration > 330 && stats.displacement < 26 && stats.travel < 56)) {
    return { kind: 'hold', ...stats };
  }
  if (stats.duration < 260 && stats.displacement < 18 && stats.travel < 36) {
    return { kind: 'tap', ...stats };
  }
  const straightness = stats.displacement / Math.max(1, stats.travel);
  if (stats.displacement >= 24 && stats.displacement <= 96 && stats.travel <= 120 && straightness > 0.72 && stats.duration < 420) {
    return { kind: 'short-line', straightness, ...stats };
  }
  return { kind: 'combo', straightness, ...stats };
}

function sideFromScreenX(x) {
  const playerScreen = player.position.clone().project(camera);
  const playerX = (playerScreen.x * 0.5 + 0.5) * window.innerWidth;
  if (Math.abs(x - playerX) < 18) return enemy.position.x >= player.position.x ? 1 : -1;
  return x >= playerX ? 1 : -1;
}

function handleTapMove(input) {
  const screenDir = input.first.x >= window.innerWidth * 0.5 ? 1 : -1;
  const dir = state.moveIntent ? screenDir : sideFromScreenX(input.first.x);
  if (state.moveIntent && dir === -state.moveIntent) {
    state.moveIntent = 0;
    state.playerVelocity = 0;
    gestureName.textContent = 'Parar';
    gestureMeta.textContent = 'Tap contrario: el luchador se planta';
    liveRead.textContent = 'stop';
    roundState.textContent = 'Parado';
    showToast('PARAR');
    return;
  }
  state.moveIntent = dir;
  gestureName.textContent = dir > 0 ? 'Mover adelante' : 'Mover atrás';
  gestureMeta.textContent = 'Tap lateral: movimiento continuo. Tap contrario: parar.';
  liveRead.textContent = dir > 0 ? 'move-right' : 'move-left';
  roundState.textContent = dir > 0 ? 'Avanza' : 'Retrocede';
}

function applyManualDash(direction) {
  const dir = Math.abs(direction.x) >= Math.abs(direction.y) ? Math.sign(direction.x || 1) : sideFromScreenX(state.points[0]?.x ?? window.innerWidth * 0.5);
  player.position.x = clamp(player.position.x + dir * 0.86, -4.25, Math.min(2.15, enemy.position.x - 0.75));
  state.playerVelocity = 0;
  state.moveIntent = 0;
  animateStrike(player, 'punch', 0.08 * dir);
  gestureName.textContent = dir > 0 ? 'Dash adelante' : 'Dash atrás';
  gestureMeta.textContent = 'Línea corta: dash rápido, separada de los combos grandes';
  liveRead.textContent = 'dash-short';
  debugText.textContent = JSON.stringify({ kind: 'short-line', direction }, null, 2);
  showToast(dir > 0 ? 'DASH ADELANTE' : 'DASH ATRÁS');
}

function updatePlayerMovement(dt) {
  const target = state.moveIntent * 1.25;
  state.playerVelocity += (target - state.playerVelocity) * Math.min(1, dt * 8);
  player.position.x = clamp(player.position.x + state.playerVelocity * dt, -4.35, Math.min(2.1, enemy.position.x - 0.70));
  if (Math.abs(state.playerVelocity) < 0.01 && !state.moveIntent) state.playerVelocity = 0;
}

window.__gestureFighterDebug = { state, interpretPointerInput };

trailCanvas.addEventListener('pointerdown', (e) => {
  trailCanvas.setPointerCapture(e.pointerId);
  state.drawing = true;
  state.points = [pointerPoint(e)];
  state.holdStarted = false;
  clearTimeout(state.holdTimer);
  state.holdTimer = setTimeout(() => {
    if (!state.drawing || state.points.length !== 1 || state.gameOver) return;
    state.holdStarted = true;
    state.blockUntil = performance.now() + 260;
    gestureName.textContent = 'Bloqueo activo';
    gestureMeta.textContent = 'Mantén para cubrirte. Suelta para volver al combate.';
    liveRead.textContent = 'bloqueo';
    showToast('BLOQUEO');
  }, 330);
  gestureName.textContent = 'Leyendo input...';
  gestureMeta.textContent = 'Tap mueve/para · línea corta dash · mantener bloquea · dibujo largo combo.';
  liveRead.textContent = 'Input';
  e.preventDefault();
});

trailCanvas.addEventListener('pointermove', (e) => {
  if (!state.drawing) return;
  const p = pointerPoint(e);
  const last = state.points[state.points.length - 1];
  if (Math.hypot(p.x - last.x, p.y - last.y) > 2) state.points.push(p);
  drawTrail();
  e.preventDefault();
});

function finishPointer(e) {
  if (!state.drawing) return;
  state.drawing = false;
  clearTimeout(state.holdTimer);
  const input = interpretPointerInput(state.points);
  if (input.kind === 'tap') {
    handleTapMove(input);
    setTimeout(() => { state.points = []; drawTrail(); }, 90);
    e.preventDefault();
    return;
  }
  if (input.kind === 'hold') {
    state.blockUntil = performance.now() + 280;
    gestureName.textContent = 'Bloqueo';
    gestureMeta.textContent = 'Guardia mantenida · reduce mucho el daño';
    liveRead.textContent = 'block';
    debugText.textContent = JSON.stringify(input, null, 2);
    setTimeout(() => { state.points = []; drawTrail(); }, 90);
    e.preventDefault();
    return;
  }
  if (input.kind === 'short-line') {
    applyManualDash(input.direction);
    setTimeout(() => { state.points = []; drawTrail(); }, 120);
    e.preventDefault();
    return;
  }
  const result = recognizeGesture(state.points);
  gestureName.textContent = result.label;
  gestureMeta.textContent = `Confianza ${Math.round(result.confidence * 100)}% · dir ${result.direction.label} · energía ${Math.round(state.energy)}%`;
  liveRead.textContent = `${result.type} ${Math.round(result.confidence * 100)}%`;
  debugText.textContent = JSON.stringify({
    type: result.type,
    confidence: +result.confidence.toFixed(2),
    direction: result.direction,
    ambiguity: result.debug?.ambiguity,
    three: result.debug?.three,
  }, null, 2);
  applyGesture(result);
  setTimeout(() => { state.points = []; drawTrail(); }, 160);
  e.preventDefault();
}
trailCanvas.addEventListener('pointerup', finishPointer);
trailCanvas.addEventListener('pointercancel', finishPointer);

function enemyAttack() {
  const dist = fighterDistance();
  const close = dist < 1.35;
  if (close && Math.random() < 0.58) {
    animateStrike(enemy, 'punch', -0.28);
    damagePlayer(8, 'golpe cercano');
    return;
  }
  if (close && Math.random() < 0.35) {
    animateStrike(enemy, 'kick', -0.2);
    damagePlayer(10, 'barrido');
    return;
  }
  makeProjectile(enemy.position.x - 0.55, 1.18, { x: -1, y: Math.random() < 0.35 ? -0.35 : 0 }, 'enemy');
  animateStrike(enemy, 'punch', -0.16);
}

function updateEnemy(dt, time) {
  if (state.enemyStun > 0) {
    state.enemyStun -= dt;
    enemy.rotation.z *= 0.94;
    return;
  }
  const desired = 2.3 + Math.sin(time * 0.7) * 0.38;
  const gap = enemy.position.x - player.position.x;
  if (gap > desired) enemy.position.x -= dt * 0.42;
  if (gap < 1.0) enemy.position.x += dt * 0.46;
  enemy.position.x = clamp(enemy.position.x, 0.8, 4.25);
  state.enemyCooldown -= dt;
  if (state.enemyCooldown <= 0) {
    state.enemyCooldown = 1.15 + Math.random() * 1.20;
    enemyAttack();
  }
}

function updateProjectiles(dt, time) {
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    p.life -= dt;
    p.mesh.position.x += p.dir.x * p.speed * dt;
    p.mesh.position.y += p.dir.y * p.speed * dt;
    p.mesh.scale.setScalar(1 + Math.sin(time * 20) * 0.12);
    const target = p.owner === 'player' ? enemy : player;
    if (Math.abs(p.mesh.position.x - target.position.x) < 0.50 && Math.abs(p.mesh.position.y - (target.position.y + 1.15)) < 0.74) {
      if (p.owner === 'player') damageEnemy(p.damage, 'Hadoken');
      else damagePlayer(p.damage, 'proyectil');
      scene.remove(p.mesh);
      state.projectiles.splice(i, 1);
      continue;
    }
    if (p.life <= 0 || Math.abs(p.mesh.position.x) > 7 || p.mesh.position.y < 0.2 || p.mesh.position.y > 3.4) {
      scene.remove(p.mesh);
      state.projectiles.splice(i, 1);
    }
  }
}

function updateImpacts(dt) {
  for (let i = state.impacts.length - 1; i >= 0; i--) {
    const im = state.impacts[i];
    im.life -= dt;
    if (!im.mesh) {
      im.mesh = new THREE.Mesh(new THREE.TorusGeometry(im.size, 0.025, 8, 48), mat(im.color, im.color, 1.2));
      im.mesh.position.set(im.x, im.y, 0.05);
      im.mesh.material.transparent = true;
      scene.add(im.mesh);
    }
    im.mesh.scale.setScalar(1 + (0.45 - im.life) * 3.2);
    im.mesh.material.opacity = Math.max(0, im.life * 2.2);
    if (im.life <= 0) {
      scene.remove(im.mesh);
      state.impacts.splice(i, 1);
    }
  }
}

function updateFloaters(dt) {
  for (let i = state.floaters.length - 1; i >= 0; i--) {
    const fl = state.floaters[i];
    fl.life -= dt;
    if (!fl.el) {
      fl.el = document.createElement('div');
      fl.el.className = 'floatingHit';
      fl.el.textContent = fl.text;
      fl.el.style.color = fl.color;
      document.body.appendChild(fl.el);
    }
    fl.y += dt * 0.72;
    const screen = new THREE.Vector3(fl.x, fl.y, 0).project(camera);
    fl.el.style.left = `${(screen.x * 0.5 + 0.5) * window.innerWidth}px`;
    fl.el.style.top = `${(-screen.y * 0.5 + 0.5) * window.innerHeight}px`;
    fl.el.style.opacity = Math.max(0, fl.life / 0.85);
    if (fl.life <= 0) {
      fl.el.remove();
      state.floaters.splice(i, 1);
    }
  }
}

function updateFighterAnimation(dt, time) {
  player.position.y += (0 - player.position.y) * 0.08;
  enemy.position.y += state.enemyVy * dt;
  if (enemy.position.y > 0) state.enemyVy -= 6.2 * dt;
  if (enemy.position.y <= 0) {
    enemy.position.y = 0;
    state.enemyVy = Math.max(0, state.enemyVy);
  }
  for (const f of [player, enemy]) {
    f.lookAt(f === player ? enemy.position.x : player.position.x, 1, 0);
    f.position.y += Math.sin(time * (f === player ? 5 : 4.5)) * 0.002;
    if (f.userData.punch > 0) {
      f.userData.punch -= dt;
      f.position.z = Math.sin(f.userData.punch * 30) * f.userData.punchAmount;
      f.userData.rightArm.rotation.x = -1.0 * f.userData.side;
    } else {
      f.position.z *= 0.82;
      f.userData.rightArm.rotation.x *= 0.82;
    }
    if (f.userData.kick > 0) {
      f.userData.kick -= dt;
      f.userData.rightLeg.rotation.x = -1.4;
      f.userData.rightLeg.position.z = Math.sin(f.userData.kick * 24) * 0.32;
    } else {
      f.userData.rightLeg.rotation.x *= 0.84;
      f.userData.rightLeg.position.z *= 0.84;
    }
  }
  const now = performance.now();
  const blocking = now < state.blockUntil;
  player.scale.y += ((performance.now() < state.lowGuardUntil || blocking ? 0.86 : 1) - player.scale.y) * 0.14;
  player.userData.aura.material.opacity = now < state.shieldUntil || blocking ? 0.82 + Math.sin(time * 18) * 0.12 : now < state.chargeUntil ? 0.42 : 0;
  player.userData.aura.rotation.z += dt * 3.5;
}

let last = performance.now();
function tick(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  const time = now / 1000;

  if (!state.gameOver) {
    state.energy = clamp(state.energy + dt * 8.5, 0, 100);
    updatePlayerMovement(dt);
    updateEnemy(dt, time);
  }
  updateFighterAnimation(dt, time);
  updateProjectiles(dt, time);
  updateImpacts(dt);
  updateFloaters(dt);

  hpPlayerEl.style.width = `${state.playerHp}%`;
  hpEnemyEl.style.width = `${state.enemyHp}%`;
  energyPlayerEl.style.width = `${state.energy}%`;
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
